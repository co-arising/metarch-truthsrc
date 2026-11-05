# BC author compatibility — explicit, file-only boundary

The recommended author tree is `truthsrc.author/v1` with system/context roots.
The BC `metarch.truth.v1` reader is a compatibility adapter, not a forked business
compiler and not a new default BC runtime input.

```bash
node bin/truthsrc.js migrate-author \
  --tree ../backkend-codegen/truth/metarch --format metarch.truth.v1 \
  --out /absolute/new/truth/metarch --system metarch --context main \
  --name Metarch --responsibility 'Own the Metarch self-hosting knowledge model.' \
  --ignore-os-metadata --plan
```

Without `--ignore-os-metadata`, unknown files (including `.DS_Store`) refuse. The
explicit exception recognizes only regular `.DS_Store`, reports every skipped
path and its OS-metadata reason, and still rejects unknown knowledge. With unresolved
new-author conflicts, `--plan` emits a complete JSON assessment and exits **2**;
it does not create the destination or its parents. The assessment is deliberately
not writable. A coherent input keeps the admitted migration-plan result and exits 0.
Remove `--plan` only for a **new owned destination** after every author blocker is
resolved. No BC caches, source, service, shared application or historical receipts
are written.

The compatibility adapter reconstructs BC's five products from the common
canonical: `METARCH`, `TEMPLATE`, `READMODELS`, `STORIES`, `CONCERNS`.
Non-domain governance/envelope information is carried explicitly under the
system compatibility declaration. Business notes, models, decisions and folds
come from author atoms, never a raw historical fallback.

Preserved distinctions:

- Existing `origin.seq`, authors and header identities stay present.
- Note IDs are aliases; the actual BC tree has duplicate IDs. No merge/reissue.
- Stored decisions/folds are not necessarily derivable. An identical repeated
  fold remains in both author locations and is reported; conflicting definitions
  refuse rather than first/last-wins deletion.
- Single `contexts/main` and the admitted legacy structural vocabulary only.
  New runtime/semantic products not representable by this projection reject.
- Mechanical format preservation does not approve a new business decision or
  certify application execution.

Actual full-tree oracle is opt-in and read-only:

```bash
TRUTHSRC_BC_ROOT=/absolute/backkend-codegen \
  node --test test/metarch-compat.test.mjs
```

The test imports the external BC compiler **only as an oracle**, compares all
five objects and key/array/serialization order, and reports full coverage. Shipped
runtime code never imports the sibling repository.

## Source-bound preflight

`loadMetarchSnapshot()` parses the same original bytes that it hashes, including
explicitly ignored OS metadata in the evidence inventory. It rejects source
symlinks and hard links, records empty directories, and rechecks the capture before
returning. A source-bound plan accepts only the original snapshot and metadata
from that capture. Passing an older snapshot together with newer file hashes is
not an admissible migration. Copied or serialized BC plans must be replanned.

`assessMetarchMigration()` exposes this preflight without granting a write token:

- Every stage conflict includes the physical file, original-byte SHA-256, adapter
  atom path, header ID and payload noteId separately, complete origin and unchanged
  payload, and the exact JSON pointers. Missing contexts are separate blockers.
- Duplicate noteIds list **all occurrences** and remain ambiguous legacy aliases.
  Neither a file hash nor a snapshot pointer becomes a permanent knowledge ID.
- The file inventory maps every accepted input, root declaration and governance
  envelope, and explains ignored OS metadata. An unsupported destination remains
  an `unmapped` row with its own blocker and `completeFileMapping=false`; it is not
  silently placed according to payload stage. Proposed declarations are not approvals.
- Five product digests use BC's existing serialization: two-space JSON, no final
  newline for `metarch.json`, one final newline for the other four files.
- New-author admission/equality, independent BC oracle, Scala consumer checks and
  operational cutover are separate fields. A blocked author check is never labeled
  successful merely because the legacy compatibility projection worked. Here
  `ready` means representation migration is admitted; it does not certify that
  legacy domain-model diagnostics are absent. Validation findings remain visible
  before and after representation migration.

`verifyAuthorMigrationAssessment()` rechecks a live assessment; stored reports are
historical evidence, not reusable authority. Writing rechecks the complete capture
and the entire admitted plan, including compatibility and provenance fields. These
are preflight guards, not a cross-process lock or an atomic multi-file transaction.

The optional `test/metarch-consumer.test.mjs` runs the actual BC
`WorkshopStateJson`, `MergeEngine` and `AssemblyEngine` from a separately compiled,
fingerprinted classpath. It requires `TRUTHSRC_BC_CONSUMER_MANIFEST` pointing to an
explicit local `truthsrc.metarch-consumer-runtime/v1` test manifest. The manifest
binds the Java executable, exact ordered JAR/class-directory inventories, compiler
receipt and `test/fixtures/MetarchConsumerOracle.scala`. The test never starts sbt,
fetches dependencies, chooses a default cache or generates an application; without
that opt-in it skips explicitly. Each run needs a new evidence destination.

Typed-consumer equality does not replace five-product preservation: BC's reader
filters tombstones and its typed `ScopeState` does not carry `flowModel`. Equal
parsing failures are not parity. Stage-normalization and ID-only deduplication are
negative test inputs, not edits to the real tree or accepted semantic choices.

The 2026-11-05 real consumer run passed all six subcases (7 Node tests including
its parent): 1,592 input notes, 1,114 merged notes and 27 aggregates. Parsing, all
three merge projections and the complete assembly result were equal. Both
malformed inputs failed rather than producing a false successful comparison.
This result is scoped to the captured BC compile and compatibility inputs; see
[the acceptance ledger](PROJECT-UNIFICATION-ACCEPTANCE.md) for commands, failed
startup attempts and source/lifecycle evidence.

## Accepted source/content separation and remaining cutover limits

The seven historical stage pairs remain unchanged. User acceptance on 2026-11-05
selected **separate knowledge content, site provenance and evolution/merge rules**,
not two domain stages. The exact optional `bc-seven-legacy-carrier/v1` profile now
allows a source-bound representation migration of those seven occurrences. It is
selected explicitly with `--legacy-stage-policy`; absent that option, migration
still reports the seven blockers. Other stage disagreements are not exempted.

The profile pins original source hashes and occurrence identity during import.
The new system declares the compatibility policy, and each exact occurrence has
an author-only `legacyStageAnnotation`. All original payload content and ordering
remain unchanged. The marker merely documents why a historical stage carrier is
still supplied to the old BC MergeEngine; it is not a concept's discovery stage,
new maturity state or general override rule. See [BC-STAGE-DECISION.md](BC-STAGE-DECISION.md).

Actual migration produced 1,918 author files and passed physical roundtrip and
full five-product byte comparison. The real tree carries **258 hard diagnostics
and 657 notices under JS's general domain validator**; these were compared as
multisets with the pre-migration compatibility snapshot and are unchanged. No
gate was relaxed and no domain fact repaired to hide them. Representation
migration and BC compatibility consumption are supported; unrestricted JS-domain
generation of the Metarch system is not certified.

### Explicit source bundle

```bash
node bin/truthsrc.js export-metarch --tree /absolute/new/author/metarch \
  --out /absolute/new/products
```

This produces exactly five JSON products and `metarch-bundle.json`, version
`truthsrc.metarch-bundle/v1`. The manifest records the complete current author
file/directory inventory and all product SHA-256/byte counts. Its author root must
remain available; this is not a portable standalone offline artifact mode. The
producer rejects existing/overlapping outputs and never edits old source/cache.
The Node reader additionally recompiles the declared author root and compares the
five product bytes. All source and product checks are repeated before returning.

BC provides additive explicit read APIs:

- Node `loadProductBundle(manifestFile, readerModuleFileUrl)` loads the explicitly
  supplied local reader. No default sibling discovery or old-cache fallback.
- Scala `StateFileStore.loadBundle(Path)` verifies the manifest, complete source
  inventory and product bytes, then reads WorkshopState. It does **not** implement
  the JS author compiler or independently derive products from YAML.
- Scala `IngestedSystem.systemMetadataFromBundle(Path)` propagates errors rather
  than turning an invalid explicit bundle into an empty system.

These receipts establish consistency for trusted local compilation, not an
independent signature of authorship. Node and Scala read the same five-product
wire format, but their validation capabilities are explicitly different. No API
fetches source-site URIs or writes back to Miro.

## Selecting the normal BC readers

A `truthsrc.bc-input/v1` file selects the compatibility bundle for ordinary BC
readers. It is technical input configuration, not a second domain model or a
replacement for `truthsrc.project/v1` generation profiles:

```json
{
  "schemaVersion": "truthsrc.bc-input/v1",
  "mode": "bundle",
  "manifest": "/absolute/new/products/metarch-bundle.json",
  "reader": "file:///absolute/metarch-truthsrc/lib/compat/metarch-bundle.mjs"
}
```

Pass `TRUTHSRC_METARCH_INPUT=/absolute/selection.json` to the consuming process.
Without that variable, Node can discover `truthsrc.input.json` at the BC tool
repository root; Scala uses the current working repository root. Use the explicit
absolute file for embedded/cross-directory calls so both select the same input.
This increment does not install a repository default file. Invalid or empty
selection never means legacy fallback. The exact four keys, version, normalized
local paths, ordinary single-link files and canonical reader file URL are required.

Existing synchronous `loadMetarch/loadProducts/loadTemplate/loadReadmodels/`
`loadStories/loadConcerns/metarchBytes` read the selected five-product set. Each
call revalidates the source and product bytes and returns its own mutable copy,
so a legacy caller cannot poison a later result. Selection, manifest or reader
changes require a new process. The declared reader is trusted local executable
code, not a sandbox for untrusted plugins. Scala verifies its declaration and
bundle; it does not execute the JavaScript compiler.

`StateFileStore.load("metarch")` and `IngestedSystem.systemMetadata` use the same
selected input. Their selected errors do not turn into an empty success. Direct
`statePath` access and legacy `save` reject for that selected slot.

With a selection, `node tools/truthsrc/compile.mjs --check` verifies the selected
bundle and its source. It does **not** certify old-cache freshness. Writing cache,
legacy path overrides, and direct legacy `compileTree()` refuse. Historical
bridge/decompose, mixed cache readers, service/writeback and generation workflows
that have not been ported refuse before their effects; refusal is not completed
feature support. The BC [input-selection execution plan](../backkend-codegen/knowledge_base/exec_plans/active/EP_Truthsrc_Input_Selection.md)
lists this bounded coverage. Other standalone cache consumers, historical surgery
scripts and a relocated external collector are not covered by a whole-repository
cutover claim.

The preserved general JS diagnostics have distinct causes: V13 unknown-expression
syntax 180 (134 `system:now`, 46 other forms), V3 historical stage pairs 7, V11
read-model source requirements 17, and ES2 timeline requirements 54. They are
258 occurrences, not 258 unique defects or exclusively syntax mismatches. None
permits inventing missing facts; compatibility reading does not certify the
unsupported expression semantics. The 657 notices remain visible as well.

A selected-reader regression is available in the tool repository:

```bash
TRUTHSRC_BC_ROOT=/absolute/backkend-codegen \
  node --test --test-concurrency=1 test/metarch-input-selection.test.mjs
```

BC's `npm run test:truthsrc-input` exercises the selector, the bounded refusal
inventory and legacy service-sync fixture with a mocked HTTP boundary. Its static
placement checks are reported separately from executed CLI/adapter tests; neither
requires a running service. Real default-slot Scala consumption has a separate
source-bound oracle in `test/fixtures/MetarchSelectedInputOracle.scala`, compiled
against an explicitly captured BC classpath; the acceptance ledger records that
run rather than pretending it is included in the Node suite.

**BC-wide default cutover is not complete.** Supported readers and rejected
legacy operations now recognize an explicit selection, but the active author
location and complete historical consumer set have not been switched. A successful
bundle is not another current author tree to edit in parallel and not a
full-toolchain unification claim. Product structure/skeleton/surface definitions
and automatic external-source editing remain unimplemented product design work.
