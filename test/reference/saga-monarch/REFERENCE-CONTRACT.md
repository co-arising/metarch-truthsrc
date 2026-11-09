# Independent inventory reference contract — ABI 1

Status: public Scala ABI frozen for MAIN/MODELS consumption. This is **not** a B acceptance receipt. Implementation/compilation/oracle gates are separate. Authority: INTERFACES01 and approved seventh-batch plan; no generator emitters are used here.

## Modules and exact source ABI

Package prefix is `reference.inventory`; display/package overrides must not change durable strings. Source root below means `test/reference/saga-monarch/` in metarch-truthsrc.

- `kernel/Inventory.scala`: nominal RequestId, Warehouse, Sku, positive Int Quantity, TransactionId; ReservationRequest(requestId, warehouseA, warehouseB, sku, quantity). Warehouse A/B must differ. SagaIdentity carries every Strict identity field; PhaseIdentity carries participant/resource/step/phase. ItemIdentity(jobId, sequence:Long, itemId) is the original immutable input identity.
- `kernel/BinaryCodecs.scala`: BinaryCodec[A](pin/encode/decode), immutable Vector[Byte]. No Akka, protobuf, runtime, storage or oracle dependency.
- `glue/InventorySaga.scala`: `new InventorySaga(system:ActorSystem[_], namespace:String, ports:ApplicationPorts, settings:ApplicationSettings)(implicit ec:ExecutionContext)`. Public ReservationFacade methods are start/query/publish/reconcile. `association`, `actor`, `definition`, `classify` are narrow observable seams; classify must check original identity/bytes. `InventorySaga.expected(item,request)` fixes durable association identity **before** Start or participant effects.
- `glue/PublicRuntime.scala`: ApplicationSettings(interactionTimeout:FiniteDuration=2.seconds,maxReconcileInteractions:Int=16,maxTransactions:Int=32,maxJobs:Int=4,maxChildren:Int=128); SystemOwnership.CallerOwned/ApplicationOwned. `RunFactories.pure(id,definition,interpret)(ec)` and `managedSingle(id,definition,request,resolve,settings)(ec)` instantiate public libraries. CheckedRunFacade(port:RunSubmissionPort,definition:RunDefinition[String])(ec) checks all six expected identity fields and a committed Completed result; GetRun alone is insufficient.
- `glue/InventoryWorkflow.scala`: `new InventoryWorkflow(reservations:InventorySaga, ports:ApplicationPorts)(implicit ec:ExecutionContext)` implements the actual WorkflowProgram. Fixed definition is two areas: reserve CountOrWait(2,100ms,1,true), publish-result single. Fixed runtime internal step/codec execute/batch-codec-1. Original manifest items are never substituted with result bytes on Route.
- `ext/FileInventoryPorts.scala`: `new FileInventoryPorts(directory:java.nio.file.Path, warehouseA:Warehouse, warehouseB:Warehouse, recoveryAuthorization:RecoveryAuthorization)(implicit ec:ExecutionContext)`, exposes `ports:ApplicationPorts`. Explicit **test-qualified external protocol implementation**, not a real inventory algorithm or production storage certification. Immutable per-record files, force before acknowledgement, original identity comparison; not an Akka journal engine. Pure injected proof validator; R2 persists issued operation certificates before release.
- `root/InventoryApplication.scala`: `new InventoryApplication(system:ActorSystem[_], namespace:String, ports:ApplicationPorts, settings:ApplicationSettings, ownership:SystemOwnership)(implicit ec:ExecutionContext)`. Exposes reservations/program/lazy workflow, recover(item,authorization,maxInteractions,originalBatchId), close(). Only ApplicationOwned may terminate the system. One effective writer owns namespace; bounded identity maps are not durable receipts.

Compilation direction: kernel → glue; ext → kernel only; root → kernel + glue. Oracle separately compiles against those outputs plus admitted test supply. Root construction uses typed ApplicationPorts, not executeBusiness or unchecked callback orchestration. External implementation capture may wrap FileInventoryPorts only as a test implementation; real participant/result/evidence obligations remain explicit.

## Exact injected ports

ApplicationPorts constructor order: warehouseA, warehouseB, associations, results, evidence, executionEvidence, recoveryAuthorization. All types and parameter lists are authoritative in Inventory.scala.

WarehouseParticipant has three distinct commands and three read-only phase queries. Prepare B consumes the persisted A PrepareReceipt; Commit A consumes both PrepareReceipts; Commit B additionally consumes A CommitReceipt; compensation consumes only its own confirmed PrepareReceipt. No caller-created receipt context or guessed reservation ID supplies this dataflow.

AssociationPort.ensure compares and durably commits **all** Association fields before Saga Start. Query is observational. Same ItemIdentity with differing request/identity/result key fails closed.

ReservationResultPort.deliver/query take ResultEnvelope(key,identity,result,codec,bytes). Every confirmation checks key + complete identity + byte equality and injected evidence validation. Lost ACK uses query; NotFound is not confirmation. No nonterminal delivery and no overwrite of a terminal result.

EvidenceValidator has prepare/commit/compensate/absence/result/release methods. It must be pure/nonblocking in runtime validation hooks. ExecutionEvidencePort.certify issues a pure certificate over already confirmed item data; **R2 journals the terminal evidence before release**, not an in-memory receipt cache. External association/participant/result receipts remain file-durable. Fixture proof checksums are not production cryptographic authorization. RecoveryAuthorization is explicit and default-deny (no default implementation in kernel). `InventorySaga.queryPublished(item)` only queries the result port; it never delivers.

## Five result protocol and binary layout

Exactly three terminals: Succeeded=1 (`succeeded`), RejectedBeforeEffects=2 (`rejected-before-effects`), Compensated=3 (`compensated`). Exactly two observations: RecoveryRequired=4 (`recovery-required`), OutcomeUnknown=5 (`outcome-unknown`). Each case carries the **nominal** ReservationResult(transactionId,originalRequest). Aborted with any confirmed Prepare maps to Compensated; Aborted with no confirmed Prepare maps to RejectedBeforeEffects. Unknown/preparing never maps to success.

All BinaryCodecs pins are explicit `inventory.*` names, version 1. A top-level frame begins length-prefixed UTF-8 codec id then int32 version. Integers and lengths are big-endian; UTF-8 rejects malformed input; max frame 65536 bytes; no trailing bytes. Request field order is exactly requestId, warehouseA, warehouseB, sku, positive quantity:int32. Phase tags are explicitly Prepare=1,Commit=2,Compensate=3. Result field order is tag:int32,transactionId,originalRequest. All nested fields/order and manifest-result option tags are pinned in BinaryCodecs.scala; no inferred positions/names. The manifest result carries each original ItemIdentity, typed result, optional full delivery receipt (not a boolean acknowledgement).

Strict payload and receipt adapters use protobuf ByteString.copyFrom; R2 uses Akka ByteString.fromArray. No unsafe wrapping or interchange. Strict plan digest uses the documented strict-saga-plan-v2 length frame. Fixed participant/step IDs: warehouse-a/reserve-a and warehouse-b/reserve-b, resource values from the original request. Definition version 1 and semantics string in InventorySaga fix definitionDigest. Stable transaction/result keys use digest of the complete original ItemIdentity, never actor generation or batch position.

## Runtime and recovery rules

StrictSagaCoordinator owns orchestration: serial complete TCC, durable commit decision before commits, reverse compensation only confirmed prepares before decision, unknown/rejection alone not fenced absence. Replay/query/Attach never reconcile. Authorized recovery uses the same durable identity and bounded interaction budget; the caller then separately wakes the original R2 batch. No durable total deadline is claimed.

R2 reserve processes every sealed manifest item. Query never calls Start or Reconcile; initial submit Start is finite one per item. Result connector queries authoritative Saga state through association and only completes after durable result confirmation. One ItemDecision per original item. Resource bundles are **execution permits**, not inventory; Release requires validated certificate, retainCarried=false. Unknown never releases or settles. Main shape never splits whole-group Carry into single downstream holders; variants must independently validate whole-group rules.

## Fixed fixture and supply

Exact journal source (compile as external test supply; never edit, truncate or clear):
`/Users/zhongdj/Workspaces/mad-polaris/monarch-persistence/src/test/scala/net/imadz/monarch/persistence/SerializedValidationJournal.scala`
SHA-256 `45d030d264d011dfa92ddd6fe18b7e67ea8b355c486e1c1a50d1b0fcd312f2be`.

Durable lanes must supply an explicit file directory and disable snapshots; empty-directory mode is disallowed. Use fixture before-write and force-before-hold hooks for recovery windows; original journal remains. Scope is the fixed file/force fixture, not physical power-loss, LevelDB or MongoDB.

Runtime classpath is A's 109 coordinates / 110 JARs, no replacement; test lane selects only ScalaTest/Scalactic 3.2.15 plus Akka testkit 2.6.20 from recorded finite supply (not both test-library versions). No downloads. Public compiler/process/lease helpers; common jvm-slot, network denied, Xmx512m, CPU2, 120000ms per JVM, real reap. Default Node discovery does not launch JVM.

## Required qualification still separate

All A–F case families in INTERFACES01 remain mandatory. Pending is not pass. Static producer/product/installed/source-span cases belong MAIN/MODELS with the shared oracle ABI; reference owns independent behavior, external ledger and recovery. B completion requires the full fixed reference behavior/restart/negative-control suite, not this document or an ABI-ready marker. Any post-publication ABI change must be listed in a durable delta and final handoff.
