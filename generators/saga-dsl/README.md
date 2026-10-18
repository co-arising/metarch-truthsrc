# generator: saga-dsl

Vertical slice of the new-baseline generator: **SagaSpec → Scala** (saga-core 0.2).

## Layering (honest)

```
truth tree (v0.5)
  → [tree → SagaSpec parser]   ← future work
  → SagaSpec JSON              ← the contract (this generator's input)
  → [emit.mjs]                 ← this generator
  → *.scala                    ← must match golden/saga-dsl shape
```

## SagaSpec

JSON describing one saga: name/version, package, error/context/args types,
steps (each with TCC phases → commands), preCheck. See `transfer.spec.json`.

The `prelude` field carries verbatim Scala from the event/command generators
(protocol types); `helpers` carries saga-local helpers. This keeps the layering
honest: the saga emitter does not invent the protocol.

## Verify

```bash
node emit.mjs transfer.spec.json /tmp/out.scala
# then compile /tmp/out.scala against saga-core 0.2 — must pass
```

The emitted code must be structurally identical to `golden/saga-dsl/TransferSaga.scala`.
