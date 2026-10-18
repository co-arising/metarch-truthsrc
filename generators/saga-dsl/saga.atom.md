# kind: saga — tree atom design (new baseline)

Mirrors `kind: pipeline` (which maps to MonarchSpec). A saga atom defines
a TCC saga: ordered steps, each with prepare/commit/compensate phases.

## Shape

```yaml
kind: saga
id: lot-merge
name: "Lot Merge Saga"
name_zh: "批次合并 Saga"
description: "..."
# Saga-level
args_type: LotMergeArgs        # case class (fields in 08-message-detail)
error_type: String
context_type: AppSagaContext   # participant refs resolve from here
# Steps in order
steps:
  - id: reserve-lots
    name: "Reserve lots"
    participant_ref: lots       # field on context_type
    resilience:
      max_retries: 3
    phases:
      prepare:
        command: ReserveLots
        reply_type: LotsReserved
      commit:
        command: ConfirmLotReservation
        reply_type: LotsConfirmed
      compensate:
        command: ReleaseLotReservation
        reply_type: LotsReleased
```

## Mapping to SagaSpec (for emit.mjs)

| saga atom | SagaSpec |
|---|---|
| `id` | `name` |
| `args_type` | `argsType` (fields from 08-message-detail) |
| `error_type` | `errorType` |
| `context_type` | `contextType` |
| `steps[].id` | step `id` |
| `steps[].resilience.max_retries` | `maxRetries` |
| `steps[].phases.{prepare,commit,compensate}.command` | phase `command` |
| `steps[].phases.*.reply_type` | phase `replyType` |
| `steps[].participant_ref` | `participantRef` (saga-level; per-step override if needed) |

## What's NOT in the atom (intent boundary)

- Command argument expressions (`(txId, replyTo) => ReserveLots(...)`) — constructed by the emitter from command signatures in 08-message-detail + binding.
- `preCheck` logic, `mapReply` logic — from policy/command atoms or binding.
- Protocol message definitions — from 01/02/08 atoms (event/command/message-detail).

## Status

Design only. The fab tree has saga FRAGMENTS (TransactionInitiated/Completed/Failed
events, InitiateLotMerge/Split commands) but no unified saga atom yet. Promoting
the fragments to a `saga` atom is steward work (human).
