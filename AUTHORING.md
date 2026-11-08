# Author format: systems, contexts and source evidence

`truthsrc.author/v1` is the recommended author format. Legacy `workshop.yaml`
(`truthsrc/v1`) and BC `metarch.yaml` (`metarch.truth.v1`) are compatibility inputs,
not alternate current models to edit alongside the new one. Project config remains
`truthsrc.project/v1`; the semantic projection and product versions are separate.
For your first project, follow the two-step [Counter tutorial](TUTORIAL.md), not a
legacy tree example. CLI installation and the Node >=22.13.0 version gate are
specified in [README.md](README.md#install-the-local-cli), including separately
executed 22.13.0/22.23.4 checks and their scope. The format itself is not runtime certification.

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

## Finite persistence/readside author contract

`scaffold/persistence-readside-project/truth/persistence-readside/` reuses the
Warehouse Reserve/Commit business facts. Command guards, event bindings, state
and folds stay in their existing author atoms. Do not add warehouse identity to
business payloads merely to satisfy storage layout, or copy folds into a separate
projection model. `ReservationIdentity` remains an explicit host port.

Versioned frame registrations, expected wire-layout pins, serializer ID and the
finite `truthsrc.journal-readside/v2` store/index selection belong in the separate
project technical binding, not the author tree. The index references an existing
state-map field; it does not redefine that field or accept arbitrary projection
code. PID/resource are caller-supplied opaque runtime identities, not evidence of
business ownership. Every author edit still requires validate **and** roundtrip;
product/lowering checks and actual runtime qualification are additional gates.
See [the bounded contract](docs/artifacts/scala-cqrs/PERSISTENCE-READSIDE.md).

## Finite module-seams author contract

The opt-in Parcel example is `scaffold/module-seams-project/truth/module-seams/`.
Its eight value definitions live only in `value-objects/*.vo.yaml`; seven records
retain `name/fields[{name,dataType}]`, while the closed sum uses the explicit
`truthsrc.signature-value/v1` shape. The `module-seams-contract` formal atom under
`formal-products/` declares ports and references these values; it does not repeat
their fields. Compilation emits the separate `canonical.moduleSeamsContracts`
collection, not a second editable model or an upgrade of legacy `canonical.ports`.

This finite signature supports String/Boolean/Long, declared nominal records and
closed sums, and Option/Vector/Map/Either. Recursion, open sums, defaults,
overloads and arbitrary external Scala types are rejected. Technical constructor
bindings and handwritten implementations are separate project inputs, never
business atoms or copied method signatures. Author changes require both validate
and roundtrip; author, binding and implementation changes each make generated
project evidence stale until an explicit update. See [the finite contract](docs/artifacts/scala-cqrs/MODULE-SEAMS.md)
and [project capture](PROJECT.md#finite-module-seams-projects).

## Finite structural sharing

An explicit system `authoring` block can select `structures: "truthsrc.structure/v1"`.
Only then may a context contain `structures/<id>.structure.yaml`. Each structure
has `kind: structure`, the selected `schemaVersion`, an `id`, and a `payload` with
`constants`, `templates`, and `atoms`. These are author inputs, not compiled caches.

Templates have ordered `parameters` and a JSON `body`. `$arg` substitutes an exact
row cell, `$value` copies a named constant, `$literal` quotes arbitrary JSON, and
`$object` constructs ordered key/value pairs with duplicate rejection. `$rows`
selects a template and explicit rows; it splices when used as an array element.
Templates cannot call templates. Constants and row arguments are opaque data,
not executable scripts. Definitions may be shared using `structure-id/name`.
All versions, business policies, array order, codecs and implementation choices
remain explicit. Unknown instructions, unused definitions, missing arguments,
collisions and budget excess refuse before generation.

`atoms` expands into standard `{file, doc}` declarations. Those virtual paths
preserve canonical ordering but are not additional files for authors to edit.
The source-index/v2 associates expanded knowledge with real template/row/scalar
locations, allowing many knowledge nodes to share one author declaration.
`decompose` retains the original compact bytes only after re-expansion agrees
with canonical semantics.

`truthsrc compact-author --tree <tree> --groups <selection.json> --plan` previews
an explicit list of `{id, files}` groups. `--out <new-system-root>` writes a new
candidate; `--in-place` applies a freshly checked plan to its source. This is an
explicit source migration, not the generated-code writer. It refuses semantic
changes and stale inputs; filesystem changes are not a multi-file transaction.

## Scoped micro syntax

The system may also select `authoring.micro: "truthsrc.micro/v1"`. Only declared
signature, rule, binding, fold and formal schema positions interpret this syntax;
notes, descriptions, examples and literal default values remain ordinary data.
Structural expansion occurs first, then micro syntax lowers to the unchanged
semantic AST. Source mappings compose the two layers.

Use `truthsrc compact-yaml --tree <tree> --plan` to preview, or `--out <new-tree>`
for an independent candidate. `--in-place` applies a fresh source-bound plan.
The migration edits identified JSON values without reformatting unrelated text.
Original compact text is retained by `canonical.authoring.files`; decompose
re-expands and checks semantics before restoring exact bytes.

Examples of JSON string values in their respective supported fields:

```json
"amount: Money @BUSINESS_INPUT"
"@ref(bankwealth:event-slot/CreditBalance/ReserveFundsConfirmed#txid)"
"@pin(bankwealth:port#BalanceAfterReserveFunds@bank-v1-1)"
"@type(optional:nominal:bankwealth:type#Money)"
"reservedAmount := @fold[put](key=\"event.txid\", value=\"event.amount\")"
"memo := @fold[set](value=\"literal:hello, world\")"
```

Reference segments are percent-encoded; quoted JSON strings preserve punctuation,
Unicode and delimiters in expressions. Duplicate/unknown/missing arguments and
unsupported operations fail with file/pointer context. Expressions are data, never
JavaScript evaluation. An object whose optional fields or key order cannot be
represented exactly remains explicit; authors do not need two alternative spellings
just to remember historical JSON key order. Schema/product semantic checks remain
mandatory after expansion. Compact syntax is not supported in arbitrary JSON slots.

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
not a claim that the narrative directly generated executable code. A line query
matching verified final source bytes returns `precision: span`; unsupported positions
and symbol-only `nextN` queries remain `file` / `candidates-only`. A precise span is
not unique-symbol or runtime certification. `span.start/end` are half-open UTF-8
byte offsets, not line numbers. Source `current` and code freshness are separate;
see [PROJECT.md](PROJECT.md#precision-and-freshness) for the result contract.

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

From your own `counter-lab` created in the tutorial, using the installed CLI:

```bash
truthsrc status-project --project truthsrc.project.json --out generated --format human
truthsrc query-project --project truthsrc.project.json --out generated --knowledge SetCount --format human
truthsrc generate-project --project truthsrc.project.json --out generated --update --plan --format human
truthsrc generate-project --project truthsrc.project.json --out generated --update --format human
```

Inspect the plan before applying; errors do not authorize deleting existing output.
The default output remains JSON. Only project commands use `--format human|json`;
`migrate-author --format` above still selects the input grammar, not presentation.

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
