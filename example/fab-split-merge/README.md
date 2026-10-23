# Fab split / merge design example

This is a newly authored **contract-only** example, not a recovered workshop history or a running application certification. The commands use the existing domain vocabulary, but durable receipts and strict decision semantics are desired additions. Bindings name fixture ports; they do not assert that saga-core 0.2 provides the listed strict capabilities.

The tree is the edit surface. Technical bindings stay outside it. Definition `v1`, args codec version and runtime artifact version are separate axes. Money uses an exact string codec, never JS Number or Double.

Split and merge have independent operation/transaction identities. Create the target child before transferring wafers, freeze the manifest before Prepare, run child Monarch work separately, and merge only its durable completed result. This example supports a static two-Lot participant set; multi-source expansion and live scheduling are not certified.

Validate and roundtrip with `node bin/truthsrc.js validate --tree example/fab-split-merge/tree` and `roundtrip`. Compile using `compile-sagas --tree ... --binding .../bindings.json --out /absolute/new-artifact.json`. Output must be outside the truth tree. Code generation, real participant receipts and cross-JVM business recovery remain separate gates.
