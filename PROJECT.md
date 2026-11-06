# Local project contract

The project config is the one current entry. Author knowledge lives in its tree;
canonical, complete product requests, compiled products, source indices, ledger
and anchors are derived. [AUTHORING.md](AUTHORING.md) defines the recommended
system/context format; [TUTORIAL.md](TUTORIAL.md) walks through an actual change.
The original first-batch results remain in [PROJECT-VALIDATION.md](PROJECT-VALIDATION.md).

## Commands

```text
truthsrc init <new-project-dir>
truthsrc compile-project --project <config>
truthsrc generate-project --project <config> --out <owned-dir> [--plan] [--update]
truthsrc status-project --project <config> --out <owned-dir>
truthsrc query-project --project <config> --out <owned-dir> --knowledge <identity-or-alias>
truthsrc query-project --project <config> --out <owned-dir> --file <relative-file> [--symbol <name> | --line <n>]
```

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
Multi-context generation, complete BC mixed-pipeline template parity and full
five-layer author completeness are not implicitly delivered; see [TEMPLATE-PARITY.md](TEMPLATE-PARITY.md).
Retry/backoff/deadline remains OPEN; no frozen runtime or 1134 sign-out is changed.
See [PROJECT-UNIFICATION-ACCEPTANCE.md](PROJECT-UNIFICATION-ACCEPTANCE.md) for actual
rounds/results and [PROJECT-OPEN-ITEMS.md](PROJECT-OPEN-ITEMS.md) for independent debts.
