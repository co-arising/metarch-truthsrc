# Classic CQRS F1 — frozen raw references

These are archival byte-parity assets, not a runnable banking application.
Each of `baseline/` and `timestamp-int/` contains **four complete Scala files**
copied byte-for-byte from a real Scala `net.imadz.codegen.CodegenMain.main` run.
No file was trimmed, reformatted, repaired, or regenerated from JavaScript.

## Exact boundary

The comparison paths in `scope.json` are:

- `app/net/imadz/banking/application/aggregates/CreditBalanceProtocol.scala`
- `app/net/imadz/banking/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala`
- `app/net/imadz/banking/application/aggregates/behaviors/CreditBalanceBehaviors.scala`
- `app/net/imadz/banking/domain/entities/CreditBalanceEntity.scala`

That is **4 compared files per variant, 8 saved Scala files total**. It is not
108-file application parity, 42-template parity, or a generated-application
compilation result. Each original raw run produced 108 regular files;
`provenance.json` retains the complete relative-path, byte-size and SHA-256
inventory for both runs. The other 104 files per run are inventory evidence,
not copied raw bytes and not compared parity files.

Keep each expected comparison root limited to its four Scala files. README,
provenance, scope and manifest belong here in the parent, never inside
`baseline/` or `timestamp-int/`. The scope has `expectedOnly: []` and
`actualOnly: ["anchors.json", "truthsrc.ledger.json"]`: a generated actual root
must contain the four Scala files plus exactly those two ancillary receipts.
Their presence is inventoried; their bytes are not parity comparison targets.
Hidden or other unexpected files are not ignored.

Raw defects are intentional evidence. In particular,
`Effect.reply(cmd.replyTo)(???)` and the wrong
`CreditBalanceConfirmation(param, Some(error))` / `(param, None)` reply
construction remain unchanged, as do duplicate imports, comments, spacing,
trailing whitespace, and the `CodegenMain:parity-f1-cc335eb1` headers. Do not fix
these files or update the golden references from JavaScript output.

## Inputs and provenance

The matching inputs are in `test/fixtures/classic-cqrs-f1/`:

| File | Original bytes | SHA-256 |
| --- | ---: | --- |
| `baseline.json` | 159364 | `860aac654a4877fef37d933afb058424b6017efecd7becc0a5595f772b33dc02` |
| `timestamp-int.json` | 159363 | `51c5cb9de55e99b04cf79c46b1cfa389305a1db63689a22ea072aca98d5b5954` |

These are complete `SystemMetadata` exports, not reduced examples.
`request-baseline.json` and `request-timestamp-int.json` use the existing
`truthsrc.product-input-files/v1` contract, with one `classic-architecture`
product and relative document files `baseline.json` / `timestamp-int.json`.
`options.json` is the exact 167-byte copy of the original JS input options,
including its generator version and null knowledge release.

The original Scala source commit is
`cc335eb1e0d0fae17bf092fd61b126040196ea70`. The provenance records the 706-file
source closure, the 283 checked baseline snapshots with zero overlays, the
exporter source SHA-256, and pinned export/generation receipts. Input capture
used `truthsrc.codegenparity.ClassicMetadataExport.main` over
`net.imadz.meta.Examples.bankingSystem`, not a generated-file parser or builder
substitute. The variant changes only `BalanceChanged.timestamp` metadata from
`LongType` to `IntType`. In the four-file slice only the entity changes; the
full raw run also changes `app/protobuf/credit_balance.proto` outside this slice.
This is a type-input probe, not a banking time-semantics migration.

`provenance.json` embeds selected structured evidence and both complete raw
inventories. Its absolute source/receipt paths are **historical local-only
locations, not relocatable receipts**. Full process receipts, compiler classes,
and complete raw trees remain at those original locations. The saved fixture
and reference paths are repository-relative and reusable without those local
locations. Environment values and personal credential stores are not archived.

`manifest.json` lists repository-relative sizes and SHA-256 hashes for every
other saved asset (it excludes itself). Its copy records point to the exact
source bytes and, where applicable, the original manifest entry. It is an
integrity inventory, not an execution or correctness certificate.

## Public CLI reproduction — new output only

Prerequisites: this checkout with the public classic generator and comparator,
Node **>= 22.13.0**, Python 3 for the optional archive hash audit, and owned/idle
output directories. Run from the physical repository root. Do not use aliases,
symlinks, hardlinks, mount aliases, or overlapping comparison roots. Do not run
these commands into either saved asset directory or an existing actual root.

The following commands are documentation for later reuse; they were **not
executed during asset preservation**. No generation, comparator CLI, test suite,
JVM, or application build was run to save these assets.

```sh
set -eu
J="$(pwd -P)"
export J
F="$J/test/fixtures/classic-cqrs-f1"
R="$J/test/reference/classic-cqrs-f1"
test -f "$J/bin/truthsrc.js"

# Optional portable integrity audit; reads only the archived assets.
python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
j = Path(os.environ['J'])
m = json.loads((j / 'test/reference/classic-cqrs-f1/manifest.json').read_bytes())
for row in m['files']:
    p = j / row['path']
    assert p.is_file() and not p.is_symlink(), p
    data = p.read_bytes()
    assert len(data) == row['bytes'], p
    assert hashlib.sha256(data).hexdigest() == row['sha256'], p
print('Archived asset hashes match:', len(m['files']))
PY

# Canonicalize TMPDIR as well (important on macOS). Children do not yet exist.
RUN="$(mktemp -d "${TMPDIR:-/tmp}/classic-cqrs-f1.XXXXXX")"
RUN="$(cd "$RUN" && pwd -P)"

node "$J/bin/truthsrc.js" generate-products \
  --request "$F/request-baseline.json" \
  --generator "$J/generators/scala-cqrs-classic" \
  --out "$RUN/baseline" \
  --options-json "$F/options.json"

node "$J/bin/truthsrc.js" generate-products \
  --request "$F/request-timestamp-int.json" \
  --generator "$J/generators/scala-cqrs-classic" \
  --out "$RUN/timestamp-int" \
  --options-json "$F/options.json"

# Exact whole-file byte comparison. Reports stay outside BOTH compared roots.
node "$J/tools/codegen-parity.mjs" \
  --expected "$R/baseline" \
  --actual "$RUN/baseline" \
  --scope "$R/scope.json" \
  --report "$RUN/compare-baseline.json"

node "$J/tools/codegen-parity.mjs" \
  --expected "$R/timestamp-int" \
  --actual "$RUN/timestamp-int" \
  --scope "$R/scope.json" \
  --report "$RUN/compare-timestamp-int.json"
```

The comparator uses raw `Buffer.equals`, with no trim, header removal, newline
conversion, or text normalization. It inventories every file. Exit 0 confirms
only the four scoped files' byte equality and declared inventory; exit 1 means
bytes/inventory differ; exit 2 means blocked input, I/O or recheck failure. A
report saying `equal` is not a pass if the process exits nonzero. Reports must
be new files; reruns need a fresh output directory. This portable scope omits
machine-specific `sourcePins`, so comparison alone makes no source-pin claim;
use the archive manifest and provenance for origin/integrity evidence.
