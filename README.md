# truthsrc

**Write the business rules once, as a truth tree. Generate code. Then prove where every line came from.**

truthsrc is a file-based domain-knowledge language and compiler for DDD systems.
One YAML tree is the only authoring surface; the local knowledge graph, the
generated CQRS codebase and every lineage anchor are derived projections you can
rebuild at will.

```text
author YAML files  →  compile & validate  →  knowledge graph (SQLite AST)  →  generated code
       ↑                                                                          ↓
       └────────────── query sources & final code spans on the same graph ───────┘
```

Part of the [co-arising](https://co-arising.github.io) open-source family —
read [why the family is named after dependent origination](https://co-arising.github.io/why-co-arising/),
or go straight to the [10-minute tutorial](TUTORIAL.md).

> 中文版 README 见 [README-zh.md](README-zh.md)。

## What it does

| Capability | Command |
|---|---|
| Author & gate | `truthsrc validate` (0 hard findings) · `truthsrc roundtrip` (tree ⇄ canonical byte-identity) |
| Compile | `truthsrc compile --tree <dir> [--out canonical.json]` |
| Build a local graph store | `truthsrc graph --tree <dir> --out <db>` — pure cache, delete & rebuild any time |
| Generate a project | `truthsrc generate-project --project <config> --out <dir> [--plan \| --update]` |
| Ask both directions | `truthsrc query-project --knowledge SetCount` · `--file <f> --line <n>` |
| Prove lineage | `truthsrc verify-project` — re-verifies every anchor against file bytes |
| Export a map | `truthsrc view-project --html <new-file>` — single-file, offline, read-only snapshot |
| Agent access | `truthsrc mcp` — 26 read-oriented tools over stdio JSON-RPC |

Zero npm runtime dependencies — the toolchain is Node stdlib only
(built-in `node:sqlite` is why the floor is **Node ≥ 22.13.0**).

The language itself: 12 atom kinds, 15 workshop note types, and a registry of
22 typed relations (with per-relation impact flags that `blast_radius` walks) —
see [the language page on the site](https://co-arising.github.io/dsl/) and the
full [SCHEMA.md](SCHEMA.md).

## Install

No npm registry release yet — a source checkout is the canonical install
(the ledger tracks publication: [DEF-03](https://co-arising.github.io/status/#DEF-03)).

```bash
git clone https://github.com/co-arising/metarch-truthsrc.git
npm install --prefix metarch-truthsrc     # dev deps only; runtime is stdlib-only
node metarch-truthsrc/bin/truthsrc.js --help
```

Tip: `alias truthsrc="node $(pwd)/metarch-truthsrc/bin/truthsrc.js"` makes the
docs read literally. Verified on Node 22.13.0 and 22.23.4. A prebuilt local
tarball (`madpolaris-truthsrc-0.5.0.tgz`) also works offline —
[install details in README-zh](README-zh.md#install-the-local-cli).

## Start here

[TUTORIAL.md](TUTORIAL.md) walks the whole loop on a one-aggregate Counter
project — no JVM, no database, no network:

1. `init counter-lab` → preview with `generate-project --plan` → generate →
   `status-project` (inputs=current · evidence=verified · synchronized=true)
2. Query a rule both directions: `query-project --knowledge SetCount` gives the
   exact file and span; `--file/--line` goes back to the rule
3. Change the tree (count default 0 → 2), watch staleness, `--update`,
   re-verify — and re-running generation writes **0 files** (idempotence is a gate)

For the full walkthrough at bank scale — including wiring `truthsrc mcp` into
Claude Code for blast-radius planning — see the
[hands-on guide](https://co-arising.github.io/guide/).

## Truth vs evidence

- `truth/<system>/system.yaml` plus per-context YAML is the author entry;
  [AUTHORING.md](AUTHORING.md) defines syntax, identity and structure sharing.
- The compiled canonical is a projection. Never hand-edit canonical, complete
  requests, compiled products, ledgers, anchors or generated code.
- Projects keep a full snapshot in `.truthsrc/knowledge.sqlite` beside the
  project; the external `anchors.json` is a verified exchange artifact, not a
  second truth.
- `query-project` reports `precision: span` only when the byte range is
  actually verified; symbol-only answers stay honestly labeled.
- Node-only success proves the source, products, generation and lineage —
  not that Scala compiled, that the bank service ran, or that financial
  behavior was accepted. Command contract: [PROJECT.md](PROJECT.md).

## The bank example

The flagship worked example lives in
[bank-wealth-demo](https://github.com/MadPolaris/bank-wealth-demo): 157 truth
atoms across three aggregates (CreditBalance · FundOrder · SipPlan), 149 named
`@rule` invariants, 2 sagas and 4 pipelines — generating a compiling Play/CQRS
Scala project with a physically separated handwritten zone.
[See it on the site](https://co-arising.github.io/bank-demo/), or
[query its live graph in your browser](https://co-arising.github.io/explorer/).

## Agents

- [AGENTS.md](AGENTS.md) — the editing contract: every batch of author-tree
  edits ends with `validate` AND `roundtrip` green; agents draft, humans approve.
- [skills/](skills/) — four SKILL.md packs: query discipline (the DESCRIBE
  model), extract a tree from an existing codebase, extract from reachable
  data, bootstrap workshop drafts from a one-line description.
- `truthsrc mcp` exposes describe / expand / blast_radius / lineage / anchors /
  orphans / consistency_check plus registry verbs — read-oriented by design.

## Repo map

- [TUTORIAL.md](TUTORIAL.md) — the loop in miniature · [SCHEMA.md](SCHEMA.md) —
  full format reference · [AUTHORING.md](AUTHORING.md) · [PRODUCTS.md](PRODUCTS.md)
- [CODEGEN.md](CODEGEN.md) — generator contract & handwritten isolation ·
  [COMPATIBILITY.md](COMPATIBILITY.md)
- [docs/artifacts/](docs/artifacts/README.md) — per-artifact-type catalog and
  the [Scala CQRS companion](docs/artifacts/scala-cqrs/README.md)

## Development checks

From the tool source root (don't start sibling apps by default):

```bash
npm run test:onboarding
node --test --test-concurrency=1 test/project-init.test.mjs test/project-cli.test.mjs test/code-mappings.test.mjs
```

Test success does not substitute for the minimum-Node, standalone-install,
code-build, bank-service or real-newcomer acceptances — each is its own gate.

## License

[MIT](LICENSE)
