# Aggregate-layer engineering candidates

## Source role

The seven Scala files under `warehouse/app/example/inventory/` are hand-authored
**ENGINEERING CANDIDATES**, not user-approved goldens. Their paths mirror the
actual application tree so tests can compare source structure without treating
a generator's current output as its own oracle.

Structural guidance came from the mature Scala files under
`backkend-codegen/reference_project/app/net/imadz/`:

- `application/aggregates/behaviors/CreditBalanceBehaviors.scala`
- `application/aggregates/CreditBalanceProtocol.scala`
- `application/aggregates/CreditBalanceAggregate.scala`
- `application/aggregates/factories/CreditBalanceAggregateFactory.scala`
- `infrastructure/bootstrap/CreditBalanceBootstrap.scala`
- `domain/entities/CreditBalanceEntity.scala`
- `domain/entities/behaviors/CreditBalanceEventHandler.scala`

Those references inform separation of responsibilities and Scala idioms, not
Warehouse business decisions. BC `.mjs` outputs, JS renderer output, and `.rounds`
regression snapshots were not used as oracles. No financial semantics or command
renaming is imported into this inventory example.

## Candidate files

- `warehouse/app/example/inventory/domain/WarehouseState.scala`
- `warehouse/app/example/inventory/domain/entities/WarehouseEntity.scala`
- `warehouse/app/example/inventory/application/aggregates/WarehouseProtocol.scala`
- `warehouse/app/example/inventory/application/aggregates/WarehouseAggregate.scala`
- `warehouse/app/example/inventory/application/aggregates/WarehouseAggregateFactory.scala`
- `warehouse/app/example/inventory/application/aggregates/behaviors/WarehouseBehaviors.scala`
- `warehouse/app/example/inventory/infrastructure/bootstrap/WarehouseBootstrap.scala`

## Compatibility exceptions to the mature reference

- `domain.WarehouseAggregate` remains the owner of `Request`, `Reply`, `Execute`,
  `GetState`, `Accepted`, and `Refused`. The application protocol aliases the
  existing types and companion values; it does not redeclare actor messages.
  Its `Command` is the request envelope, while `CommandPayload` is
  `domain.WarehouseProtocol.Command`.
- `domain.entities.WarehouseEntity.State` and `.Event` remain aliases of the
  existing domain state and events. These samples define neither a second state
  model nor a second event hierarchy. The bootstrap delegates event application
  to `domain.entities.behaviors.WarehouseEventHandler.apply`.
- `domain.WarehouseComputations` remains an open pure port supplied explicitly by
  the caller. The behavior calls the existing, same-named three-argument
  `WarehouseRules` methods; it does not implement business decisions or provide
  a default host.
- The behavior composes parameterless `queryBehavior` before
  `executionBehavior(state, hosts)`. Execution dispatch preserves this order:
  `ReserveSkuQuantity`, `CommitSkuReservation`, `ReleaseSkuReservation`,
  `RequestSkuReservation`. Queries and refusals use `Effect.none`; successful
  execution persists the returned events before sending `Accepted(events)`.
- `WarehouseAggregateFactory` is an application-layer trait at the requested
  aggregate path, not the mature reference's injected sharding factory.
  `WarehouseBootstrap` implements it as an object accepting an explicit
  persistence ID, initial state, and host. Null/empty IDs and null hosts are
  rejected using the existing combined precondition. Whitespace-only IDs are not
  newly rejected: changing admission is outside this compatibility refactor.
  No sharding, ID derivation, default state, supervision, tagger, or retention
  policy is invented here.
- Serialization adapters come from `infrastructure.serialization`, not the
  mature reference's `infrastructure.persistence` package.

## Review and reproducible verification

There is no auto-bless or output-to-reference update workflow. A renderer match
alone must not promote these candidates to approved goldens. Any promotion or
change to the reference contract requires explicit review and approval.

The seven files are integrated with the existing independently maintained
inventory fixture. `stage.mjs` produces two **new** directories: one with actual
generator output and one with the seven candidate files substituted. Both use
the same independent tests; the remaining generated domain code is a test
subject, not an independently approved reference.

Source inspection corrected two initial candidate assumptions: current adapters
are singleton objects, not constructible classes, and the existing persistence
ID precondition does not trim whitespace. Payload types use the `Payload` import
alias so a business command named `Execute` cannot shadow the actor envelope.
These are explicit compatibility corrections, not output-to-reference updates.

From the tool repository:

```bash
npm run test:aggregate-reference
node test/reference/aggregate-layers/stage.mjs /absolute/new-reference-directory
```

The second command generates isolated candidates and does not compile, start a
service, download dependencies or update the checked-in reference. Each candidate
contains an sbt build using Scala 2.13.14, Akka 2.6.20 and ScalaTest 3.2.15. In an
environment with those dependencies supplied, run the explicitly named suites
from each candidate directory:

```bash
sbt 'testOnly example.inventory.reference.WarehouseDecisionSpec example.inventory.reference.AggregateRuntimeSpec example.inventory.reference.PersistenceReplySpec'
```

A first sbt invocation may need dependency resolution; it is not an offline
promise. The recorded local verification instead used an explicit cached JAR
classpath and direct JDK 11 `scala.tools.nsc.Main`/ScalaTest under network denial.
No core CLI or ordinary Node test requires a JVM.

`WarehouseDecisionSpec` tests rule rejection, open computation, event folds and
carrier identities. `AggregateRuntimeSpec` covers actual local actors, recovery,
external authority and repository lifetime. `PersistenceReplySpec` holds a real
AsyncWriteJournal acknowledgement unresolved, observes no reply, then releases
it and checks the accepted result. Its controlled journal is not a durable store.
Identity adapters and disabled testkit serialization isolate behavior; these
suites **do not certify protobuf, bank service recovery, multi-JVM behavior or R2**.

The initial model test failed because its builder did not exist; the initial
reference comparison rejected five source shapes. Those failures were followed
by explicit implementation and reviewed compatibility corrections, not snapshot
blessing. The initial Scala run compiled but lacked Akka's remote serializer
class on the manually assembled classpath. That failed evidence was retained;
new directories were used after supplying the missing cached dependency.
