# CODEGEN — the generator contract (reference implementation: scala-cqrs-es)

> Ruling (2026-10-12): the codegen layer ships **fully open-source**, MIT, inside
> this project. Custom third-party generators are first-class: any tool that
> implements the contract below is a generator, whatever language it's written in.

## Position in the pipeline

```text
tree/ ──compile──► canonical.json ──(schema v0.2/v0.3)──► compiled products
                                                             │
                              ┌──────────────────────────────┘
                              ▼
                    GENERATOR CONTRACT  ◄── any generator: built-in, yours, your LLM agent's
                              │
                              ▼
                    generated files + anchors manifest ──writeback──► tree (@knowledge anchors)
```

## The contract

A generator is a deterministic function over the **compiled products**:

| | |
|---|---|
| **Input** | `canonical.json` (schemaVersion ≥ the generator's declared input) + the product files it declares (template / read-models / stories — JSON, byte-stable by I1) |
| **Output** | a file set written to a target directory + an `anchors.json` manifest (`knowledgeId → {file, line}` per generated element) |
| **Determinism** | same input bytes → byte-identical output. No clocks, no random, no environment reads. (Verified by golden-master diff, the same discipline the reference generator runs in CI.) |
| **Round-trip** | `anchors.json` is what lets code point back at the tree (`@knowledge` annotations) and lets edits in code be reconciled against knowledge (writeback). A generator that skips anchors is lossy and will be marked as such. |
| **Invocation** | a CLI: `generate --in <products-dir> --out <target-dir> [--plan]`. `--plan` prints the file plan without writing (the dry-run gate). |

**Custom generators** declare a manifest:

```json
{ "name": "my-typescript-es",
  "inputSchema": "truthsrc/v0.3",
  "products": ["template", "readmodels"],
  "output": { "language": "typescript", "layout": "hexagonal" } }
```

and are invoked exactly like the built-in one. The reference generator is not
privileged — it is simply the first implementation of the contract.

## Generator manifest (v0.4 contract, normative)

`generator.json` sits at the generator root; the core discovers generators by
scanning `generators/*/generator.json` (plus `--generator <path>` for external
ones). **Core knows nothing about any specific generator** — separation is
enforced by the manifest, not convention:

| field | type | rules |
|---|---|---|
| `name` | string | required, slug-cased, unique across discovered generators |
| `inputSchema` | string | required, `truthsrc/vX.Y` — canonical version the generator consumes |
| `products` | string[] | required, subset of `template·readmodels·stories·useCases` — which product faces it reads |
| `artifactKinds` | string[] | required — the vocabulary of file kinds it emits (feeds the concerns protocol, see below) |
| `output` | object | required, free-form (`language`, `layout`, …) — descriptive, for humans and registries |
| `options` | object | optional — generator-specific flags, declared so `--plan` can echo them |

Validation is fail-fast: missing required field, unknown `products` entry, or
duplicate `name` → error before any file is written.

## Concerns: the change-impact → regeneration-scope protocol

A concern answers one question: *this piece of the truth source changed — which
generated faces must be regenerated?* It is **core-owned protocol, not a
generator detail**, in three layers:

1. **Vocabulary** — `artifactKinds` are declared by the generator manifest (§
   above). A new generator adding a new artifact face (say `openapi-docs`)
   extends the vocabulary by declaring it; nothing in core changes.
2. **Engine** — scope expansion (`concern = schemaCategories × flavors` →
   in-scope set) plus dependency closure (ledger rows carry `deps[]`;
   transitive closure to fixpoint, so cross-flavor dependencies like
   converter→protocol are never left behind). One implementation, in core.
   Semantics ported from the production-verified `concerns_lib` /
   `ConcernScopeLoader` pair.
3. **Presets** — a per-project registry (`concerns.json`) naming the concerns a
   project exposes (e.g. `event-journal-suite`, `api-layer`). Project config,
   never core state.

The **emission ledger** (written by `generate` during apply; one row per
emitted file: `path, kind, schemaCategory, families[], deps[]`) is what the
closure engine runs over — it doubles as the drift detector: a file on disk
with no ledger row is hand-written, and regenerating with `--concern` will not
touch it. Invocation:

```text
truthsrc generate --in products/ --out repo/ --generator scala-cqrs-es \
                  --concern aggregate-scaffold --families Loan
```

## Layout (v0.4)

```text
lib/                  # tree kernel (compile/decompose/validate/roundtrip — unchanged)
src/core/             # generation core, style-agnostic: canonical loader, manifest,
                      # plan (topological), diff-apply (MERGE-protected blocks), anchors,
                      # concerns engine, golden-master harness
generators/
  scala-cqrs-es/      # reference generator: generator.json + templates/ (data-first) + builders/
  _template/          # scaffold for custom generators (`truthsrc init-generator`)
golden/               # golden master: input canonical samples × expected output trees
```

Extension path = **drop in a folder with a manifest**; `truthsrc generate
--generator <name>` discovers and dispatches it.

## Reference generator: `scala-cqrs-es`

Extracted from the production implementation that generates a runnable
CQRS/Event-Sourced application (aggregates, commands, projections, read models,
persistence adapters, API layer, test scaffolding) from the compiled products —
**718 generated files, 2,291 tests green** in the reference workshop.

Extraction surface (audited 2026-10-12):

| | |
|---|---|
| Core | 229 Scala files / ~28.8k LOC (`CodegenMain` pipeline, template engine, golden-master verifier) |
| Path coupling | 8 files reference repo-local paths → replaced by `--in/--out` CLI contract |
| Metadata slots | 16 files name workshop-specific metadata slots → generalized to manifest-declared slots |
| Build | plain sbt, one test lib (munit); no framework lock-in |

Staged landing (each stage gated by the roundtrip discipline):

1. ~~v0.2~~ — **shipped**: command/role/policy notes, the structured policy atom, aggregates with `order` lists.
2. ~~v0.3~~ — **shipped**: slices (parameters, guards, event bindings, fold assignments), the single event pool with `extraEvents`, value objects, read models, stories, use cases. The template product is now fully expressible in-tree.
3. **v0.4** — `scala-cqrs-es` generator lands under `generators/scala-cqrs-es/` with its golden master; `truthsrc generate` dispatches.
4. **v0.5+** — community generators (TypeScript/ES first); generator registry.

The reference generator consumes `canonical.aggregates` (payload + commands +
events from the single pool) and derives decisions/folds with the formulas in
SCHEMA.md §The slice atom — the schema-richness gate is now open; v0.4 is the
port of the generator itself.

### Aggregate-skeleton kinds (inc3, byte-identical to live `CodegenMain`)

The generator emits eight `artifactKinds` per aggregate, each a byte-for-byte
port of the production template (verified against a fresh `CodegenMain` run, not
the checked-in `golden_master/` snapshot — that snapshot predates the
MANUAL-skeleton rework and is stale):

| kind | file | notes |
|---|---|---|
| `protocol` | `…/aggregates/<A>Protocol.scala` | commands + replies + `CommandHandler` alias; self-qualified `<Proto>.<X>` imports |
| `aggregate-root` | `…/aggregates/<A>Aggregate.scala` | `entityTypeKey` / tags / behavior wiring |
| `entity` | `…/entities/<A>Entity.scala` | `State` + `empty` factory + event family |
| `event-handler` | `…/entities/behaviors/<A>EventHandler.scala` | fold `state.copy` chain (Ruling A: fold exprs verbatim) + `AI_PROMPT` helper stubs |
| `repository` | `…/aggregates/repository/<A>Repository.scala` | `@ImplementedBy` trait |
| `factory` | `…/aggregates/factories/<A>AggregateFactory.scala` | sharding `entityRefFor` + ask-overload init method |
| `behaviors` | `…/aggregates/behaviors/<A>Behaviors.scala` | `runReplyingPolicy(<Rule>Rule, <Cmd>Helper)` groups + `queryBehaviors` for read-only commands, inside a MANUAL block |
| `command-helpers` | `…/aggregates/behaviors/<A>CommandHelpers.scala` | per-command `CommandHelper` with compilable mechanical skeletons in MANUAL blocks |

Two header lines mirror internal semantics exactly:

- `// @generated by CodegenMain:<generatorVersion>` — a **generator-side** fact
  (host repo id at generate time) supplied via the `generatorVersion` option;
  it never participates in any fingerprint/identity comparison (date fallback
  when omitted, mirroring the internal `GeneratorVersion`).
- `// @knowledge-release <kr>` — a **knowledge-side** fact read from
  `canonical.knowledgeRelease`; the line is omitted entirely when absent.

Cross-cutting framework location is `canonical.framework.base` (defaults to
`net.imadz.framework.common`); the reference golden uses `net.imadz.common`.

**Anchors:** this reference exercises the no-`noteId` path — the demo canonical
carries no knowledge ids, so `anchors.json` is `{}`, matching live output which
also emits no `@knowledge` annotations when metadata has no `noteId`. The anchor
mechanism itself lives in the core (`entry.knowledgeId → anchors[id]`); a
canonical that carries knowledge ids drives non-empty anchors with no generator
change. A generator that *has* knowledge ids but drops them is lossy and marked
as such per the Output contract above.
