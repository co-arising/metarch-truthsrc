# Local project entry contract — first batch (2026-11-04)

This batch implements the continuation §5 only. It does not certify a running
application, close the OPEN retry/backoff/deadline debt, or change frozen runtimes.
No service, download, shared generated application, or historical runner is used.

## Commands and author inputs

- `truthsrc init <new-project-dir>` creates `tree/` and `truthsrc.project.json`.
  The destination must not exist (even an empty directory or dangling symlink).
  It creates a small non-bank domain example, then validates and roundtrips it.
- `truthsrc compile-project --project <config>` is read-only and prints one JSON
  result with canonical, derived complete request, compilation and source evidence.
  The existing roundtrip gate creates and removes its own OS-temp directory; it
  does not write author inputs or retain a project cache.
- `truthsrc generate-project --project <config> --out <owned-dir> [--plan]`
  derives and compiles afresh, admits the shipped producer through the existing
  formal product generation path, and prints one JSON result. `--plan` writes no
  target or retained intermediates/cache (the roundtrip gate uses OS temp). Actual generation
  uses only `applyEntries`, with ledger and anchors based on accepted file bytes.

Config schema: `truthsrc.project/v1`. All keys are mandatory; unknown keys fail.
Config `tree` and technical-document paths are relative to the config, not the
current working directory. CLI `--project` and `--out` paths use the caller's
working directory; generated source options retain each producer's documented path
contract (e.g. service external source roots must be absolute).

```json
{
  "schemaVersion": "truthsrc.project/v1",
  "tree": "tree",
  "canonicalId": "example-domain",
  "context": "example",
  "products": [
    { "id": "reference-layout", "version": "1" },
    { "id": "exact-value-types", "version": "1" },
    { "id": "exact-value-codecs", "version": "1" },
    { "id": "domain-decision", "version": "4" },
    { "id": "domain-dependencies", "version": "6" },
    { "id": "domain-folds", "version": "6" },
    { "id": "domain-external-events", "version": "2" }
  ],
  "exactTypes": [],
  "exactCodecs": [],
  "documents": [],
  "assemblies": [],
  "roles": {},
  "generator": "scala-cqrs-domain-v2",
  "options": { "packages": [{ "context": "example", "package": "example.domain" }], "verificationCases": [] }
}
```

`generator` is a shipped directory name, not arbitrary executable code or plugin
registration. Ordinary custom generators retain `init-generator` + `generate`.
Product versions are explicit; requirements/capabilities/role schemas come from
`profileFor`, never from a second authored request. All dependencies must be
selected explicitly. Unsupported derivations or profiles fail; no implicit latest.

This first layout derivation supports one explicitly named context; conflicting
context declarations fail, rather than guessing cross-context references. `context`
is a reference-layout choice, not a default injected into canonical: semantic domain
products require explicit `context` on aggregate declarations, and nominal text/
external-record products require it on the corresponding value-object declarations.
Nominal types, aggregate/member/command/event references, ports, sagas, pipelines, formal
artifacts and product designs derive from canonical identities and source pointers.
Rules, dependencies, folds and formal product payloads derive from the tree.

`exactTypes` and `exactCodecs` retain the existing public exact binding row shapes
except `source`, which is derived and must not be authored. Precision, scale,
units, versions and representation identities remain explicit choices.
`documents` contains `{id,file}` for technical bindings only; `assemblies` and
`roles` use the existing public union and role-to-document contracts. No canonical,
reference, decision, dependency, fold, host, artifact, design or external-event
snapshot may be supplied as a technical document. External implementation/mapping
choices remain explicit and are not invented from narrative knowledge.

## Read/write and result boundaries

All inputs must be regular local files/directories without symlink components.
The tree must contain workshop.yaml, pass validate and roundtrip, and stay byte
unchanged. Input/config/source paths must be disjoint from the generated target
in both directions; the target cannot be an ancestor of the project or bindings.
Missing/invalid input, unknown options/profile or producer failure occurs before
any target write. No cross-process lock or cross-file transaction is promised.
The caller owns the output directory exclusively; existing MANUAL/KEEP policies
remain those of the core writer, not a new overwrite policy.

Actual generation also emits `.truthsrc/canonical.json`, `request.json`,
`compiled.json`, and `inputs.json` under the output through the same apply call.
They are derived evidence, not author inputs. Inputs evidence records source
paths and byte hashes, with no timestamps; no secrets should be put in config.
Ledger/anchors remain at the output root. Source/plan bytes are deterministic for
fixed source bytes, tool and options; different absolute source/output locations
may change input evidence and anchor repo paths. Runtime readiness remains the
compiler's static-only claim, never an application certification.

Compilation results include `schemaVersion`, `applied:false`, `canonical`,
`request`, `compilation`, `sources`, `validation`. Generation results include
`schemaVersion`, `applied`, `sources`, `validation`, and either `plan` or the core
apply `result`. The combined project plan uses `truthsrc.project-plan/v1`: admitted
producer entries plus four tool-owned evidence entries. The latter have no
knowledge ownership and do not masquerade as formally admitted source products.
Compilation checks config/option names and product semantics; generation additionally
checks producer-specific option values, local artifacts and the complete source plan.
Errors go to stderr and exit nonzero; no successful receipt on
failure. Formal application producers retain their existing frozen local artifact
and external-source checks even in plan mode. Source generation needs no BC
service; Scala build/run still needs its own JDK/sbt/runtime dependencies.

## Tests fixed before implementation

1. Fresh init: validate, roundtrip, compile and source-byte preservation; refuse
   existing directories/files/symlinks and malformed flags before writing.
2. Non-bank example: compile, plan without writes, apply, real file anchors,
   byte-identical repeat, source/option changes reflected in derived plan.
3. Refuse unknown fields/profiles/roles, missing technical input, invalid tree,
   output/input overlap and symlink aliases without damaging an existing target.
4. Reuse existing formal CLI and anchor regressions (explicit file list, never
   global test discovery or the paused bank domain-runner).
5. Read-only bank adaptation: consume current v1 tree and explicitly selected
   existing technical bindings; derive the complete 14-product request without
   using a historical complete request. Verify domain generation through the same
   entry. No bank/runtime source changes, no runtime publication, no Scala claim.

Node baseline for this delivery: >=22.5 (including the optional SQLite graph
cache); tests run locally on Node 22.23.4. Package/CI/README are aligned in this batch.

See [PROJECT-OPEN-ITEMS.md](PROJECT-OPEN-ITEMS.md) for the unchanged retry debt,
recorded BC/JS code-style and inline-anchor gaps, and deferred synchronization work.
See [PROJECT-VALIDATION.md](PROJECT-VALIDATION.md) for this batch's commands and outcomes.
