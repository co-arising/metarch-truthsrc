# scala-cqrs-classic-v4

`classic-architecture@4` adds ordinary aggregate repository Port and implementation to the seventeen-source @3 packet. It is a **raw source-scaffold profile**, not the formal Play-service or local Actor-repository profile. It does not migrate bank consumers or implement financial behavior.

## Public entry

Use the existing `generate-products` CLI, with explicit request, registered generator, absent exclusive output and original options:

```sh
node bin/truthsrc.js generate-products \
  --request "$PWD/test/fixtures/classic-cqrs-v4/request-baseline.json" \
  --generator "$PWD/generators/scala-cqrs-classic-v4" \
  --out "$PWD/.rounds/my-classic-v4-actual" \
  --options-json "$PWD/test/fixtures/classic-cqrs-f1/options.json"
```

Adding `--plan` renders a plan without applying or creating its output. This documentation is a recipe, not a receipt proving that a command ran. Actual write mode applies all declared entries plus `anchors.json` and `truthsrc.ledger.json` in the new output root.

The reproducible public core uses `tools/codegen-parity/replay-classic-v4.mjs --out <new-canonical-root>`: four real generations and six full-file comparisons. It requires Node >=22.13 and the Darwin bounded sandbox; the acceptance window pins Node 22.23.4. There is no unsandboxed fallback or automatic retry.

## Source and input contract

- Exact product version `4`, payload `truthsrc.classic-architecture/v4`, capability `classic-source-scaffold@4`, target `scala-cqrs-classic-scaffold@4`.
- Input remains complete `truthsrc.classic-architecture-input/v1`, retaining original metadata, constructor tags, ordering and unused fields. Requests reference the unchanged F1 baseline/timestamp-int inputs.
- Reuse the @3 pure, unstamped source-artifact builder; add Port from `application.repositories` and implementation from `infrastructure.repositories`. Only `AggregateRepositoryMetadata` is selected. Projection repositories remain retained and are not emitted here.
- Use explicit immutable Model/Builder/Template modules, shared TypeRefs/FieldDefs/naming/knowledge helpers, and the existing complete-file assembly and apply funnel.
- Older @1/@2/@3 products, manifests, placeholder guards and source contracts are unchanged. @4 has its own exact manifest and trusted producer marker.

## Bounded repository admission

A selected repository requires an identical, unique opposite-layer declaration, a declared emitted aggregate, and null storage. Non-null aggregate repository references must identify the corresponding declared pair. A reference alone does not create output; no declarations with a null aggregate reference means no repository files.

Declared QueryMethods require exactly one required, non-generic parameter, no `optionalWhen`, non-keyword method/parameter identifiers, and `EntityRef` with one `CommandFamilyRef` pointing to that aggregate's actual declared command family. Unknown references and shapes that the raw implementation would drop or misrender are rejected. Query parsing happens before replacement of a declared `entityRef`; zero-parameter `entityRef` is therefore rejected. UpsertMethod is retained but ignored, not implemented.

The port prints query intent and abstract declarations. The implementation uses the fixed original `sharding.entityRefFor(Aggregate.entityTypeKey, parameter.toString)` RHS, not the input referenceCode. It neither asks nor persists, publishes, replies, creates ActorSystems, or owns lifecycle cleanup.

## Byte preservation is not type correctness

The independent expected packet contains nineteen complete Scala files per input: baseline 43037 bytes, timestamp-int 43036 bytes; thirty-eight Scala files total 86073 bytes. The two new files are binary-preserved original successful CodegenMain output, not JS-generated expected or curated snippets. See `test/reference/classic-cqrs-v4/README.md` and its portable provenance/manifest.

Keep raw duplicate `EntityRef`/`ImplementedBy` imports in Port, distinct imports in implementation, and their different trailing-LF rules. Most importantly, the original default-family discrepancy remains:

- Port refers to `CreditBalanceAggregateProtocol.CreditBalanceAggregateCommandFamily`, whose protocol object is absent.
- Implementation refers to `CreditBalanceProtocol.CreditBalanceCommandFamily`, whose member is absent.
- The actual protocol declares `CreditBalanceCommand`; the explicit input query uses that declaration.

Neither bad family is aliased or repaired. Source-owner prefix routing records file dependencies, not proof of a declared member. The nineteen-source packet is **not type-closed**. `@ImplementedBy` also preserves the raw application-to-infrastructure reference rather than certifying the user's target layering.

Readiness remains exactly `{ level: 'classic-scaffold-only', runnable: false }`. Existing `???` is preserved raw output, only a future handwritten-isolation ownership candidate. No Plain FP, ScalaCheck, Scala compilation, financial oracle, application/runtime, common-core ABI, or bank migration certification follows from raw source parity. Changed-output independent Scala expected for the two new files remains separate from public plan probes.
