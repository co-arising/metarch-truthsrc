# Saga Contract Schema Reference (`truthsrc.saga/v1` & `truthsrc.saga/v2`)

> Ground truth derived directly from `schema/saga-ir-v1.schema.json`, `schema/saga-ir-v2.schema.json`, and `lib/saga/compile-pure.mjs`.

## 1. Identifier, Reference, and Envelope Grammar

| Token | Regex / Allowed Values |
|---|---|
| `id` | `^[A-Za-z][A-Za-z0-9_-]*$` (1..128 chars) |
| `symbol` | `^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$` (1..256 chars) |
| `artifact` | `^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$` (Maven `group:artifact:version`) |
| `ref` (v1) | `txid` \| `args:<slot>` \| `step:<stepId>:(prepare\|commit\|compensate):<slot>` |
| `ref` (v2) | Same as v1, plus `args` (whole-args object; completion inputs only, requires matching `argsType`) |
| `trigger` ref | `source:<fieldName>` (must exist on `sourceRef` command `parameters` or event `payloads`) |
| `receipt` ref | `receipt:<fieldName>` (in binding `confirmation.outputs`; must exist on confirmation event `payloads`) |
| `resultKinds` | Exact constant 5-element array: `["succeeded", "rejected-before-effects", "compensated", "recovery-required", "outcome-unknown"]` |

### YAML Atom Wrapper (`*.saga.yaml`)

```yaml
kind: saga
id: <saga-id>
name: "<human readable title>"
seq: 1
version: v1
payload:
  schemaVersion: "truthsrc.saga/v1"   # or "truthsrc.saga/v2"
  ...
```

## 2. `truthsrc.saga/v1` vs `truthsrc.saga/v2` Exact Differences

| Field | `truthsrc.saga/v1` | `truthsrc.saga/v2` |
|---|---|---|
| `payload.schemaVersion` | `"truthsrc.saga/v1"` | `"truthsrc.saga/v2"` |
| Binding `schemaVersion` | `"truthsrc.saga-binding/v1"` | `"truthsrc.saga-binding/v2"` |
| Compiled IR `schemaVersion` | `"truthsrc.saga-ir/v1"` | `"truthsrc.saga-ir/v2"` |
| `payload.argsType` | Forbidden (`additionalProperties: false`) | Optional nominal `value-object` ID whose `fields` equal `payload.args` in exact order |
| `steps[*].phases.*` | `kind: "command"` OR all three phases `kind: "none", reason: "read-only"` | All three phases (`prepare`, `commit`, `compensate`) MUST be `kind: "command"` |
| Concurrency / `groups` | Serial numeric barriers; multiple non-aliasing steps allowed per group if `<= admission.maxInFlight` | Strict serial barriers: `admission.maxInFlight` MUST be `1` and each group MUST have exactly `1` step (`SAGA_SERIAL_REQUIRED`) |
| `resilience` | `{ maxAttempts, phaseTimeoutMs, queryTimeoutMs, backoffMs, totalTimeoutMs }` where `totalTimeoutMs >= maxAttempts*(phaseTimeoutMs+queryTimeoutMs) + (maxAttempts-1)*backoffMs` | `{ mode: "per-interaction", interactionTimeoutMs, automaticPhaseAttempts: 1, recovery: "explicit-authorized", maxReconcileInteractions: 1..1024, totalDeadline: "unsupported" }` |
| `completions[*]` | `{ kind, eventRef: { aggregate, name }, bindings }` | `{ kind, portRef: { name, version }, bindings }` (all 5 completions MUST target the same `truthsrc.saga-result-port/v1` in `canonical.ports`) |

## 3. Mandatory `safety` Block (Identical in v1 & v2)

All 8 keys are required and MUST carry these exact constant strings:

```json
{
  "commitDecision": "durable-before-commit",
  "abortDecision": "durable-before-compensate",
  "afterCommit": "forward-recovery",
  "unknown": "reconcile-before-resume",
  "compensation": "confirmed-reservations",
  "cancelBeforePrepare": "empty-release-and-fence",
  "retryIdentity": "stable-operation",
  "manualRecovery": "authorized-reconciliation-evidence"
}
```

## 4. Phase Dataflow & Ownership Rules (Enforced by `compile-pure.mjs`)

1. **Aggregate ownership**: Every `commandRef` and `eventRef` MUST resolve in `canonical.aggregates[].commands` or `canonical.aggregates[].events`. Session notes never prove ownership (`SAGA_REFERENCE_INSUFFICIENT`).
2. **Exact resource addressing**:
   - Each participant declares `{ id, aggregate, resourceRef: { ref: "args:<slot>", type: "<IdType>" } }`.
   - `<IdType>` MUST have `kind: "id"` and its `canonicalType` MUST equal `aggregate.identifier.dataType`.
   - No two participants may alias the same `[aggregate, resourceRef.ref]` pair (`SAGA_RESOURCE`).
   - Any phase command parameter whose type has the same `canonicalType` as the participant's resource MUST bind that participant's exact `resourceRef` (`SAGA_RESOURCE`).
3. **Group ordering**:
   - Every group `id` is a positive integer (`>= 1`).
   - Groups sorted ascending MUST form a strict transitive dependency chain: group `g[i]` MUST transitively depend on `g[i-1]` (`SAGA_GROUP_ORDER`). No cycles (`SAGA_GROUP_CYCLE`) or empty groups (`SAGA_GROUP_EMPTY`).
   - Steps in the same group cannot reuse a participant (`SAGA_RESOURCE`).
4. **Allowed `step:<id>:<phase>:<slot>` reads**:
   - In `prepare`: only `prepare` outputs from a **strict ancestor group**.
   - In `commit`: ANY confirmed `prepare` output, OR `commit` outputs from a **strict ancestor group**.
   - In `compensate`: ONLY **this step's own** `prepare` output (`producer.id === consumer.id`).
   - In `completions`: `commit` outputs are allowed ONLY when `kind === "succeeded"`. Never read `prepare` or `compensate` outputs in completions.
5. **Triggers & idempotency**:
   - `argsMapping` MUST cover every declared `payload.args` slot 1-to-1 with matching `canonicalType`.
   - `idempotency`: `{ ref: "source:<field>", type: "<IdType>", scope: "saga-version", conflict: "reject-different-args" }`.
   - `<IdType>` MUST have `kind: "id"`, and if the source field declares `origin`, it MUST be `"BUSINESS_INPUT"` or `"PROPAGATED"` (`SAGA_IDEMPOTENCY`).
6. **Admission & manifests**:
   - `participants.length <= admission.maxParticipants` and `admission.maxInFlight <= admission.maxParticipants`.
   - If ANY arg contains a `collection` (directly or nested inside a `value-object`), `admission.manifest` MUST use `mode: "durable-reference"` referencing a `manifest-reference` arg of matching `version` (`SAGA_MANIFEST`), and total nested collection cardinality MUST NOT exceed `admission.maxItemsPerChunk` (`SAGA_ADMISSION`).
   - Otherwise `admission.manifest` is `{ mode: "static", durable: true }`.

## 5. Technical Binding (`truthsrc.saga-binding/v1` & `v2`)

Every Saga requires a matching entry in `bindings.sagas[]`:
- `engine.apiMode`: `"strict"`
- `engine.capabilities.required`: exact 10-item set:
  `["durable-commit-decision", "durable-abort-decision", "typed-nonterminal-unknown", "safe-status-reattach", "receipt-reconciliation", "participant-idempotency-query", "pinned-definition-codec", "manual-evidence-authorization", "cancel-before-prepare-fencing", "durable-manifest"]`
- `types[]` `kind` variants:
  - `id` / `string`: `{ id, canonicalType, implementation, kind, minLength, maxLength }`
  - `boolean`: `{ id, canonicalType, implementation, kind }`
  - `integer`: `{ id, canonicalType, implementation, kind, minimum, maximum }`
  - `enum`: `{ id, canonicalType, implementation, kind, values: [...] }`
  - `collection`: `{ id, canonicalType, implementation, kind, elementType, minItems, maxItems }`
  - `value-object`: `{ id, canonicalType, implementation, kind, fields: [{ slot, type }] }` (must match `canonical.valueObjects` 1-to-1)
  - `money`: `{ id, canonicalType, implementation, kind: "money", currency: "ISO-4217", amountEncoding: "minor-unit-string" | "decimal-string", scale, precision, codec }` (`scale <= precision`; `canonicalType` MUST NOT be `number`/`double`/`float`/`decimal`/`bigdecimal`)
  - `manifest-reference`: `{ id, canonicalType, implementation, kind: "manifest-reference", readable: true, version }`
- Per-phase `command` binding requires:
  - `confirmation`: `{ kind: "durable-receipt", eventRef, mapper, outputs: [{ slot, ref: "receipt:<field>", type }] }` (command `produces` MUST list `eventRef.name`)
  - `query`: `{ mapper, mode: "read-only", identity: ["txid", "definition-version", "args-digest", "participant", "resource", "step", "phase"], resultKinds: ["confirmed", "not-executed", "unknown"] }`
  - `receipt`: `{ mapper, version, durable: true, identity: ["txid", "definition-version", "args-digest", "participant", "resource", "step", "phase"], payloadCompatibility: "exact", evidence: "reservation-decision-effect-reconciliation" }`
  - `idempotency`: `{ mapper, identity: ["txid", "definition-version", "participant", "resource", "step", "phase"], payloadConflict: "reject", attemptIdentity: "excluded" }`

## 6. Complete Minimal Verified Example (`truthsrc.saga/v1`)

The following minimal two-wallet transfer Saga compiles with 0 diagnostics under `compileSagas` (`truthsrc.saga/v1` + `truthsrc.saga-binding/v1`):

```json
{
  "id": "wallet-transfer-v1",
  "name": "Atomic wallet-to-wallet transfer",
  "seq": 1,
  "version": "v1",
  "payload": {
    "schemaVersion": "truthsrc.saga/v1",
    "purpose": "Debit source wallet and credit target wallet atomically under strict TCC",
    "invariants": [
      "Only confirmed Prepare holds may be compensated before durable CommitDecision",
      "After durable CommitDecision, recovery is strictly forward-recovery"
    ],
    "transactionIdType": "TxId",
    "args": [
      { "slot": "fromWalletId", "type": "WalletId" },
      { "slot": "toWalletId", "type": "WalletId" },
      { "slot": "amount", "type": "Money" }
    ],
    "participants": [
      {
        "id": "source-wallet",
        "aggregate": "Wallet",
        "resourceRef": { "ref": "args:fromWalletId", "type": "WalletId" }
      },
      {
        "id": "target-wallet",
        "aggregate": "Wallet",
        "resourceRef": { "ref": "args:toWalletId", "type": "WalletId" }
      }
    ],
    "groups": [
      { "id": 1, "dependsOn": [] },
      { "id": 2, "dependsOn": [1] }
    ],
    "steps": [
      {
        "id": "debit-source",
        "participant": "source-wallet",
        "group": 1,
        "phases": {
          "prepare": {
            "kind": "command",
            "commandRef": { "aggregate": "Wallet", "name": "PrepareDebit" },
            "bindings": [
              { "slot": "walletId", "ref": "args:fromWalletId", "type": "WalletId" },
              { "slot": "txId", "ref": "txid", "type": "TxId" },
              { "slot": "amount", "ref": "args:amount", "type": "Money" }
            ],
            "outputs": [
              { "slot": "holdId", "type": "HoldId" }
            ]
          },
          "commit": {
            "kind": "command",
            "commandRef": { "aggregate": "Wallet", "name": "CommitDebit" },
            "bindings": [
              { "slot": "walletId", "ref": "args:fromWalletId", "type": "WalletId" },
              { "slot": "holdId", "ref": "step:debit-source:prepare:holdId", "type": "HoldId" }
            ],
            "outputs": []
          },
          "compensate": {
            "kind": "command",
            "commandRef": { "aggregate": "Wallet", "name": "ReleaseDebit" },
            "bindings": [
              { "slot": "walletId", "ref": "args:fromWalletId", "type": "WalletId" },
              { "slot": "holdId", "ref": "step:debit-source:prepare:holdId", "type": "HoldId" }
            ],
            "outputs": []
          }
        }
      },
      {
        "id": "credit-target",
        "participant": "target-wallet",
        "group": 2,
        "phases": {
          "prepare": {
            "kind": "command",
            "commandRef": { "aggregate": "Wallet", "name": "PrepareCredit" },
            "bindings": [
              { "slot": "walletId", "ref": "args:toWalletId", "type": "WalletId" },
              { "slot": "txId", "ref": "txid", "type": "TxId" },
              { "slot": "amount", "ref": "args:amount", "type": "Money" }
            ],
            "outputs": [
              { "slot": "holdId", "type": "HoldId" }
            ]
          },
          "commit": {
            "kind": "command",
            "commandRef": { "aggregate": "Wallet", "name": "CommitCredit" },
            "bindings": [
              { "slot": "walletId", "ref": "args:toWalletId", "type": "WalletId" },
              { "slot": "holdId", "ref": "step:credit-target:prepare:holdId", "type": "HoldId" }
            ],
            "outputs": []
          },
          "compensate": {
            "kind": "command",
            "commandRef": { "aggregate": "Wallet", "name": "ReleaseCredit" },
            "bindings": [
              { "slot": "walletId", "ref": "args:toWalletId", "type": "WalletId" },
              { "slot": "holdId", "ref": "step:credit-target:prepare:holdId", "type": "HoldId" }
            ],
            "outputs": []
          }
        }
      }
    ],
    "resilience": {
      "maxAttempts": 3,
      "phaseTimeoutMs": 2000,
      "queryTimeoutMs": 1000,
      "backoffMs": 500,
      "totalTimeoutMs": 10000
    },
    "safety": {
      "commitDecision": "durable-before-commit",
      "abortDecision": "durable-before-compensate",
      "afterCommit": "forward-recovery",
      "unknown": "reconcile-before-resume",
      "compensation": "confirmed-reservations",
      "cancelBeforePrepare": "empty-release-and-fence",
      "retryIdentity": "stable-operation",
      "manualRecovery": "authorized-reconciliation-evidence"
    },
    "admission": {
      "maxParticipants": 2,
      "maxInFlight": 1,
      "maxItemsPerChunk": 1,
      "manifest": { "mode": "static", "durable": true }
    },
    "triggers": [
      {
        "id": "start-transfer",
        "kind": "command",
        "sourceRef": { "aggregate": "TransferOrder", "name": "InitiateTransfer" },
        "argsMapping": [
          { "slot": "fromWalletId", "ref": "source:fromWalletId", "type": "WalletId" },
          { "slot": "toWalletId", "ref": "source:toWalletId", "type": "WalletId" },
          { "slot": "amount", "ref": "source:amount", "type": "Money" }
        ],
        "idempotency": {
          "ref": "source:operationId",
          "type": "OperationId",
          "scope": "saga-version",
          "conflict": "reject-different-args"
        }
      }
    ],
    "resultKinds": [
      "succeeded",
      "rejected-before-effects",
      "compensated",
      "recovery-required",
      "outcome-unknown"
    ],
    "completions": [
      {
        "kind": "succeeded",
        "eventRef": { "aggregate": "TransferOrder", "name": "TransferSucceeded" },
        "bindings": [{ "slot": "txid", "ref": "txid", "type": "TxId" }]
      },
      {
        "kind": "rejected-before-effects",
        "eventRef": { "aggregate": "TransferOrder", "name": "TransferRejected" },
        "bindings": [{ "slot": "txid", "ref": "txid", "type": "TxId" }]
      },
      {
        "kind": "compensated",
        "eventRef": { "aggregate": "TransferOrder", "name": "TransferCompensated" },
        "bindings": [{ "slot": "txid", "ref": "txid", "type": "TxId" }]
      },
      {
        "kind": "recovery-required",
        "eventRef": { "aggregate": "TransferOrder", "name": "TransferRecoveryRequired" },
        "bindings": [{ "slot": "txid", "ref": "txid", "type": "TxId" }]
      },
      {
        "kind": "outcome-unknown",
        "eventRef": { "aggregate": "TransferOrder", "name": "TransferOutcomeUnknown" },
        "bindings": [{ "slot": "txid", "ref": "txid", "type": "TxId" }]
      }
    ]
  }
}
```

## 7. Common Saga Compiler Diagnostics (`lib/saga/compile-pure.mjs`)

| Code | Cause & Fix |
|---|---|
| `SAGA_SCHEMA` | JSON Schema violation (missing required key, wrong `const` in `safety`, unknown property, bad ref pattern). |
| `SAGA_BINDING_MISSING` / `SAGA_VERSION` | Missing `bindings.sagas[]` entry or `version` mismatch with definition. |
| `SAGA_AGGREGATE_UNKNOWN` / `SAGA_REFERENCE_INSUFFICIENT` | Aggregate/command/event missing from `canonical.aggregates`, or aggregate lacks `identifier.dataType` / typed `parameters` / `payloads`. |
| `SAGA_UNSAFE_AMOUNT` / `SAGA_PRECISION` | Monetary field mapped to non-`money` kind or floating `canonicalType` (`Number`/`Double`/`Float`), or `scale > precision`. |
| `SAGA_RESOURCE` | Aliasing participants, non-`id` resourceRef, or phase resource parameter not bound to this participant's exact `resourceRef`. |
| `SAGA_GROUP_ORDER` / `SAGA_SERIAL_REQUIRED` | Group missing transitive dependency on prior numeric barrier, or v2 group has `>1` step / `maxInFlight !== 1`. |
| `SAGA_REF_UNAVAILABLE` | Illegal cross-phase read (e.g., `compensate` reading another step's output, or non-`succeeded` completion reading `commit` output). |
| `SAGA_CONFIRMATION` | Phase command's `produces` array does not declare the binding's `confirmation.eventRef.name`. |
| `SAGA_IDEMPOTENCY` | Non-`id` transaction/trigger identity type, or trigger identity field `origin` is not `BUSINESS_INPUT`/`PROPAGATED`. |
| `SAGA_RESILIENCE` | v1 `totalTimeoutMs < maxAttempts*(phaseTimeoutMs+queryTimeoutMs) + (maxAttempts-1)*backoffMs`. |
| `SAGA_MANIFEST` / `SAGA_ADMISSION` | Collection arg without `durable-reference` manifest, or nested cardinality `> maxItemsPerChunk`. |
| `SAGA_RESULT_PORT` / `SAGA_RESULT_PORT_VERSION` | v2 completions do not all target one unique `truthsrc.saga-result-port/v1` declaration in `canonical.ports`. |
