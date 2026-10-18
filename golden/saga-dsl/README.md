# golden: saga-dsl

Saga DSL golden sample, aligned to **saga-core 0.2**
(`net.imadz %% saga-core % 0.2`, Maven Central).

## What it pins

`TransferSaga.scala` — a transfer saga written against the current DSL.
It is the reference for what the generator should emit when a truth tree
describes a saga:

- `SagaDefinition[E, C, A]` — the single artifact a business developer writes
- `SagaStep.builder[E, C](stepId)` fluent TCC builder
  (`.prepare` / `.commit` / `.compensate` → `.ref` → `.command` → `.mapReply` → `.build()`)
- `SagaRegistry.register` at startup (before sharding recovery)
- `ArgsCodec.playJson` for args serialization
- `ResiliencePolicy(maxRetries = …)` per step

TCC mapping: prepare = reserve, commit = settle, compensate = release.

## Source of truth for the DSL

The DSL's own acceptance spec is authoritative:
`saga-core/src/test/.../acceptance/SagaDslAcceptanceSpec.scala`
(MadPolaris/saga-core). This golden mirrors it; if they disagree, the spec wins
and this file must be updated.

## Deferred

- `golden/bank-batch/` — bank-batch-transactor-demo as the fuller-capability
  golden (adds monarch-persistence). Skipped for now (multi-module); do it when
  the single-module story is solid.
- Old baseline under `golden/scala-cqrs-es-*/` + `golden/_template/` is deprecated;
  slated for `golden/_archive/` (needs file deletion, follow-up).
