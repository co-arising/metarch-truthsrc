# Independent Warehouse persistence/readside ABI — stage A, revision 1

Frozen sample API for the independent HAND reference and the future generated candidate. Both are compiled separately against the SAME external oracle; neither implementation supplies expected answers to the oracle. This is not family4 qualification. Main's approved `persistence-readside-interfaces-633.md` remains the upper bound. Public signatures below are stable: changes require an explicit handoff, never a silent reference-only change.

## Inputs and pending version pins

Original read-only inputs are `test/reference/aggregate-core/project` (kernel, actor glue, domain proto and converters) and `test/reference/aggregate-core/oracle`. The original oracle is not edited. Package identity is `example.inventory`. No new business fields, identity inference, event fold or command rule is permitted.

Technical constants: binding `warehouse-persistence`/`1`; store `WarehouseReadside`/`1`, H2 `h2-2`, prefix `warehouse_rs`; source `warehouse-events`/`1`; streamKind `warehouse`; serializer ID **736401**; envelopeVersion **1**. Limits: poll 100ms, shutdown 5000ms, pageSize 64, payload 1048576 bytes, maxPending 64. PID/resource/namespace are caller supplied, nonempty well-formed strings, no control characters, at most 256 UTF-8 bytes; no trim/normalization/parse. Index `Receipt`, table suffix `receipt`, query `by_resource`; String carrier key/value SQL capacities 256 characters each. Exactly one aggregate and one index.

Registry (explicit source constants, not class-name dispatch):

| role | typeId | wireVersion | domain/PB root |
|---|---|---|---|
| event | warehouse.reserved | 1 | SkuQuantityReserved / WarehouseSkuQuantityReserved |
| event | warehouse.committed | 1 | SkuReservationCommitted / WarehouseSkuReservationCommitted |
| state | warehouse.state | 1 | WarehouseState / WarehouseSnapshot |

**Three actual lowercase SHA-256 layout pins are PENDING main's explicit handoff.** They are compile-time data inputs to a new reference-owned `WarehouseWirePins.scala`, not values derived from generator output at runtime. Main supplies the actual diagnostics, then the reference owner independently records the three expected fixture constants. No placeholder hash may pass a version test. This pending data does not change the ABI below. Store compatibility qualification and reference/generated wire qualification remain blocked until fixed.

## Independent technical frame

Separate proto, not an edit to `inventory_domain.proto`. ScalaPB package `example.inventory.persistence.protobuf`, single-file object `WarehousePersistenceFrameProto`, message `Frame`:

```proto
syntax = "proto3";
package example.inventory.persistence.protobuf;
import "scalapb/scalapb.proto";
option (scalapb.options) = { flat_package: true single_file: true };
message Frame {
  uint32 envelope_version = 1;
  string role = 2;
  string type_id = 3;
  uint32 wire_version = 4;
  string layout_sha256 = 5;
  bytes payload = 6;
}
```

ScalaPB fields are `envelopeVersion:Int, role:String, typeId:String, wireVersion:Int, layoutSha256:String, payload:com.google.protobuf.ByteString`. Roles are exactly `event` and `state`; omitted/default/unknown role or version is rejected. Manifest is exactly `warehouse-frame/1/<role>/<typeId>/<wireVersion>/<layoutSha256>` (registry tokens contain no slash). Every decode checks frame version, exact role, registry typeId/version, expected layout, byte bound, and then the ONE domain parser/converter. Serializer additionally requires exact manifest equality. Unknown technical-frame fields are rejected; malformed bytes, cross-role use and missing required domain PB messages fail with `IllegalArgumentException` (parse failure may be its cause). Never Java serialization, reflection, class simpleName dispatch, or parse-success compatibility. Empty state still has a nonempty valid PB payload. Frame payload and complete serialized frame must each fit the explicit maxPayloadBytes.

## Serialization and actor ABI

Package `example.inventory.infrastructure.persistence`. Imports in these signatures are the existing domain `WarehouseProtocol.Event`, `WarehouseState`, `WarehouseComputations`, actor `WarehouseActorProtocol`, Akka types and the technical `Frame`.

```scala
final case class WarehouseWireRegistration(role: String, typeId: String,
  version: Int, layoutSha256: String)
object WarehousePersistence {
  val serializerId: Int
  val envelopeVersion: Int
  val maxPayloadBytes: Int
  val registrations: Vector[WarehouseWireRegistration]
  def encodeEvent(event: Event): Frame
  def decodeEvent(frame: Frame): Event
  def encodeState(state: WarehouseState): Frame
  def decodeState(frame: Frame): WarehouseState
  def manifest(frame: Frame): String
  def validate(frame: Frame): Unit
}
final class WarehouseEventAdapter extends akka.persistence.typed.EventAdapter[Event, Frame] {
  def toJournal(event: Event): Frame
  def manifest(event: Event): String
  def fromJournal(frame: Frame, manifest: String): akka.persistence.typed.EventSeq[Event]
}
final class WarehouseSnapshotAdapter extends akka.persistence.typed.SnapshotAdapter[WarehouseState] {
  def toJournal(state: WarehouseState): Any
  def fromJournal(value: Any): WarehouseState
}
final class WarehouseSerializer(system: akka.actor.ExtendedActorSystem)
  extends akka.serialization.SerializerWithStringManifest {
  def identifier: Int
  def manifest(value: AnyRef): String
  def toBinary(value: AnyRef): Array[Byte]
  def fromBinary(bytes: Array[Byte], manifest: String): AnyRef
}
object WarehousePersistenceFactory {
  def create(persistenceId: akka.persistence.typed.PersistenceId,
    initial: WarehouseState, hosts: WarehouseComputations):
    akka.actor.typed.Behavior[WarehouseActorProtocol.Command]
}
```

Factory calls the original `WarehouseBootstrap.create[Frame]` (the object itself extends `WarehouseAggregateFactory`, verified from the original reference) with BOTH adapters and preserves the supplied PersistenceId verbatim. Config registers `WarehouseSerializer` under `warehouse-persistence` and binds ONLY `example.inventory.persistence.protobuf.Frame`. No AnyRef/GeneratedMessage binding. Oracle uses the real Akka `SerializationExtension`, not direct serializer calls alone. Snapshot restore has the same role/version/layout checks without relying on an outer manifest.

## Envelope, Repository and Handler ABI

Package `example.inventory.infrastructure.readside`. All constructors and public methods reject null. Bytes are copied at capture AND on access; case-class array aliasing is forbidden.

```scala
final class WarehouseEnvelope private (...) {
  val pid: String; val resource: String; val sequenceNr: Long; val manifest: String
  def bytes: Array[Byte]
}
object WarehouseEnvelope {
  def capture(pid: String, resource: String, sequenceNr: Long,
    manifest: String, bytes: Array[Byte]): WarehouseEnvelope
}
final case class ReceiptCursor(mapKey: String, pidKey: String)
final case class ReceiptRow(pidKey: String, pid: String, resource: String,
  txid: example.inventory.domain.values.TxId, receipt: String)
final case class ReceiptPage(rows: Vector[ReceiptRow], next: Option[ReceiptCursor])
final case class WarehouseStoredState(resource: String, sequenceNr: Long, state: WarehouseState)
final case class ProjectResult(sequenceNr: Long, duplicate: Boolean)
final case class CatchUpResult(pid: String, lastSequenceNr: Long, observedFrontier: Long)
final case class ShutdownResult(drained: Boolean, accepted: Long, completed: Long,
  failure: Option[Throwable], timedOut: Boolean)

final class WarehouseReadsideRepository(dataSource: javax.sql.DataSource, val namespace: String) {
  def initialize(): Unit
  def transaction[A](body: WarehouseReadsideRepository.Session => A): A
  def state(pid: String): Option[WarehouseStoredState]
  def lastSequenceNr(pid: String): Long
  def byResource(resource: String, after: Option[ReceiptCursor], limit: Int): ReceiptPage
  def persistenceIds(after: Option[String], limit: Int): Vector[String]
  def currentEvents(pid: String, after: Long, limit: Int): Vector[WarehouseEnvelope]
}
object WarehouseReadsideRepository {
  trait Session {
    def event(pid: String, sequenceNr: Long): Option[WarehouseEnvelope]
    def state(pid: String): Option[WarehouseStoredState]
    def lastSequenceNr(pid: String): Long
    def append(envelope: WarehouseEnvelope): Unit
    def replaceState(pid: String, resource: String, sequenceNr: Long, state: WarehouseState): Unit
    def replaceReceipts(pid: String, resource: String, receipts: Map[example.inventory.domain.values.TxId, String]): Unit
    def checkpoint(pid: String, resource: String, sequenceNr: Long): Unit
  }
}
final class WarehouseReadsideHandler(repository: WarehouseReadsideRepository, initial: WarehouseState) {
  def project(envelope: WarehouseEnvelope): ProjectResult
}
```

Repository is synchronous blocking JDBC; async callers MUST schedule it on the explicit blocking EC, not a global EC. `transaction` takes exactly one connection, locks the namespace row, checks compatibility and then invokes the callback. All session methods reject after callback return or on a different thread, including retained references; no raw Connection escapes. Connection closes on every path; no caller DataSource close. Nested/reentrant same-repository transactions reject. No implicit retry. DDL initialization is idempotent, separately committed and validated via actual metadata; incompatible existing schema is rejected, never automatically migrated or silently completed.

`project` checks immutable input/frame BEFORE beginning work. Sequence starts at 1; repeated old sequence is a duplicate ONLY if persisted PID/resource/stream kind/source/manifest/bytes match exactly. Duplicate returns without codec fold or index replacement. Missing prior sequence, conflicting duplicate, first-association PID/resource conflict and gap reject. A new event calls the ORIGINAL `WarehouseEventHandler` once, then appends event, replaces state, replaces this PID's entire receipts partition and updates checkpoint, in that order on the same session. Commit before returning success. All precommit failures roll back; commit exception is an unknown outcome, not proof of rollback. Retry resolves committed facts. No inference of warehouse ownership from payload/PID.

Reserve's original fold is identity even though its event advances checkpoint; Commit sets `receipts.updated(event.txid, "SkuReservationCommitted")` and preserves unrelated receipts. Empty-success commands create no event and no synthetic projection step.

Fixed SQL oracle surface (all tables H2 native REGULAR mode; namespace is a row key, not an interpolated SQL identifier):

- `warehouse_rs_namespace(namespace_id, compatibility_key)`; namespace primary key.
- `warehouse_rs_event(namespace_id,pid_key,persistence_id,resource_id,stream_kind,sequence_nr,manifest,payload)`; primary key namespace/pid_key/sequence_nr; payload BLOB.
- `warehouse_rs_state(namespace_id,pid_key,persistence_id,resource_id,sequence_nr,manifest,payload)`; primary key namespace/pid_key; payload is a STATE Frame serialized by the same strict serializer-format contract.
- `warehouse_rs_offset(namespace_id,pid_key,persistence_id,resource_id,sequence_nr)`; primary key namespace/pid_key.
- `warehouse_rs_receipt(namespace_id,pid_key,persistence_id,resource_id,map_key,map_value)`; primary key namespace/pid_key/map_key. Query resource equality, ordered `(map_key,pid_key)` under a fixed namespace. Cursor uses the full ordered key, exclusive continuation, lookahead for next; no OFFSET pagination.

`pid_key` is lowercase SHA-256 of exact UTF-8 PID, original PID retained and checked (digest collision must not silently alias). SQL values use PreparedStatement. `compatibility_key` is SHA-256 over a versioned canonical descriptor including ALL store/source identity/version, streamKind, full frame registry/layout pins, index mapping/carrier/size/order and table schema identity, not just a free-text version. Its exact canonical encoding is an implementation detail, but the independent oracle changes each component and requires refusal; expected business rows are NOT computed from this key. Version layout pins and actual table structure are both checked. Limits are 1..64 per call (bounded by sample pageSize); `after` cannot be negative. Event source pages are ascending per PID.

## Source and draining runner ABI

```scala
trait WarehouseEventSource {
  def persistenceIds(after: Option[String], limit: Int): scala.concurrent.Future[Vector[String]]
  def currentEvents(pid: String, after: Long, limit: Int): scala.concurrent.Future[Vector[WarehouseEnvelope]]
}
final class WarehouseJdbcEventSource(repository: WarehouseReadsideRepository,
  blockingEc: scala.concurrent.ExecutionContext) extends WarehouseEventSource {
  def persistenceIds(after: Option[String], limit: Int): scala.concurrent.Future[Vector[String]]
  def currentEvents(pid: String, after: Long, limit: Int): scala.concurrent.Future[Vector[WarehouseEnvelope]]
}
final class WarehouseReadsideRunner(repository: WarehouseReadsideRepository,
  handler: WarehouseReadsideHandler, source: WarehouseEventSource,
  blockingEc: scala.concurrent.ExecutionContext, system: akka.actor.typed.ActorSystem[_]) {
  def initialize(): scala.concurrent.Future[akka.Done]
  def project(envelope: WarehouseEnvelope): scala.concurrent.Future[ProjectResult]
  def catchUp(pid: String): scala.concurrent.Future[CatchUpResult]
  def start(): scala.concurrent.Future[akka.Done]
  def shutdown(): scala.concurrent.Future[ShutdownResult]
  def failure: scala.concurrent.Future[Throwable]
}
```

Only one discovery page and at most one in-flight catch-up per PID. Concurrent same-PID catchUp returns the SAME accepted Future. 64 accepted pending/active operations maximum, including discovery/polling; over-capacity rejects explicitly. Stable ascending unique PID discovery, bounded contiguous per-PID pages. Oversize, foreign PID, non-progress, duplicate/out-of-order/gap and poison pages fail visibly; no skip-and-advance. An empty event page is that PID's finite observation frontier, not global discovery/caught-up proof. A failed source does not advance checkpoint. No unbounded all-history Future.

initialize/start/shutdown each memoize their result. shutdown rejects NEW admission, cancels only owned polling, and drains all accepted work (including later pages/internal calls of an already accepted catchUp). Internal draining must not call public admission again. Completed count means settled accepted operation, not necessarily success; failure is retained. 5000ms timeout returns `timedOut=true,drained=false`, never a fabricated success; later completion does not rewrite that result. `failure` completes with the first observed source/project/poll failure, not a swallowed log. shutdown success requires accepted=completed and no pending work; it preserves any failure. No DataSource, ActorSystem, or upstream source close. Caller controls H2 IFEXISTS URLs and separate source/target files/namespaces. JDBC source only reads an initialized sealed source namespace; it neither synthesizes history nor initializes an absent source.

## Independent oracle gates and stage-A status

The native H2 probe is already real JDBC, separate connections and a second JVM, not text matching of SQL. It proves BLOB, namespace locking/isolation, event/state/index/offset commit, precommit rollback, actual commit followed by an observable injected exception, exact persisted retry fact, normal close/reopen IFEXISTS and missing rejection. It does NOT prove the reference/renderer, Actor adapters, arbitrary driver commit failure, force-kill or power loss.

Later shared oracle must compile separately for HAND/generated/installed candidates; expected receipts derive from original Warehouse rules plus direct JDBC assertions. It must cover real serializer registry, bad frame/type/role/version/layout/manifest, genuine nonempty state, two PID/two namespace isolation, pagination, expired sessions, deterministic faulting DataSource wrappers, duplicate/no-fold, gap, runner poison/coalescing/drain and caller ownership. JVM A persists real Warehouse event Frames and target prefix; B reads ONLY persisted source pages via IFEXISTS, resumes old target and rebuilds fresh target. Original domain/PB bytes remain pinned. Negative controls require exact intended assertions after positive control, never arbitrary nonzero/timeout.

API freeze alone is not compilation, full reference completion, generated qualification or family4 completion. Wire pins, independent implementation tests, actor negative controls, full source/target dual-JVM replay and generated/installed runs are explicitly pending.
