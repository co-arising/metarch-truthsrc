# Local project contract

The project config is the one current entry. Author knowledge lives in its tree;
canonical, complete product requests, compiled products, source indices, ledger
and anchors are derived. [AUTHORING.md](AUTHORING.md) defines the recommended
system/context format; [TUTORIAL.md](TUTORIAL.md) walks through an actual change.
The original first-batch results remain in [PROJECT-VALIDATION.md](PROJECT-VALIDATION.md).
Installation has one home: [README.md](README.md#install-the-local-cli).

For independently maintained code, `lib/handwritten-provenance.mjs` provides the
optional `verifyHandwrittenSources(root, request, entries, { generator,
allowedRelations })` API. The caller supplies explicit knowledge pointers,
per-file relations and rationale, plus its own generator identity and relation
policy. It verifies complete file membership, actual bytes and source pointers
through the existing anchor verifier without writing source or anchor files.
It does not infer semantic correctness, symbols, spans or runtime success.
Bank-specific counts, snapshots, schemas and financial policy stay in the bank
adapter; using this API requires neither a sibling bank checkout nor a JVM.
Node >=22.13.0 is checked before SQLite imports; help/version work without loading
application modules. Both 22.13.0 and 22.23.4 have been exercised with the local
Counter/installation/anchor/view suites; this does not certify every platform or banking service.

## Commands

```text
truthsrc init <new-project-dir>
truthsrc compile-project --project <config>
truthsrc generate-project --project <config> --out <owned-dir> [--plan] [--update]
truthsrc status-project --project <config> --out <owned-dir>
truthsrc query-project --project <config> --out <owned-dir> --knowledge <identity-or-alias>
truthsrc query-project --project <config> --out <owned-dir> --file <relative-file> [--symbol <name> | --line <n>]
truthsrc verify-project --project <config> --out <owned-dir> [--requirements <json>]
truthsrc view-project --project <config> --out <owned-dir> --html <new-file> [--tour <json>] [--knowledge <selector>]
truthsrc --help | help <command> | <command> --help
truthsrc --version
```

Every project command above, including `init`, accepts **one** `--format human|json`.
The default is still the original JSON result/schema; no extra prose is added to stdout.
The dispatcher removes only this presentation option before calling the original parser.
Unknown, duplicate and incomplete project flags refuse; format is not inferred from a TTY.
Help is used by itself and never creates an init destination or loads SQLite.
`generate` remains the separate ordinary-generator command, not a project shortcut.
`migrate-author --format` retains its grammar-selection meaning.

Human output summarizes actual sources, state, precision and next steps without dumping
plan content. Omitted successful details are counted and available via JSON; errors are
not abbreviated. A human formatter does not perform hidden compile/apply/graph repair.
Choose the output format before generation or export: rerunning a writing command is
not a read-only replay of its receipt.

- `init` creates `truth/example/system.yaml`, a declared `example` context and a
  small Counter model. Existing files/directories/symlinks refuse; failure leaves
  newly created partial data instead of deleting it. Validate and roundtrip run.
- `compile-project` captures one tree and explicit technical documents, derives
  the complete request and compiles all selected products; no source output.
- `generate-project --plan` runs formal producer admission without writing the
  target. Roundtrip creates/removes its own OS-temp tree, not retained cache.
- Actual generation publishes an immutable complete snapshot to the project's
  `.truthsrc/knowledge.sqlite`, reads it through `KnowledgeGraphStore`, and exports
  an integrity-checked AST before producer planning. The same store receives code
  anchors after core `applyEntries` verifies final source bytes. Preview uses an
  isolated in-memory store and does not create the output or project database.
  Repeating unchanged input produces zero source/evidence writes.
- `--update --plan` runs the same overwrite/merge preflight as apply and returns
  prospective actions. `--update` admits only same-project/generator/kind files
  whose recorded baseline matches current bytes or whose edits are confined to
  valid MANUAL blocks. No `--force`, automatic deletion, cross-process lock,
  rollback or cross-file transaction is provided. Omitted outputs are retained.
- Without `--update`, the original changed-unmarked-file refusal remains.
- Status/query are read-only, including no roundtrip temp tree. They distinguish
  code edits, changed inputs/tool, missing/invalid receipts and historical outputs.
  Supported line queries match verified final source spans. Unmapped lines and
  symbol-only queries remain candidates; no name-based semantic certification.

## Finite Play application projects

Copy `scaffold/play-application-project` outside the tool installation, then use
`compile-project`, `generate-project --plan`, generation, `verify-project` and
`query-project` with that copied `truthsrc.project.json`. The explicit
`scala-cqrs-play-application-v1` producer consumes ten products and the sole
configured author tree. It generates kernel/glue/ext/root build wiring, real
Play routes and Twirl, command/query services, a LevelDB journal reader and H2
readside ownership. The two external implementations stay in the author project's
`implementations/` directory, outside generated ownership.

API facts live in the `api-contract` formal atom; runtime versions, resource/PID
associations, configuration keys and construction ABI live in separate technical
bindings. Raw products cannot replace live project capture. All three input
surfaces participate in freshness and explicit updates; generated byte spans
navigate back to the actual author or binding. `verify-project` remains source
verification, never a build or runtime certification. Runtime startup requires
explicit local storage and credentials, with no production secret defaults.
See [the bounded application contract](docs/artifacts/scala-cqrs/PLAY-APPLICATION.md).

## Finite Saga/Monarch R2 projects

Copy `scaffold/saga-monarch-project` to a new owned directory outside the tool
installation. The explicit `scala-cqrs-saga-monarch-v1` producer consumes the
configured inventory author tree, eight versioned products, technical bindings
and live captured external implementations. Use `compile-project`,
`generate-project --plan`, generation, `verify-project` and `query-project` above.
Raw `generate-products`, including plan mode, cannot replace live project capture.

The generated kernel, glue and root assemble fixed Strict Saga and Monarch R2
artifacts; ext implementations remain caller-owned. Optional typed Runs retain
original inputs, checkpoints, outcomes and explicitly bound business leaves.
Cold Run query does not start recovery. Authorized `recoverRuns` activates the
original inner Runs; `resumeRuns` may wake the outer batch only after read-only
queries confirm their durable terminal results. Retry exhaustion is explicit;
no generic durable transaction/job deadline is promised. See [the finite
contract](docs/artifacts/SAGA-MONARCH-R2.md) for supply pins, supported shapes,
source navigation and separate generation/compilation/behavior evidence.

## Finite persistence/readside projects

Copy `scaffold/persistence-readside-project` to a new owned directory outside the
tool installation. Its configured Warehouse author tree is the sole business input;
`bindings/persistence.json` is a separate technical document selected through
`documents` and `roles`. The config explicitly selects all eight product versions
and `scala-cqrs-persistence-readside-v1`. Use the ordinary `compile-project`,
`generate-project --plan`, generation, verification and query commands above.

The producer emits kernel and glue modules, versioned persistence adapters and
serializer registration, H2 schema/repository/handler/runner, and separate build
and shape-test outputs. It does not require generation-time handwritten Scala or
reuse the module-seams mixed-input admission. Caller-supplied hosts, PID/resource,
DataSource, event source and execution context are runtime dependencies, not
inferred implementations or production journal configuration.

Changes to the author or technical binding make recorded output stale. A changed
wire layout requires an explicit compatible design/version decision; generation
never refreshes the expected wire pin automatically. Preview an authorized update
before apply. Final generated spans navigate to the actual author or binding,
including wire registration and index declarations. Inspecting these spans does
not execute Scala/JDBC or certify storage compatibility.

The batch remains under acceptance; its independent reference, generated and
installed runtime qualifications must be distinguished. See [the finite contract](docs/artifacts/scala-cqrs/PERSISTENCE-READSIDE.md).

## Finite module-seams projects

The explicit `scala-cqrs-module-seams-v1` profile uses a single Parcel author tree,
two versioned products and an explicit composition binding. Copy
`scaffold/module-seams-project` outside the tool installation root before using it.
Its seven generated production Scala files consume three user-maintained external
implementations; those implementations are never copied into the generated output.

Capture checks each declared source root's full membership, paths and byte hashes.
A serialized or cloned capture is display data, not permission to generate. Missing
or additional members, aliases and overlapping roots fail closed. Raw
`generate-products`, including `--plan`, cannot bypass this project admission.

Use `query-project --project <config> --out <owned-dir> --implementation <id>`
for external file-level provenance. `--file` remains limited to generated output.
Handwritten symbols and spans are not certified; generated final-byte spans still
navigate to the actual author or technical binding. Author, binding and handwritten
changes all require an explicit update. Moving a project requires recapture and
regeneration of its absolute build source roots; old receipts are not relocatable.
See [the finite module-seams contract](docs/artifacts/scala-cqrs/MODULE-SEAMS.md).

## Precision and freshness

- `inputs.state=current` means the captured project inputs/tool agree with the last
  generation; `changed`, `invalid` and `unknown` must not be presented as current.
- `evidence.state=verified` means the recorded graph/ledger/anchors agree. Missing or
  invalid evidence is not repaired by status/query/verify/view.
- Code file states (`unchanged`, `modified`, `manual-edited`, `missing`, `retained`)
  are separate from author changes. `synchronized` is a status predicate, not service health.
- Query-level `precision=span` means the requested line overlaps verified final-byte
  spans. Forward/file queries may have query-level `file` while individual locations
  carry verified spans. Inspect `locations[].verification`, `freshness`, `truthFreshness`
  and `origins[].current` together. A stale author cannot be called current merely
  because old generated code bytes still match.
- `span.start/end` are half-open UTF-8 byte offsets. Use actual bytes to calculate
  line numbers as in the tutorial. `nextN` is not a stable identity or type-resolved symbol.
- `candidates-only`, `ambiguous`, `unmapped`, `not-generated` and
  `source-evidence-unavailable` retain their meanings. `currentSelection` is current
  author knowledge, not evidence that code was generated. Narrative reference links
  are traceability, not a direct generation or execution claim.
- `runtimeVerified=false`: no project inspection/generation command certifies Scala
  execution, external dependencies at runtime or banking behavior.

## Read-only verification and view

`verify-project` calls the public `verifyProjectCli` adapter and returns
`truthsrc.project-verification/v1`, including `passed`, checks/diagnostics, source and
knowledge/generation snapshots, code digest, files and coverage. `--requirements <json>`
is an explicit input to that adapter for required knowledge coverage; the dispatcher
forwards it unchanged and does not invent a second requirements schema. `passed=false`
exits **2**, with the complete result still available in JSON. This is anchor verification,
not a code-build or runtime test. Invalid CLI inputs also exit 2 rather than printing success.

`view-project` calls the public `viewProjectCli` adapter. `--html` is required and must
name a new file; `--tour` supplies explicit presentation configuration and `--knowledge`
selects knowledge using the project's real selector contract. Neither option creates
business rules or guessed graph edges. The result identifies `file` and `snapshot`.
The only output write is the requested HTML; source, code, graph and anchors are not
rebuilt or overwritten. The self-contained page shows an **export-time static snapshot**,
not live disk synchronization. Input changes require fresh verification and a new export.
The HTML includes captured author/code excerpts: review them before sharing.

Keep the old export and use a new filename if the target already exists. On missing/stale
sources, inspect `status-project` and the full diagnostics first; if an explicit update
is appropriate, preview it before applying. Never hand-edit ledger/anchors or delete a
conflicting generated directory to make checks pass. Late I/O failure can leave partial
new output; a nonzero exit does not promise rollback.

## Config

Schema is `truthsrc.project/v1`. All keys below are required, unknown keys fail.
Product versions are explicit; no automatic dependency selection or latest profile.

```json
{
  "schemaVersion": "truthsrc.project/v1",
  "tree": "truth/example",
  "canonicalId": "example-domain",
  "context": "example",
  "products": [
    {"id":"reference-layout","version":"1"},
    {"id":"exact-value-types","version":"1"},
    {"id":"exact-value-codecs","version":"1"},
    {"id":"domain-decision","version":"4"},
    {"id":"domain-dependencies","version":"6"},
    {"id":"domain-folds","version":"6"},
    {"id":"domain-external-events","version":"2"}
  ],
  "exactTypes": [],
  "exactCodecs": [],
  "documents": [],
  "assemblies": [],
  "roles": {},
  "generator": "scala-cqrs-domain-v2",
  "options": {"packages":[{"context":"example","package":"example.domain"}],"verificationCases":[]}
}
```

`tree`, `documents[].file`, and explicitly relative `./`/`../` runtime repository
or service external-source roots resolve from the config file. The repository
path becomes a local `file:` URL and external roots become absolute before formal
producer validation. Other producer options retain their own explicit contracts.
CLI paths resolve from the caller's working directory.

The generator is a **shipped registered producer name**, not dynamic code loaded
from config. Ordinary custom generators use `init-generator` + `generate`; that
is not formal producer registration. Compile checks config/option names and product
semantics. Generation additionally validates producer-specific option values,
frozen runtime artifact bytes, external roots and the full source plan.

This profile supports a single explicit context. System declarations, physical
context directory, project context and required aggregate context must agree.
The compiler does not inject missing domain contexts. Layout references and
semantic bindings are derived from canonical identities and sources.

`exactTypes`/`exactCodecs` are existing explicit binding row shapes without `source`;
source is derived. Precision, scale, units, versions and encoding choices stay
explicit. Business policy versus technical capacity is explained by the model,
not guessed from a number. `documents` has only `{id,file}` technical binding
inputs for selected Saga/runtime/execution/child-plan roles. Canonical, decision,
fold, host, artifact and design snapshots are not accepted as technical inputs.
Public union assemblies remove the need to author embedded Saga copies.

## Evidence, path and ownership boundary

All project inputs are regular local files without symlink components; path
case/NFC aliases and input/output overlap refuse. Tree/config/documents are
bounded and must not change during capture or before apply. The owner must
coordinate exclusive writes to the output directory.

Generation emits these through the same apply call:

```text
.truthsrc/canonical.json
.truthsrc/request.json
.truthsrc/compiled.json
.truthsrc/inputs.json
truthsrc.ledger.json
anchors.json
```

`inputs.json` records input/tool hashes, snapshot-bound canonical→atom source
index and last-generated files. These four tool-evidence entries have no invented
knowledge ownership. Ledger rows record actual per-file ownership baselines;
anchors record associations and actual fingerprints. Evidence is not a secret
store or a tamper-proof signature: callers own these files, and changes/inconsistent
receipts are rejected. A copied output under another project/root does not silently
transfer ownership; generate it afresh.

`truthsrc.project-result/v1` wraps compilation or generation. Plans use
`truthsrc.project-plan/v1` because they combine admitted producer entries and
tool-owned evidence. Status/query use their explicit project schemas. Errors exit
nonzero without a successful receipt; late I/O failure can leave partial output.

## Verification and remaining boundaries

Run `npm run test:unification` for the explicit public suite. BC and full bank
integration require opt-in roots; normal tool tests do not require sibling repos.
Bank current configuration compiles all 14 products and selects the full Play
service producer; non-bank Counter tests independently prevent bank-only logic.

The tool requires no knowledge server. Project generation uses its embedded,
replaceable knowledge store; the legacy standalone `graph` display cache is not
that project contract. Building Scala applications still requires declared local
JDK/sbt/runtime dependencies. Source spans certify location, not business execution.
Multi-context generation and full five-layer author completeness are not implicitly
delivered. The Play service profile now has compatible Entity/Behaviors/Factory/
Bootstrap/local Actor repository layering plus optional explicit
`truthsrc.journal-readside/v1` `projectionStore` generation. SQL transactions,
checkpointing and typed PB replay are generated; application ownership, index
selection and view assembly remain explicit ports. Existing `service.projections`
is a different unsupported profile and still refuses nonempty declarations.
BC structural compatibility and its concrete exceptions—not byte-identical full
BC output or cluster sharding—are documented in [TEMPLATE-PARITY.md](TEMPLATE-PARITY.md)
and [COMPATIBLE-COMPOSITION.md](COMPATIBLE-COMPOSITION.md).
Retry/backoff/deadline remains OPEN; no frozen runtime or 1134 sign-out is changed.
See [PROJECT-UNIFICATION-ACCEPTANCE.md](PROJECT-UNIFICATION-ACCEPTANCE.md) for actual
rounds/results and [PROJECT-OPEN-ITEMS.md](PROJECT-OPEN-ITEMS.md) for independent debts.
