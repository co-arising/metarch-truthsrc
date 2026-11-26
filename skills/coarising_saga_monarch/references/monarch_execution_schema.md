# Monarch Execution & Workflow Schema Reference (`truthsrc.execution/v1` & `v2`, `truthsrc.workflow/v1`)

> Ground truth derived directly from `schema/execution-ir-v1.schema.json`, `schema/execution-ir-v2.schema.json`, `lib/execution/compile-pure.mjs`, and `scaffold/saga-monarch-project/truth/saga-monarch/contexts/inventory/formal-products/workflow/inventory-job.formal.yaml`.

## 1. Identifier, Reference, and Envelope Grammar

| Token | Regex / Allowed Values |
|---|---|
| `id` | `^[A-Za-z][A-Za-z0-9._-]*$` |
| `ref` | `input:<inputId>` \| `step:<priorStepId>:<writeId>` (never self or forward step) |
| `result` ref (in `invokeSaga`/`awaitChildRun` outputs) | `result:<completionSlot>` |
| Input `durability` | `"start-record"` \| `"durable-reference"` |
| Write `durability` | `"checkpoint"` \| `"durable-reference"` |
| `outcomeKind` | `"success"` \| `"business-rejection"` \| `"resolved"` \| `"unknown-effect"` \| `"infrastructure-failure"` |
| `action` | `"continue"` \| `"stop"` \| `"manual-recovery"` |

### Outcome Kind -> Legal Action Matrix (Strictly Enforced)

| `outcome.kind` | Allowed `outcome.action` | Notes |
|---|---|---|
| `success` | `continue` ONLY | Must publish all declared step `writes`. |
| `resolved` | `continue` ONLY | Must also publish all declared step `writes`. |
| `business-rejection` | `stop` OR `manual-recovery` | Never continues. |
| `infrastructure-failure` | `manual-recovery` ONLY | Never auto-retries or auto-compensates in v1/v2 contract. |
| `unknown-effect` | `manual-recovery` ONLY | Must reconcile before resume; never treat as business failure. |

## 2. Pipeline `execution` Block (`*.pipeline.yaml`)

```yaml
kind: pipeline
id: <pipeline-id>
name: "<human readable title>"
steps:
  - id: <step-id>
    name: "<step title>"
    execution: { ... }   # exactly ONE of: port | invokeSaga | awaitChildRun (v1 only)
execution:
  schemaVersion: "truthsrc.execution/v1"   # or "truthsrc.execution/v2"
  inputs:
    - { id: "<inputId>", type: "<TypeId>", durability: "start-record" }
  outputs:
    - { id: "<outId>", ref: "step:<stepId>:<writeId>", type: "<TypeId>" }
  recovery:
    inputResponsibility: "host"
    inputs: ["input:<inputId>", ...]       # MUST list EVERY initial input
    planVersion: "v1"
    planCompatibility: "exact"
    checkpoint: "confirmed-prefix"
    unknownEffect: "reconcile-before-resume"
    ownership: "single-writer"
  admission:
    maxConcurrentRuns: 16
    maxInFlightSteps: 1                    # MUST be constant 1
    maxItemsPerChunk: 1
    maxInFlightChunks: 1
```

## 3. Three Step Execution Variants (Mutually Exclusive)

### Variant A — `invokeSaga` (Durable Saga Step)

Required fields inside `step.execution`:
- `invokeSaga`:
  - `ref`: `{ sagaId, version }` (must match Saga definition `id` + `version` exactly)
  - `args`: array of `{ slot, ref, type }` covering EVERY declared Saga arg; each MUST match a declared step `reads` entry
  - `transactionIdentity`:
    - `type`: must match Saga `payload.transactionIdType`
    - `derivation`: `"durable-source-stage"`
    - `source`: `{ ref: "input:<id>", type: "<IdType>" }` (`kind: "id"` in Saga binding)
    - `stageId`: MUST equal enclosing `step.id` (`EXEC_SAGA_STAGE_ID`)
    - `stageOccurrence`: `{ ref: "input:<id>", type: "<IdOrNonNegIntType>" }`
    - optional `iteration`, `chunk`: `{ ref: "input:<id>", type: "<IdOrNonNegIntType>" }`
    - `scope`: `"saga-version"`
    - `conflict`: `"reject-different-args"`
    - **Rule**: ALL identity tokens MUST read initial `input:<id>` (never `step:*` outputs, `EXEC_SAGA_IDENTITY_SOURCE`).
  - `start`: `"durable-intent-before-start"`
  - `completionMode`: `"await-terminal"`
  - `results`: exact 5-element array covering all 5 Saga `resultKind`s:
    - `succeeded` -> `outcome.kind: "success"`, `action: "continue"`, `outputs: [{ slot, ref: "result:<completionSlot>", type }]` covering EVERY step `writes` slot
    - `rejected-before-effects` -> `outcome.kind: "business-rejection"`, `outputs: []`
    - `compensated` -> `outcome.kind: "business-rejection"`, `outputs: []`
    - `recovery-required` -> `outcome.kind: "infrastructure-failure"`, `outputs: []`
    - `outcome-unknown` -> `outcome.kind: "unknown-effect"`, `outputs: []`
- `reads`: every read MUST be consumed by `invokeSaga.args` or `transactionIdentity` (`EXEC_SAGA_READ_UNUSED`).
- `writes`: durable outputs produced on `succeeded`.
- `outcomes`: exact 1-to-1 match with `invokeSaga.results[*].code`.
- **Non-aliasing**: `args` substitution MUST NOT map two Saga participants on the same aggregate to the same `ref` (`EXEC_SAGA_RESOURCE_ALIAS`).

### Variant B — `port` (Pure or External Side-Effect Step)

Required fields inside `step.execution`:
- `port`: `<PortId>` declared in `binding.pipelines[].ports[]`
- `reads`: exact 1-to-1 slot & type coverage of `port.inputs`
- `writes`: exact 1-to-1 slot & type coverage of `port.outputs`
- `outcomes`: exact 1-to-1 `code` & `kind` coverage of `port.outcomes`

**External Port Hard Rules (`effect: "external"` in binding)**:
1. `confirmation` MUST be `"durable-ack"` (`EXEC_EXTERNAL_CONFIRMATION`).
2. `idempotency` MUST be `{ mode: "keyed", key: "<inputSlot>" }` (`EXEC_EXTERNAL_IDEMPOTENCY`), and the step's `reads` entry for `<inputSlot>` MUST reference an initial `input:<id>` (never a step write, `EXEC_EXTERNAL_KEY_SOURCE`).
3. `outcomes` MUST declare `success`, `infrastructure-failure`, AND `unknown-effect` (`EXEC_PORT_OUTCOME_REQUIRED`, `EXEC_EXTERNAL_UNKNOWN_EFFECT`).

### Variant C — `awaitChildRun` (`truthsrc.execution/v1` Only)

Used when a parent pipeline spawns and awaits a separately declared Monarch stages child pipeline:
- MUST be preceded by a continue-on-success `invokeSaga` step sharing the same `source.ref` (`EXECUTION_AWAIT_PRECEDES`).
- `childRun`: `{ planRef: { pipelineId }, identity: { derivation: "durable-parent-step", source, stepId, stageOccurrence, conflict: "reject-different-args" }, payload: [...], payloadCompatibility: "exact" }`.
- `start`: `"durable-intent-before-start"`, `completionMode`: `"await-terminal"`.
- `results`: exact 5-element coverage of `["succeeded", "child-rejected", "child-failed", "recovery-required", "outcome-unknown"]`.
- Requires a matching `childRuns[]` entry in `binding.pipelines[]`.

## 4. `truthsrc.execution/v1` vs `truthsrc.execution/v2` Technical Bindings

| Aspect | `truthsrc.execution-binding/v1` | `truthsrc.execution-binding/v2` |
|---|---|---|
| `pipelineBinding.engine` | `"monarch-persistence/0.2.1"` | `"monarch-persistence/0.3.0"` |
| `stepExecution` variants | `port`, `invokeSaga`, `awaitChildRun` | `port`, `invokeSaga` |
| `sagaBindings` version | `truthsrc.saga-binding/v1` | `truthsrc.saga-binding/v2` |
| `pipelineBinding.run` | Not present | Required `versionedRun`: `{ definitionId, definitionVersion, codecVersion, mode: "versioned" \| "managed", identity: "caller-supplied-exact", operations: [...] }` |
| `run.mode` & `run.operations` | N/A | Any pipeline with an `invokeSaga` or `effect: "external"` port MUST set `mode: "managed"` and declare one `managedOperation` (`identity: "original-run-step"`, `query: "read-only-original-request"`) per external/Saga step; pure-only pipelines MUST set `mode: "versioned"` with `operations: []`. |

## 5. Complete Minimal Verified Examples (`truthsrc.execution/v1`)

### Example A — `invokeSaga` Pipeline (Invoking `wallet-transfer-v1`)

```json
{
  "id": "wallet-transfer-run",
  "name": "Durable wallet transfer execution",
  "steps": [
    {
      "id": "run-transfer",
      "name": "Invoke atomic wallet transfer Saga",
      "execution": {
        "invokeSaga": {
          "ref": { "sagaId": "wallet-transfer-v1", "version": "v1" },
          "args": [
            { "slot": "fromWalletId", "ref": "input:fromWalletId", "type": "WalletId" },
            { "slot": "toWalletId", "ref": "input:toWalletId", "type": "WalletId" },
            { "slot": "amount", "ref": "input:amount", "type": "Money" }
          ],
          "transactionIdentity": {
            "type": "TxId",
            "derivation": "durable-source-stage",
            "source": { "ref": "input:operationId", "type": "OperationId" },
            "stageId": "run-transfer",
            "stageOccurrence": { "ref": "input:occurrence", "type": "OperationId" },
            "scope": "saga-version",
            "conflict": "reject-different-args"
          },
          "start": "durable-intent-before-start",
          "completionMode": "await-terminal",
          "results": [
            {
              "resultKind": "succeeded",
              "code": "Succeeded",
              "outputs": [{ "slot": "txid", "ref": "result:txid", "type": "TxId" }]
            },
            { "resultKind": "rejected-before-effects", "code": "Rejected", "outputs": [] },
            { "resultKind": "compensated", "code": "Compensated", "outputs": [] },
            { "resultKind": "recovery-required", "code": "RecoveryRequired", "outputs": [] },
            { "resultKind": "outcome-unknown", "code": "OutcomeUnknown", "outputs": [] }
          ]
        },
        "reads": [
          { "slot": "fromWalletId", "ref": "input:fromWalletId", "type": "WalletId" },
          { "slot": "toWalletId", "ref": "input:toWalletId", "type": "WalletId" },
          { "slot": "amount", "ref": "input:amount", "type": "Money" },
          { "slot": "operationId", "ref": "input:operationId", "type": "OperationId" },
          { "slot": "occurrence", "ref": "input:occurrence", "type": "OperationId" }
        ],
        "writes": [
          { "id": "txid", "slot": "txid", "type": "TxId", "durability": "checkpoint" }
        ],
        "outcomes": [
          { "code": "Succeeded", "kind": "success", "action": "continue" },
          { "code": "Rejected", "kind": "business-rejection", "action": "stop" },
          { "code": "Compensated", "kind": "business-rejection", "action": "stop" },
          { "code": "RecoveryRequired", "kind": "infrastructure-failure", "action": "manual-recovery" },
          { "code": "OutcomeUnknown", "kind": "unknown-effect", "action": "manual-recovery" }
        ]
      }
    }
  ],
  "execution": {
    "schemaVersion": "truthsrc.execution/v1",
    "inputs": [
      { "id": "operationId", "type": "OperationId", "durability": "start-record" },
      { "id": "occurrence", "type": "OperationId", "durability": "start-record" },
      { "id": "fromWalletId", "type": "WalletId", "durability": "start-record" },
      { "id": "toWalletId", "type": "WalletId", "durability": "start-record" },
      { "id": "amount", "type": "Money", "durability": "start-record" }
    ],
    "outputs": [
      { "id": "txid", "ref": "step:run-transfer:txid", "type": "TxId" }
    ],
    "recovery": {
      "inputResponsibility": "host",
      "inputs": [
        "input:operationId",
        "input:occurrence",
        "input:fromWalletId",
        "input:toWalletId",
        "input:amount"
      ],
      "planVersion": "v1",
      "planCompatibility": "exact",
      "checkpoint": "confirmed-prefix",
      "unknownEffect": "reconcile-before-resume",
      "ownership": "single-writer"
    },
    "admission": {
      "maxConcurrentRuns": 16,
      "maxInFlightSteps": 1,
      "maxItemsPerChunk": 1,
      "maxInFlightChunks": 1
    }
  }
}
```

### Example B — External Side-Effect `port` Pipeline

```json
{
  "id": "external-dispatch-run",
  "name": "Durable external gateway submission",
  "steps": [
    {
      "id": "submit-external",
      "name": "Submit idempotent request to external gateway",
      "execution": {
        "port": "SubmitExternalRequest",
        "reads": [
          { "slot": "operationId", "ref": "input:operationId", "type": "OperationId" },
          { "slot": "payloadRef", "ref": "input:payloadRef", "type": "PayloadId" }
        ],
        "writes": [
          { "id": "receiptId", "slot": "receiptId", "type": "ReceiptId", "durability": "checkpoint" }
        ],
        "outcomes": [
          { "code": "Accepted", "kind": "success", "action": "continue" },
          { "code": "Refused", "kind": "business-rejection", "action": "stop" },
          { "code": "Unavailable", "kind": "infrastructure-failure", "action": "manual-recovery" },
          { "code": "Unknown", "kind": "unknown-effect", "action": "manual-recovery" }
        ]
      }
    }
  ],
  "execution": {
    "schemaVersion": "truthsrc.execution/v1",
    "inputs": [
      { "id": "operationId", "type": "OperationId", "durability": "start-record" },
      { "id": "payloadRef", "type": "PayloadId", "durability": "start-record" }
    ],
    "outputs": [
      { "id": "receiptId", "ref": "step:submit-external:receiptId", "type": "ReceiptId" }
    ],
    "recovery": {
      "inputResponsibility": "host",
      "inputs": ["input:operationId", "input:payloadRef"],
      "planVersion": "v1",
      "planCompatibility": "exact",
      "checkpoint": "confirmed-prefix",
      "unknownEffect": "reconcile-before-resume",
      "ownership": "single-writer"
    },
    "admission": {
      "maxConcurrentRuns": 16,
      "maxInFlightSteps": 1,
      "maxItemsPerChunk": 1,
      "maxInFlightChunks": 1
    }
  }
}
```

## 6. Monarch Bounded Batch Workflow (`truthsrc.workflow/v1`)

Used in `formal-products/workflow/<id>.formal.yaml` (`kind: formal-product`, `family: workflow`, `schemaVersion: "truthsrc.formal-product/v1"`):
- `input`: `{ type, identity: "caller-job-sequence-item", eof: "explicit-close", conflict: "reject-different-payload" }`
- `capacities`: finite resource permit pools `[{ id, units }]`
- `areas[]`: bounded stages with `batch` (`count-or-wait` | `single`, `maxItems`, `minItems`, `maxWaitMillis`, `allowPartialOnClose`), `resources`, `parallelism`, `maxExecutions`, `action` (`invoke-saga` | `publish-result` with `ref: { id, version }`), and `completion` (`terminal: { kind: "route" | "complete", target, compatibilityKey, delayMillis }`, `unknown: "hold"`, `resource: "release"`).
- `settings`: explicit finite caps (`maxAcceptedItems`, `maxActiveItems`, `maxActiveBytes`, `maxItemBytes`, `maxResultBytes`, `maxConcurrentBatches`, `maxTransitions`, `maxBatchCalls`, `maxReconciliations`, `pollIntervalMillis`, `callTimeoutMillis`).

## 7. Common Monarch Execution Compiler Diagnostics (`lib/execution/compile-pure.mjs`)

| Code | Cause & Fix |
|---|---|
| `EXEC_SCHEMA` | JSON Schema violation in `execution`, `step.execution`, or `bindingDocument`. |
| `EXEC_ORPHAN_STEP` | A step declares `execution` while its enclosing pipeline omits `pipeline.execution`. |
| `EXEC_RECOVERY_COVERAGE` | `recovery.inputs` does not cover every `execution.inputs[]` or references a non-input. |
| `EXEC_REF_FORWARD` / `EXEC_REF_UNKNOWN` | Step reads its own write, a future step's write, or an undeclared ref. |
| `EXEC_OUTCOME_ACTION` | Illegal action for kind (e.g., `unknown-effect` or `infrastructure-failure` not mapped to `manual-recovery`). |
| `EXEC_EXTERNAL_CONFIRMATION` / `EXEC_EXTERNAL_IDEMPOTENCY` / `EXEC_EXTERNAL_UNKNOWN_EFFECT` | External port missing `durable-ack`, `keyed` idempotency, or `unknown-effect` outcome. |
| `EXEC_EXTERNAL_KEY_SOURCE` / `EXEC_SAGA_IDENTITY_SOURCE` | External idempotency key or Saga `transactionIdentity` token reads a step write instead of a durable initial `input:<id>`. |
| `EXEC_SAGA_BINDING_MISSING` / `EXEC_SAGA_INVOCATION_MISSING` | `invokeSaga` step missing nested `binding.sagaBindings` or `pipelineBinding.invocations[]` adapter. |
| `EXEC_SAGA_STAGE_ID` | `transactionIdentity.stageId` does not equal enclosing `step.id`. |
| `EXEC_SAGA_RESOURCE_ALIAS` | Two Saga participants on the same aggregate receive the same `args` ref. |
| `EXEC_SAGA_RESULT_COVERAGE` / `EXEC_SAGA_RESULT_KIND` / `EXEC_SAGA_RESULT_OUTPUT` | Missing any of the 5 Saga results, mismatched outcome kind, or non-`succeeded` result publishing writes. |
| `EXEC_RUN_MODE` / `EXEC_OPERATION_MISSING` | v2 pipeline with external/Saga steps not in `run.mode: "managed"` or missing a `managedOperation` entry. |
| `EXECUTION_AWAIT_PRECEDES` / `EXECUTION_AWAIT_PLAN_MISSING` | `awaitChildRun` missing a preceding continue-on-success `invokeSaga` on the same source or target plan is not a Monarch stages pipeline. |
