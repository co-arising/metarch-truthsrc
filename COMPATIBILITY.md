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
path and its OS-metadata reason, and still rejects unknown knowledge. Remove
`--plan` only for a **new owned destination**. No BC caches, source, service,
shared application or historical receipts are written.

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

## Actual BC author-cutover blocker

The full five-product oracle passes, but stricter **new author** admission found
seven existing `origin.stage` versus `payload.stage` disagreements. Both values
remain preserved by the legacy adapter; `report.authorConflicts` lists every one,
and public migration refuses before writing. No automatic stage correction or
compatibility exception is used to turn this red gate green.

- `SubmitDoRFindings`, `DoRFindingsSubmitted`: refining versus storyMapping.
- `KnowledgePatch`, `OrganizationMember`: refining versus aggregateDiscovery.
- `AI Agent`: refining versus commandStorming.
- `System`, `SystemOperator`: refining versus storyMapping.

These are historical author-meaning decisions for the BC owner, not permission to
rewrite existing knowledge. A source-meaning conflict is not fixed by letting the
new reader silently select one side; the legacy adapter preserves both and reports
all seven. Consequently **full BC physical author migration and operational cutover
are not complete**. Synthetic coherent BC input migrates;
Actual five-product projection parity still passes without discarding these facts.

The 2026-11-05 scoped investigation is recorded in [BC-STAGE-DECISION.md](BC-STAGE-DECISION.md).
BC's Note contract calls the payload stage informational, while its ingest guidance
requires equality and MergeEngine actually uses that stage for precedence. Therefore
neither automatic normalization nor an unqualified dual-stage exception is safe.
The decision document pins all seven source identities/hashes and recommends an
explicit dual-stage contract without changing their current values; owner approval
and real consumer-result comparison remain required.

BC owner cutover remains a separately coordinated operation: all active BC
consumers must read machine-derived products of the new author model, pass the
full preserved profile and stop editing the old model. This implementation does
not change BC's active EP or overwrite its current source/cache. Do not call the
workspace's two active toolchains globally unified merely because this adapter
passes; author import/projection parity and operational BC cutover are separate.
