---
name: coarising-saga-monarch
description: >-
  Author and verify strict Saga (TCC transaction boundaries, truthsrc.saga/v1 & v2)
  and Monarch durable execution pipelines (truthsrc.execution/v1 & v2, invokeSaga,
  external ports, awaitChildRun, formal workflows) with financial safety guardrails
  and fail-closed truthsrc compilation.
---

# co-arising Saga & Monarch Truth Authoring Skill

Use this skill whenever the user needs to model or edit:
- **Multi-aggregate distributed transactions** requiring Prepare / Commit / Compensate (TCC) semantics (`*.saga.yaml` + `bindings/saga*.json`).
- **Durable multi-step execution pipelines** orchestrating Sagas, external side-effect ports, or child runs (`*.pipeline.yaml` + `bindings/execution*.json`).
- **Monarch bounded batch workflows** (`formal-products/workflow/*.formal.yaml`).
- **Integration boundaries** deciding between single-aggregate v2 EARS slices, v2 `bindings/*-effects.yaml` (S1 TCK), Saga TCC, and Monarch pipelines.

## Mandatory Pre-Read (Do This BEFORE Writing Any YAML or Binding JSON)

Before authoring a single line of Saga or Monarch truth, **MUST read both bundled reference specs** inside this skill folder:

1. **`references/saga_schema.md`** — exact compiler-verified contract for `truthsrc.saga/v1`, `truthsrc.saga/v2`, `truthsrc.saga-binding/v1|v2`, TCC phase rules, reference grammar (`txid`, `args:<slot>`, `step:<id>:<phase>:<slot>`), `safety`, `resilience`, `admission`, `triggers`, `completions`, and diagnostic codes (`SAGA_*`).
2. **`references/monarch_execution_schema.md`** — exact compiler-verified contract for `truthsrc.execution/v1`, `truthsrc.execution/v2`, `truthsrc.execution-binding/v1|v2`, `invokeSaga`, external `port`, `awaitChildRun`, `recovery`, `admission`, `outcomes`, `truthsrc.workflow/v1`, and diagnostic codes (`EXEC_*`, `EXECUTION_AWAIT_*`).

> Do NOT guess YAML keys, ref prefixes, safety constants, or binding schemas from memory. Both reference documents are extracted directly from `schema/saga-ir-v{1,2}.schema.json`, `schema/execution-ir-v{1,2}.schema.json`, `lib/saga/compile-pure.mjs`, and `lib/execution/compile-pure.mjs`.

## Architecture Decision Tree (Choose the Right Primitive First)

Before creating a `.saga.yaml` or `.pipeline.yaml`, classify the requirement:

| Scenario | Correct Truth Primitive | Why |
|---|---|---|
| Single aggregate state change / business invariant / arithmetic | v2 `behaviors/domain/*.ears` (`slice`) | Atomic within one aggregate boundary; verified by Z3/SMT via `coarising-distill`. |
| Single inbound HTTP/API workflow or external callback policy (v2 Onion service) | v2 `behaviors/application/*.{story,integration}.ears` + `bindings/*-effects.yaml` | Verified by `compile-v2` + S1 TCK (`run-tck-v2`). |
| Atomic all-or-nothing coordination across 2+ aggregates (e.g., debit A + credit B + confirm order) | **Saga (`truthsrc.saga/v1` or `v2`)** | Enforces durable `CommitDecision` / `AbortDecision` and explicit TCC (`prepare` / `commit` / `compensate`) per participant. |
| Ordered durable workflow: run Saga A -> call external gateway port -> await child pipeline | **Monarch Execution Pipeline (`truthsrc.execution/v1` or `v2`)** | Durable step checkpoints (`confirmed-prefix`), deterministic `transactionIdentity`, explicit `unknown-effect -> manual-recovery`. |
| Refund / reversal AFTER a previous transaction has already committed | **A separate, independent Refund Saga** (NOT `compensate` of the original Saga) | Once `CommitDecision` is durable, the original Saga can only do `forward-recovery`. Reversing settled funds is a new business transaction with its own identity and authorization. |
| Bounded batching / concurrency permits / area routing over Saga invocations | **Monarch Workflow (`truthsrc.workflow/v1`)** | `formal-products/workflow/*.formal.yaml` governs batch windows, permits, and `unknown: hold`. |

## Six Non-Negotiable Financial & Distributed Safety Red Lines

The compiler will reject violations statically, and you MUST also uphold the semantic intent:

1. **Never conflate Saga (transaction boundary) with Monarch Pipeline (workflow sequence).**
   - Put cross-aggregate TCC participants and Prepare/Commit/Compensate phases in `*.saga.yaml`.
   - Put cross-stage orchestration (`invokeSaga`, external `port`, `awaitChildRun`) in `*.pipeline.yaml`.
2. **Never compensate after `CommitDecision`.**
   - `safety.afterCommit` is ALWAYS `"forward-recovery"`.
   - `safety.commitDecision` is ALWAYS `"durable-before-commit"`, `safety.abortDecision` is ALWAYS `"durable-before-compensate"`.
   - Business refunds after settlement MUST be modeled as a separate Saga.
3. **Never downgrade `outcome-unknown` or `unknown-effect` into failure or auto-compensation.**
   - In Saga: `safety.unknown: "reconcile-before-resume"`, `safety.compensation: "confirmed-reservations"`, `safety.manualRecovery: "authorized-reconciliation-evidence"`.
   - In Monarch: `recovery.unknownEffect: "reconcile-before-resume"`; every external `port`, `invokeSaga`, and `awaitChildRun` MUST map `unknown-effect` / `outcome-unknown` to `action: "manual-recovery"`.
4. **Never derive transaction or idempotency identity from clocks, random UUIDs, retries, or step writes.**
   - Saga trigger `idempotency.ref` MUST point to a source field with `origin: "BUSINESS_INPUT"` or `"PROPAGATED"`.
   - Monarch `transactionIdentity` (`derivation: "durable-source-stage"`) and external port `idempotency.key` MUST read exclusively from durable initial `input:<id>` tokens (never `step:*` outputs), with `conflict: "reject-different-args"`.
5. **Respect strict phase dataflow and receipt isolation.**
   - `prepare` may read `txid`, `args:<slot>`, or `step:<prior-group-step>:prepare:<slot>`.
   - `commit` may read `txid`, `args:<slot>`, ANY confirmed `step:*:prepare:<slot>`, or `step:<prior-group-step>:commit:<slot>`.
   - `compensate` may ONLY read `txid`, `args:<slot>`, or **its own step's** `step:<self>:prepare:<slot>` receipt (never another step's tentative output or any commit output).
   - Non-succeeded Saga completions (`rejected-before-effects`, `compensated`, `recovery-required`, `outcome-unknown`) MUST NOT read `step:*:commit:*` outputs; only `succeeded` may publish `writes` in `invokeSaga`.
6. **Exact nominal types only — zero floating-point money or implicit aggregate ownership.**
   - Every monetary field MUST bind `kind: "money"` with `currency: "ISO-4217"`, `amountEncoding: "minor-unit-string" | "decimal-string"`, and `scale <= precision` (`Number`/`Double`/`Float` triggers `SAGA_UNSAFE_AMOUNT` / `SAGA_PRECISION`).
   - Only aggregate-owned commands (`aggregates[].commands`) and events (`aggregates[].events`) resolve; session notes never prove ownership (`SAGA_REFERENCE_INSUFFICIENT`).

## Procedure

### Phase 1 — Boundary & Version Selection
1. Inspect the target workspace (`truth/`, `bindings/`, `system.yaml` or `workshop.yaml`) to determine which schema generation the project uses:
   - **`v1` (`truthsrc.saga/v1` + `truthsrc.execution/v1`)**: completions emit aggregate events (`eventRef`), supports `kind: "none", reason: "read-only"` steps and `awaitChildRun`, engine `monarch-persistence/0.2.1`.
   - **`v2` (`truthsrc.saga/v2` + `truthsrc.execution/v2`)**: strict serial barriers (`maxInFlight: 1`, 1 step per group), all 3 TCC phases mandatory `kind: "command"`, completions target a single versioned `resultPort` (`portRef`), per-interaction `resilience`, engine `monarch-persistence/0.3.0` + `run.mode: "managed" | "versioned"`.
2. Verify that every participant aggregate exists with an explicit `identifier.dataType`, every phase command has typed `parameters` and `produces` its confirmation event, and every event has typed `payloads`.

### Phase 2 — Author Saga Truth & Technical Binding
1. Author `*.saga.yaml` (or Saga entries in canonical JSON) following `references/saga_schema.md`:
   - Declare `purpose`, `invariants`, `transactionIdType`, `args`, `participants` (distinct `(aggregate, resourceRef)` pairs — zero aliasing), serial `groups`, `steps` with `prepare`/`commit`/`compensate`, `resilience`, `safety` (all 8 exact constants), `admission`, `triggers`, `resultKinds`, and all 5 `completions`.
2. Author matching `bindings/saga.json` (`truthsrc.saga-binding/v1` or `v2`):
   - Pin exact `sagaId` + `version`, `engine` (`apiMode: "strict"`, all 10 required `capabilities`), `codec` (`compatibleVersions` includes `version`), nominal `types`, `participants` addressing (`mode: "exact-resource"`), `steps` phase bindings (`confirmation`, `query`, `receipt`, `idempotency`), `triggerMappers`, and all 5 `completionMappers`.

### Phase 3 — Author Monarch Execution Pipeline & Technical Binding
1. Author `*.pipeline.yaml` following `references/monarch_execution_schema.md`:
   - Declare `execution` (`inputs`, `outputs`, `recovery` covering every `input:<id>`, `admission` with `maxInFlightSteps: 1`).
   - For each step, choose exactly one discriminator: `invokeSaga`, `port`, or (in v1) `awaitChildRun`.
   - Map all required `reads`, `writes` (`durability: "checkpoint" | "durable-reference"`), and exhaustive `outcomes` (`unknown-effect` & `infrastructure-failure` -> `manual-recovery`).
2. Author matching `bindings/execution.json` (`truthsrc.execution-binding/v1` or `v2`):
   - Pin `pipelineId`, `engine`, `codec`, `types` (matching Saga type implementations identically when invoking Sagas), `ports` (external ports MUST have `confirmation: "durable-ack"`, `idempotency.mode: "keyed"` on an initial input, and `unknown-effect`), `invocations` (for `invokeSaga`), optional `childRuns` (v1), `run` + `operations` (v2), and nested `sagaBindings` when any step uses `invokeSaga`.

### Phase 4 — Fail-Closed Compilation & Verification
Run the real `truthsrc` compilers (never rely on manual eyeball checks):

```bash
# 1. Validate tree / compile unified project (when using system.yaml + truthsrc.project.json)
truthsrc compile-project --project truthsrc.project.json

# 2. Compile Saga contract IR directly (from v1 tree or canonical JSON)
truthsrc compile-sagas --in <canonical.json> --binding bindings/saga.json --out .truthsrc/saga-ir.json

# 3. Compile Monarch Execution contract IR directly (also compiles nested sagaBindings)
truthsrc compile-execution --in <canonical.json> --binding bindings/execution.json --out .truthsrc/execution-ir.json

# 4. If paired with a v2 EARS service, also verify S1 effect bindings
truthsrc run-tck-v2 --root .
```

Any single diagnostic discards ALL IR (`ir: null`). Fix every reported `SAGA_*` / `EXEC_*` / `EXECUTION_AWAIT_*` diagnostic at its reported JSON pointer and re-run until diagnostics are empty (`[]`).
