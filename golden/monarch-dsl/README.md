# golden: monarch-dsl

Monarch persistence golden sample, aligned to **monarch-persistence 0.2**
(`net.imadz %% monarch-persistence % 0.2`, Maven Central).

## What it pins

`src/main/scala/goldens/monarchdsl/BatchRun.scala` — a resumable batch run.
Reference for what the generator should emit when a truth tree describes
a resumable multi-stage run:

- `PersistentMonarch.behavior[Stage, S](persistenceId, stages, interpreter,
  stateCodec, stageName, failurePolicy, observer)`
- `StateCodec[S]` — host-provided snapshot serialization (keep stable across deploys)
- `RunObserver[S]` — host observability, never influences control flow

Semantics: one entity per run; cursor-based resume against a deterministic
stage queue; at-least-once (stage idempotency is the host's job); without a
failurePolicy a failed stage fails the run.

## Source of truth

Mirrors `ChainExecutionActor.behavior` (MadPolaris/bank-batch-transactor-demo).
The lib's own API is authoritative; if they disagree, the lib wins.
