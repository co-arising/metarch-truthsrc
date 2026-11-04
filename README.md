# truthsrc

**Git-native Event Storming.** Your workshop board as a deterministic, diffable, agent-readable truth source.

```text
 workshop board (Miro / FigJam / wall)          LLM agent / human editor
        │  capture                                        │  edit
        ▼                                                 ▼
 ┌───────────────────────── truth/<system>/ ────────────────────────┐
 │  one YAML atom per sticky note — hand-editable, reviewable,    │
 │  mergeable, and the ONLY place anyone ever writes to           │
 └────────────────────────────────────────────────────────────────┘
        │ compile                          ▲ decompose
        ▼                                  │ (byte-identical inverse)
 ┌──────────── canonical.json ─────────────┘
   pure machine projection · deterministic bytes · safe to delete
        │
        ▼   validate: stage rules (ES/CS/AG/RF/SM) + structural closure rules
   CI gate → merge → diff the PR like code
```

Sticky notes on a whiteboard rot: nobody can diff them, nobody can review a
change, and no tool — human or AI — can safely build on them. truthsrc gives
an Event Storming workshop a **truth source**: a directory of small YAML
atoms that compiles to a canonical JSON projection with a **byte-identity
roundtrip guarantee**, guarded by stage-vocabulary lint rules.

- **Diffable** — domain changes show up as reviewable PRs, one note per file.
- **Deterministic** — same tree in, byte-identical canonical out. Zero hidden state.
- **Agent-readable** — the repo ships an [AGENTS.md](AGENTS.md) contract so LLM
  agents can edit the truth source autonomously, with mechanical gates to keep
  them honest.
- **Zero dependencies** — the whole toolchain is plain Node ≥ 22.5 (including SQLite graph queries).

## The four guarantees

| # | Invariant | What it means |
|---|---|---|
| I1 | Byte-deterministic | `compile(tree)` → identical bytes, every time, on every machine. |
| I2 | Roundtrip identity | `decompose(compile(tree))` ≡ `tree`, byte for byte. The canonical projection can never drift from the tree. |
| I3 | Payload verbatim | The compiler never rewrites your content — it only orders and projects. |
| I4 | No hidden state | The tree is everything. `canonical.json` is a build artifact; delete it whenever. |

`truthsrc roundtrip` enforces I1+I2 on every run — that's the gate your CI runs.

## Quickstart (local project, no download)

From this source checkout, with Node ≥ 22.5:

```bash
TOOL="$PWD/bin/truthsrc.js"
node "$TOOL" init ../my-workshop      # destination must not exist
node "$TOOL" validate --tree ../my-workshop/truth/example
node "$TOOL" roundtrip --tree ../my-workshop/truth/example
node "$TOOL" compile-project --project ../my-workshop/truthsrc.project.json
node "$TOOL" generate-project --project ../my-workshop/truthsrc.project.json --out ../my-workshop/generated --plan
node "$TOOL" generate-project --project ../my-workshop/truthsrc.project.json --out ../my-workshop/generated
```

The Counter example's author inputs are `truth/example/` and `truthsrc.project.json`.
Start with [AUTHORING.md](AUTHORING.md): `system.yaml` names the system and
`contexts/example/context.yaml` declares the context responsibility. Old
`workshop.yaml` trees are explicit compatibility inputs, not a second current
model to edit. The output contains source files, derived `.truthsrc/` evidence,
`truthsrc.ledger.json` and actual-file `anchors.json`. Do not edit the canonical
projection or derived requests. See [PROJECT.md](PROJECT.md) for configuration,
explicit technical bindings, read/write boundaries and result shapes.

`--plan` does not write the target. The roundtrip gate uses a disposable OS-temp
directory, not a project cache. After a supported knowledge/options change, run
`status-project`, inspect `generate-project --update --plan`, then apply
`generate-project --update`. Update only replaces the same owner's unmodified
generated files; valid MANUAL blocks are preserved, conflicting edits refuse,
and no-longer-generated files remain explicitly retained. Default generation
without `--update` keeps the original refusal policy. Use `query-project` for
snapshot-bound knowledge↔file provenance; a line or `nextN` query returns candidates,
not symbol-level certification. See [TUTORIAL.md](TUTORIAL.md) for a runnable loop.
No BC service is required to generate source. This does not certify a runnable
application or remove the separate JDK/sbt/runtime build prerequisites. Formal
application producers retain their frozen local artifact checks; retry/backoff/
deadline completion remains OPEN.

A PR that adds an event looks like this — reviewable by any domain expert:

```diff
+kind: note
+type: event
+name: "LoanApproved"
+origin:
+  stage: eventStorming
+  board: board1
+  seq: 1
+payload:
+  {
+    "type": "event",
+    "name": "LoanApproved",
+    ...
+  }
```

## Quickstart (agents)

LLM agents are first-class clients of this format. The machine contract lives
in [AGENTS.md](AGENTS.md) — point your agent at it. The short version:

1. The **tree is the only edit surface**. Never hand-edit `canonical.json`.
2. Batch edits go through a script; every batch ends with
   `truthsrc validate && truthsrc roundtrip` — both green or the batch didn't happen.
3. Atom filenames are determined: `type-<stage-code>-<slug(name)>-<seq>.yaml`.
   Never invent names; derive them.
4. "It's not in the tree" requires evidence: run `truthsrc compile` and grep the
   canonical output before claiming absence.

```bash
# From this checkout; no package installation or service is required.
node --test test/project-init.test.mjs test/project-cli.test.mjs
node --test test/semantic-product-files.test.mjs test/product-generation-cli.test.mjs
```

Use explicit test files for a scoped change rather than assuming global discovery
is a one-second, side-effect-free check.

## The format in 30 seconds

One file per sticky note (`SCHEMA.md` is the full contract):

```yaml
kind: note
type: event                     # event | question | command | aggregate | …
name: "LoanRequested"
origin:
  stage: eventStorming          # the workshop stage that owns this note
  board: board1
  seq: 0                        # frozen board order; gaps need not be renumbered
payload:                        # verbatim note JSON — compiler never touches it
  {
    "type": "event",
    "name": "LoanRequested",
    "description": "A customer submits a loan application for review.",
    "info": { "timeline": "Application", "sequence": 0, "step": 0, "pivotal": true },
    "links": ["question:what-happens-if-the-credit-check-fails"]
  }
```

Stage 01 (eventStorming) ships with the classic rules as executable lint:

| Rule | Check | Level |
|---|---|---|
| ES1 | every event has a business description | hard |
| ES2 | every event has a timeline position (sparse-matrix column) | hard |
| ES3 | duplicate event names reported (merge/rename is a human call) | notice |
| ES4 | solution-language verbs flagged (Create/Save/Update…) | notice |
| ES5 | every question links to an event | hard |

`info.timeline` × `info.sequence/step` is the **event sparse matrix** — the
time-ordered output artifact of a Big Picture Event Storming, reproducible
from the tree with one deterministic sort.

## How this compares

| | Miro/FigJam export | EventCatalog | AsyncAPI | **truthsrc** |
|---|---|---|---|---|
| Direction | board → doc, one-way, lossy | describes **deployed** systems | runtime message contracts | board ⇄ truth source, **bidirectional & lossless** |
| Diffable | ✗ | partial | ✓ | ✓ (one atom per file) |
| Process-aware | ✗ | ✗ | ✗ | ✓ (stage-gated vocabulary: no "aggregate" before Stage 03) |
| Agent-editable | ✗ | ✓ | ✓ | ✓ (AGENTS.md contract + mechanical gates) |

## Roadmap

- [x] v0.1 — note atoms, eventStorming rules (ES1–ES5), compile/decompose/validate/roundtrip
- [x] v0.2 — commandStorming vocabulary: command/role/policy notes, the structured policy atom, the aggregate atom with `order` lists
- [x] v0.3 — the full solution contract: slices (parameters, guards, event bindings, fold assignments), single event pool with `extraEvents`, value objects, read models, stories, use cases — plus CS1–CS8 / RF1–RF5 / policy-closure rules; production-verified against the reference generator's vocabulary
- [ ] v0.4 — **full codegen, open-source**: the `scala-cqrs-es` reference generator (runnable CQRS/ES application from compiled products — 718 files / 2,291 tests green in production) + the [generator contract](CODEGEN.md) for **custom generators**
- [ ] v0.4 — **full codegen, open-source**: the `scala-cqrs-es` reference generator (runnable CQRS/ES application from compiled products — 718 files / 2,291 tests green in production) + the [generator contract](CODEGEN.md) for **custom generators**
- [ ] v0.5 — JSON Schema publication (schemastore.org) + editor autocomplete; board importers (Miro, FigJam, EventModeling canvas) and exporters (Mermaid, PlantUML)
- [ ] v1.0 — community generator registry; capture API (`truthsrc capture`) as the programmatic write surface

**Codegen is fully open-source by ruling (2026-10-12)** — the production
generator lands here as the reference implementation of a public generator
contract, and custom generators (yours, your agent's) plug in as equals.
See [CODEGEN.md](CODEGEN.md).

The reference implementation this format was extracted from runs a 1,600-note
workshop tree through a five-product byte-identity roundtrip in production —
the format is not theoretical; it is load-bearing.

## Contributing

PRs welcome — especially stage schemas (02–07) and board importers. Every PR
must keep `npm test` green (roundtrip identity is non-negotiable) and add a
rule-fire regression for each new lint rule.

## License

[MIT](LICENSE)
