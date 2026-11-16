# Classic CQRS source scaffold @2

A shipped public product target for `classic-architecture@2`. It reads the same
lossless `truthsrc.classic-architecture-input/v1` metadata as the original @1
scaffold and adds value objects, invariant rules, and entity event handlers to
the existing protocol, command-helper, aggregate-behavior, and entity families.
It does not change the @1 manifest or its four-family output contract.

```sh
node bin/truthsrc.js generate-products \
  --request test/fixtures/classic-cqrs-v2/request-baseline.json \
  --generator generators/scala-cqrs-classic-v2 \
  --out /absolute/new/owned/output \
  --options-json test/fixtures/classic-cqrs-f1/options.json
```

The frozen example emits 15 complete Scala files plus the existing writer's
ledger and anchors. Cardinality comes from metadata, not from hardcoded example
names. A new output root is required for the byte-parity recipe; never use a
saved expected root, shared application, or an existing generated tree.

## Honest readiness

The manifest and trusted producer allow raw placeholders only for the exact
registered scaffold/product/version combination. The result explicitly reports
`classic-scaffold-only`, `runnable: false`. Query placeholders, incomplete rules,
helper prompts, raw duplicate imports, and original reply-construction defects
are intentional raw-parity evidence, not finished implementations.

No source content is copied from expected files. Immutable models carry original
metadata facts; builders resolve types and names; templates render syntax; the
shared assembly supplies the original CodegenMain header and source dependencies.
Unknown capabilities and undeclared/foreign references fail instead of becoming
inferred business rules. Formal folds and hash attachments are not inputs to
this target.

For the actual same-input byte evidence and unexercised branches, see
[the closeout](../../docs/codegen-parity/CLASSIC-V2-IMPLEMENTATION-CLOSEOUT.md).
The [archived references](../../test/reference/classic-cqrs-v2/README.md) originate
from real Scala CodegenMain runs. They are not curated business targets. Full
family/variant coverage, Plain FP/ScalaCheck quality, compilation, runtime use,
and author-to-code field mapping remain separately verified obligations.

On Darwin with Node >=22.13, the reproducible wrapper drives two public generation
commands and two strict whole-byte comparison commands under the existing
process supervisor:

```sh
node tools/codegen-parity/replay-classic-v2.mjs \
  --out /absolute/physical/repo/.rounds/new-classic-v2-replay
```

It also accepts an absent direct child of the physical system temporary directory.
Outputs, captures, and reports are retained; a nonzero exit never signs parity.
