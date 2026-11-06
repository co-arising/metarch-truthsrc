# Compatible composition and JDBC read-side implementation

Date: 2026-11-06. Status: implemented and verified in the approved compatibility
scope: 534 main Scala sources compiled; original four-flow actor/generated tests
64/64 and frozen readside/generated tests 47/47 passed in separate owned windows.
Current teaching output is synchronized at 233 planned files (229 source/config
plus four evidence files); both tested candidates have identical source bytes.
See BANK [acceptance](../bank-wealth-demo/docs/TRUTH-COMPATIBLE-COMPOSITION.md) and
[TEMPLATE-PARITY.md](TEMPLATE-PARITY.md) for actual evidence and compatibility limits.

The user explicitly selected compatible migration for task 108. Necessary BANK
wiring may change; public APIs, actual message/state carriers, protobuf, PID,
financial behavior, frozen runtime and historical release/journals remain unchanged.
BC is the read-only structural reference. Local ActorRef lookup is an explicitly
accepted alternative to cluster sharding, not equivalent distributed behavior.

Baseline: TOOL d1c1c8b, BANK 21dc6c6. Independent capture/plan/protected source hashes:
`/private/tmp/truthsrc-mainline-compat.7zDtHQ/`. Frozen business tests are not edited.
The information-density/context-pack/quote-removal candidates remain deferred.

## Implementation boundary

1. Service-only rendering adds actual Entity initialization, application command
   behaviors, aggregate Factory/Bootstrap and local repository lookup. Existing
   domain State/Protocol/Aggregate public carriers retain their class identities;
   historical actor entrypoints remain compatibility adapters, not pure domain
   logic. Pure Entity/rules/event folds never depend on application or infrastructure.
2. Service Loaders use one generated ApplicationBootstrap to select/check/create
   their explicit Factory, preserving ready, page and resource cleanup behavior.
3. An explicit `truthsrc.journal-readside/v1` service declaration selects generated
   JDBC Schema, transaction repository, typed index operations, projection and
   subscription lifecycle. A typed domain projector reuses existing PB/adapters/
   fold functions. Business ownership/trusted-admission, view assembly and existing
   authentication remain explicit application ports; no complete old readside is
   embedded in a template or wrapped and relabelled as generated.
4. BANK Runtime consumes generated local repositories; BANK Readside supplies the
   application ports to the generated store/projector. Factory starts/stops that
   actual implementation. No implicit fallback to the old implementation.

## Read-side contract and adapter seam

The optional service `projectionStore` declares:

- `schemaVersion: truthsrc.journal-readside/v1`, bounded class `id`, storage/API
  `version`, SQL `tablePrefix`, positive bounded `pollIntervalMillis` and
  `closeTimeoutMillis`;
- `streams`: explicit `kind`, aggregate reference, identity state-field reference,
  `allowEmptyIdentity`, and `eventIdentities` (event and event-slot references);
- `technicalKinds`: other permitted PID kinds retained as exact serialized events;
- `indexes`: explicit `id`, SQL `table`, `columns` (`name`, `type`, `size`, `nullable`),
  `key` column names, and `queries` (`id`, `where`, `orderBy`). Column types are
  `text`, `digest`, `long`, `boolean`, `bytes`; size is null except bounded text.
  `where` is an ordered list of column names for equality parameters. Queries are
  always namespace-scoped and paginated in an explicit stable order.

The declaration does not contain arbitrary SQL, Scala or financial rules. Its
version fixes namespace locking, contiguous per-PID checkpoints, exact duplicate
comparison, original serialized payload retention, frontier invalidation and
caller-owned lifecycle. Existing `service.projections` remains a separate unsupported
family, with explicit rejection rather than silent omission.

Generated code lives in `<package>.infrastructure.projection`:

- `<id>Schema`: version/statements plus `conf/sql/<id>.sql`.
- `<id>Repository`: namespace-scoped JDBC transaction methods and inner typed index
  records in its companion. Companion `Row` has pid/kind/resource/account/principal/
  last/observed/payload. `Payload` has kind/manifest/bytes. `State` has payload/account/
  principal. `Session` has row/ownedRows, state/checkpoint operations, stream page,
  typed index put/delete/query. Every callback in a write transaction shares that
  same Connection; there is no nested transaction per index write.
- `<id>Projection`: `Envelope`, `Journal` (namespace, persistenceIds, currentEvents,
  events), `Bindings` (identity, fold, indexes) in its companion. Instance provides
  initialize/project/catchUp/start/shutdown/close and tracked `read`.
- `<id>Domain`: typed state decoders and a generated fold function using declared
  stream/event identities, generated PB/serialization and the existing event folds.
  Typed ownership callbacks retain bank-specific admission and owner decisions.

All output goes through current graph AST, registered product producers, unique
apply/ledger and same-graph anchors. Source mappings follow real emitted cores.

## Verification and finish

- Keep independent old semantic/product and generated source baselines; only the
  explicitly added technical declarations may change artifact-contract payload.
- Test closed schema, complete references, types, duplicate SQL names, query keys,
  deterministic rendering, finite profile errors and source mappings.
- Generate fresh candidates, compile main/Test, run original four-flow actor tests
  and separately admitted frozen readside/H2 tests without services or network.
- Compare public carriers/PB/serializer and unaffected files byte-for-byte, inspect
  actual wiring rather than only output names; run graph/query/change/update tests.
- Record BC final-writer families and concrete compatibility exceptions; no claim
  of byte-identical BC full output, cluster sharding, or HTTP/database/cross-JVM
  reacceptance without the corresponding actual evidence.
- Finish via the public update path and accurate tutorial/acceptance records. No
  automatic commit, push, runtime publication, cleanup or old-data migration.
