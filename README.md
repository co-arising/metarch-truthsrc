# truthsrc

**Git-native Event Storming.** Your workshop board as a deterministic, diffable, agent-readable truth source.

```text
 workshop board (Miro / FigJam / wall)          LLM agent / human editor
        │  capture                                        │  edit
        ▼                                                 ▼
 ┌───────────────────────────────── tree/ ─────────────────────────┐
 │  one YAML atom per sticky note — hand-editable, reviewable,    │
 │  mergeable, and the ONLY place anyone ever writes to           │
 └────────────────────────────────────────────────────────────────┘
        │ compile                          ▲ decompose
        ▼                                  │ (byte-identical inverse)
 ┌──────────── canonical.json ─────────────┘
   pure machine projection · deterministic bytes · safe to delete
        │
        ▼   validate: ES1–ES5 stage rules, structure, tuple uniqueness
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
- **Zero dependencies** — the whole toolchain is plain Node ≥ 18.

## The three guarantees

| # | Invariant | What it means |
|---|---|---|
| I1 | Byte-deterministic | `compile(tree)` → identical bytes, every time, on every machine. |
| I2 | Roundtrip identity | `decompose(compile(tree))` ≡ `tree`, byte for byte. The canonical projection can never drift from the tree. |
| I3 | Payload verbatim | The compiler never rewrites your content — it only orders and projects. |
| I4 | No hidden state | The tree is everything. `canonical.json` is a build artifact; delete it whenever. |

`truthsrc roundtrip` enforces I1+I2 on every run — that's the gate your CI runs.

## Quickstart (humans)

```bash
npx truthsrc init my-workshop        # scaffold tree/ + one example atom
cd my-workshop
# …capture or edit atoms under tree/inbox/eventStorming/ …
npx truthsrc validate                # ES1–ES5 + structural rules
npx truthsrc roundtrip               # compile∘decompose∘compile identity gate
npx truthsrc compile --out canonical.json
git add tree/ && git commit -m "workshop: capture LoanApproved decision"
```

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
git clone https://github.com/truthsrc/truthsrc && cd truthsrc
cat AGENTS.md          # the contract
npm test               # roundtrip + rule-fire regression, ~1s, no network
```

## The format in 30 seconds

One file per sticky note (`SCHEMA.md` is the full contract):

```yaml
kind: note
type: event                     # event | question | command | aggregate | …
name: "LoanRequested"
origin:
  stage: eventStorming          # the workshop stage that owns this note
  board: board1
  seq: 0                        # frozen board order (contiguous 0..n-1)
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
- [ ] v0.2 — stages 02–07 schemas (command → aggregate → context → refining → story), each with its lint rules
- [ ] v0.3 — aggregate/slice atoms (commands, invariants, folds) with the same byte-identity guarantee
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
