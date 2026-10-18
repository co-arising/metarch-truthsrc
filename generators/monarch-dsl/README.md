# generator: monarch-dsl

Vertical slice of the new-baseline generator: **MonarchSpec → Scala**
(monarch-persistence 0.2).

## Layering

Same contract as saga-dsl: `MonarchSpec JSON → [emit.mjs] → *.scala`,
output must match `golden/monarch-dsl` shape.

## MonarchSpec

JSON describing one resumable run: package, stage type + ordered stages
(each with a stable label and a `logic` Scala snippet for the state transition),
state type + fields. The per-stage `logic` is verbatim Scala — in the full
pipeline it comes from the tree's policy/command atoms; here it's the contract
boundary.

## Verify

```bash
node emit.mjs batchrun.spec.json /tmp/out.scala
# compile /tmp/out.scala against monarch-persistence 0.2 — must pass
```
