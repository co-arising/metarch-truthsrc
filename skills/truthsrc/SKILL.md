---
name: truthsrc
description: Query a truthsrc truth tree with the DESCRIBE model — validate first, then describe/expand/blast_radius/lineage over the compiled graph. Use when you are handed a truth tree directory and need to answer questions about its domain knowledge without reading every atom.
---

# truthsrc — DESCRIBE a truth tree

A truthsrc tree is a git-native, human-editable domain knowledge base
(SCHEMA.md is the contract; v0.5). You never need to read every atom: the
query library (`lib/query.mjs`, exposed as MCP tools via `truthsrc mcp`)
gives you a fixed-verb DESCRIBE API over the compiled `canonical.json`.

## The loop

1. **Validate first.** `truthsrc validate --tree <dir>` must be **0 hard**
   before you trust anything. Notices are report-only; hards mean the tree
   is lying to you — stop and fix or report.
2. **Compile.** `truthsrc compile --tree <dir> --out canonical.json`
   (byte-deterministic projection; the tree stays the only edit surface).
3. **Describe to orient.** `describe(kind, id)` — one line plus relation
   fan-out. Start from what the question names; if you don't know the
   address, `search(q[, kind])` first.
4. **Walk with a budget.** `expand(id, {depth, direction, relations, limit})`
   — defaults `depth=1, limit=100`. For change impact use
   `blast_radius(id, {depth:3})`; for data provenance use
   `lineage(field)`. Filter `relations` to the edge types you care about;
   set `direction` to `in`/`out` when you know which way you're walking.
5. **Follow `next_actions`.** Every answer returns `next_actions[]` — the
   HATEOAS of the knowledge graph. Prefer them over guessing the next hop.

## The envelope

Every verb returns:

```json
{
  "summary": "one-line human summary (never invented — computed from the graph)",
  "result": { "...": "verb-specific payload" },
  "next_actions": ["describe('event','x')", "..."],
  "budget": { "depth_used": 1, "nodes_visited": 12 }
}
```

If `result` is empty, say so — an empty result means *the tree has no data
for that question*, not that you should fill it in.

## Node addressing

`"<kind>:<id>"` — e.g. `event:exception-replayed`,
`slice:replay-exception`, `policy:batch-business-closure`,
`read-model:chain-stats`, `role:operator`, `pipeline:batch-chain`,
`step:batch-chain.file-gen`, `field:run-started.runId`.

Ids are kebab-case. `describe(kind, id)` takes them separately;
`expand`/`blast_radius` take the joined address.

## The 22 tools

Base verbs: `describe`, `expand`, `blast_radius`, `lineage`, `anchors`,
`search`, `conditions`, `diff`, `orphans`, `consistency_check`.
Registry-derived named verbs (thin wrappers over `expand`): `slices_of`,
`events_of`, `commands_of`, `read_models_of`, `policies_triggered_by`,
`policies_constraining`, `steps_of`, `participants_of`, `consumed_by`,
`trigger_source_of`, `aggregates_referencing`, `contexts_depending_on`.

Every tool takes `canonical` (path to compiled canonical.json) or `tree`
(path to the tree dir, compiled in-memory) plus the verb's args.

## Semantics you must respect

- **`blast_radius` is may-impact, over-approximate** (宁多报，不漏报). It
  walks exactly the human-adjudicated `propagates=true` edges of the
  relation registry (`lib/shared.mjs` `RELATION_REGISTRY`). Permission edges
  (R12 `can-issue`, R13 `visible-to`, R15 `performed-by`) do **not**
  propagate — a role change is not a behavior change.
- **`anchors()` honestly reports unanchored.** Until the back-anchor work
  lands code anchors in canonical.json, it returns
  `{status:'unanchored', result:[]}`. Never present this as "no code
  exists" — it means "the tree doesn't say".
- **Relations without a machine-readable carrier yield empty results.**
  The query graph only walks what exists (`payload.links` R1-validated
  objects, kind-specific carriers). An empty `policies_constraining` is a
  data gap in the tree, not a query bug.
- **Problem-space vocabulary.** The tree speaks the business's language
  (DDD ubiquitous language), never implementation mechanics. When you
  summarize, keep the domain's words; don't translate them into framework
  vocabulary.

## The tree layout (so you know where answers live)

`inbox/` holds the 13 workshop products (`01-event-flow/` … `13-read-models/`;
see SCHEMA.md) — the draft face. `aggregates/<slug>/` holds claimed
solution contracts; `policies/`, `read-models/`, `value-objects/`,
`stories/`, `use-cases.yaml`, `pipelines/` hold catalog atoms.
`workshop.yaml` is the root config. The `origin.stage` header is frozen at
capture and never rewritten by moves.
