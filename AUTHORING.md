# Author format: systems, contexts and source evidence

`truthsrc.author/v1` is the recommended author format. Legacy `workshop.yaml`
(`truthsrc/v1`) and BC `metarch.yaml` (`metarch.truth.v1`) are compatibility inputs,
not alternate current models to edit alongside the new one. Project config remains
`truthsrc.project/v1`; the semantic projection and product versions are separate.

## Root and context

```yaml
kind: system
schemaVersion: truthsrc.author/v1
id: example
name: Counter
workshop: example-domain
sessionOrder:
  ["eventStorming", "commandStorming", "aggregateDiscovery", "subdomainExploration", "contextMapping", "refining", "storyMapping"]
contexts:
  ["example"]
```

Store this at `truth/example/system.yaml`. The corresponding
`contexts/example/context.yaml` declares `kind: context`,
`schemaVersion: truthsrc.context/v1`, `id`, `name`, and a nonempty
`responsibility`. System/context IDs are lowercase storage identifiers;
`name` is display text. System folder, declarations, project context and existing
explicit aggregate context must agree. Missing context is not silently injected.
The first profile supports **one context**; multiple contexts and cross-context
relationships are rejected rather than flattened into name-based lookups.

The existing atom grammar remains the small dependency-free `parseDoc`/`emitDoc`
grammar, not general YAML. Domain families live under the context:
`aggregates`, `value-objects`, `policies`, `stories`, `use-cases.yaml`,
`read-models`, `domain-services`, `sagas`, `pipelines`, `scenarios`, and registered
`formal-products` families. Existing structured guards, event bindings, folds,
exact values and formal contracts retain their meaning and versions.

System `inbox` accepts only the thirteen numbered coverage categories. It is not
necessary to create all thirteen directories. Domain rules already in slices
must not be copied to notes. An inbox README can explain omissions. Unknown
knowledge files, unsupported families, old/mixed inbox layouts and misplaced
context atoms refuse. The new reader preserves atom text and physical residence
in the **derived** canonical `authoring` surface; this is never another editable
model. Decompose verifies that this captured surface reprojects to the supplied
canonical before it can write. New-layout roundtrip checks paths as well as bytes.
Legacy canonical byte oracles remain unchanged.

New author input rejects duplicate root/nested/JSON keys before projection and
preserves explicitly quoted numeric identity strings. Its structural header sets
are closed; compiler-overwritten payload fields and unconsumed definitions reject.
Policy and note origins both require an explicit session stage and collision-free
frozen seq. Legacy parsing remains unchanged for byte compatibility.

## Meaning and identity

- Strategic DDD records boundaries and responsibilities, not JVM/DB deployment.
- Tactical DDD records aggregate invariants, commands, events and values.
- Saga means cross-aggregate transaction; pipeline means process orchestration.
- Stories/use cases/read models explain intentions and observations. Descriptive
  models are not automatically executable authorization or SQL projection DSLs.
- Product-design five-layer completion is optional and separate from these
  categories; proposals remain proposals.
- Implementation bindings, runtime coordinates and encodings remain explicit.
  Business limits and money rules are not inferred from technical precision.

`knowledge:<system>/<context>/<kind>/<owner...>/<id>` is a percent-encoded,
qualified **current declaration identity**, not a universal UUID promise. Existing
explicit identities are used in their own semantic domain; name-identified objects
need an explicit migration decision to preserve continuity through renaming.
Legacy `noteId`/header IDs are aliases; duplicate hits remain ambiguous. Frozen
`origin.seq` is not renumbered and is not promoted to permanent identity.
Ordinal-only rules are explicitly marked as such.

Each derived source index records the canonical snapshot SHA, canonical pointer,
physical atom and atom-object pointer. A fold uses its qualified event and target
field, so assignment reordering does not confuse `next0` with permanent identity.
Generated sources continue to carry `source:<document>#<pointer>` in file anchors.
`query-project` resolves these against the recorded snapshot, then compares scoped
identities with current source. Explicit story/use-case/read-model reference carriers
can lead to related generated files; the result labels those links as traceability,
not a claim that the narrative directly generated executable code. A request for
a line or `nextN` returns candidates,
not fabricated symbol/span certification.

## Content, source sites and legacy evolution

`payload` is the complete knowledge body, not an incremental revision. An old
`origin` records that occurrence's source-session position; it is neither the
concept's first appearance nor a reliable Miro identifier. Stage names classify
activities, while distinct session IDs identify specific activities.

Optional system provenance declares known sessions separately:

```yaml
provenance:
  {"schemaVersion":"truthsrc.provenance/v1","sessions":[{"id":"review-a","stage":"refining","sites":[{"provider":"miro","uri":"https://boards.example.invalid/review-a"}]}]}
```

The URI above is a synthetic example, not a real Miro endpoint. Any supported atom
may add `sourceRefs: [{"sessionId":"review-a","itemId":"known-item"}]` as a JSON
block. Multiple sessions at the same stage and multiple references are allowed.
Only explicit, known source data should be supplied. Missing real session IDs or
URIs remain absent; the compiler never manufactures them from stage, board1, path
or hashes. HTTP/HTTPS/URN references are validated as metadata, never fetched or
used to write back. Credentials and executable/file URI schemes are rejected.

These author-only references roundtrip in the author surface and appear as
`sourceLocations` on source-index/query origins, without entering business
products. A board URL plus item ID still reports board-level navigation, not an
invented item URL. A board ID without a URI reports navigation unavailable.
Neither references nor their order select merge precedence.

The seven known BC stage disagreements have an explicit optional compatibility
profile, **not two domain stage semantics**. `--legacy-stage-policy
bc-seven-legacy-carrier/v1` verifies the original seven source hashes and identities,
then carries unchanged old stage fields under exact occurrence markers and
`system.compatibility.metarch.noteStageSemantics`. Without the profile the strict
stage-equality rule remains. This is representation compatibility with BC's old
merge behavior, not approval of a new evolution algorithm; see
[BC-STAGE-DECISION.md](BC-STAGE-DECISION.md).

## Migration

```bash
node bin/truthsrc.js migrate-author --tree /absolute/legacy/tree \
  --format truthsrc/v1 --out /absolute/new/truth/example \
  --system example --context example --name Counter \
  --responsibility 'Own counter decisions and state transitions.' --plan
```

Remove `--plan` to create a **new** tree; existing targets and input/output overlap
refuse. Source inventory and plan semantic digest are rechecked before writing,
so a stale plan cannot silently migrate old data. Legacy source bytes are not rewritten. Semantic comparison excludes physical inbox/residence
and derived author surface, but preserves rules, order, identity, old note IDs and
stored decision/fold blocks. A business change is not a format conversion.
BC import uses an explicit `metarch.truth.v1` adapter, not the BC compiler at run
time. Five-object projection parity is distinct from BC full generator parity.
Unsupported structure refuses rather than falling back to the original tree.
See [COMPATIBILITY.md](COMPATIBILITY.md) for actual BC five-product parity, the
explicit seven-occurrence legacy policy, and the distinction between representation
migration and unresolved full-domain/default-consumer cutover.

## Ongoing development

```bash
node bin/truthsrc.js status-project --project /project/truthsrc.project.json --out /project/generated
node bin/truthsrc.js query-project --project /project/truthsrc.project.json --out /project/generated --knowledge SetCount
node bin/truthsrc.js generate-project --project /project/truthsrc.project.json --out /project/generated --update --plan
node bin/truthsrc.js generate-project --project /project/truthsrc.project.json --out /project/generated --update
```

The default non-update policy is unchanged. Explicit update requires the same
project/generator/kind and a successful per-file baseline. Only unchanged generated
bytes or valid MANUAL-only edits are admitted. Missing/edited source evidence,
foreign ownership, malformed/orphaned MANUAL blocks and non-MANUAL edits refuse
before writes. Omitted outputs are **retained**, never deleted automatically.
Preview and apply share preparation, with a last optimistic byte/absence check;
there is no cross-process lock, rollback or multi-file transaction.

`status-project` separates inputs/tool changes from code changes and missing
receipts. It does not certify runtime behavior or all external dependencies.
MCP tools `project_status` and `project_sources` expose these same read-only APIs.
No knowledge server or server ID allocator is required.
