# Money transfer design example

This is a newly authored **contract-only** example, not a recovered workshop history or a running application certification. The commands use the existing domain vocabulary, but durable receipts and strict decision semantics are desired additions. Bindings name fixture ports; they do not assert that saga-core 0.2 provides the listed strict capabilities.

The tree is the edit surface. Technical bindings stay outside it. Definition `v1`, args codec version and runtime artifact version are separate axes. Money uses an exact string codec, never JS Number or Double.

The real legacy transfer host is playAkkaCQRS, not bank-batch-transactor-demo. CommitDecision precedes all Commit calls; after the decision, only forward reconciliation is safe. Release/Cancel only undo reservations, not completed transfers.

Validate and roundtrip with `node bin/truthsrc.js validate --tree example/saga-money-transfer/tree` and `roundtrip`. Compile using `compile-sagas --tree ... --binding .../bindings.json --out /absolute/new-artifact.json`. Output must be outside the truth tree. Code generation, real participant receipts and cross-JVM business recovery remain separate gates.
