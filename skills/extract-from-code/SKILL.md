---
name: extract-from-code
description: Extract a truthsrc v0.5 truth tree from an existing code repository (scenario A). Emits draft notes into inbox/ with source provenance and confidence tiers — never writes aggregates/, policies/, or read-models/ directly. Use when reverse-engineering domain knowledge out of a codebase.
---

# extract-from-code — truth tree from a codebase

You are the **drafter**, never the author. Extraction recovers *structure*
from code; *intent* stays human. Every note you emit must cite its source —
no source, no note. If the code doesn't say it, you don't write it.

## The one hard rule: inbox first, always

**The first landing point is `inbox/`. Never write directly to
`aggregates/`, `policies/`, or `read-models/`.**

Extraction produces *draft notes*; promotion into the tree's solution
face is the human stewardship act (rename / reposition / delete
fabrications / fill fields). The pipeline is:

```
code → inbox/ drafts (you) → human stewardship → aggregates/… (human)
       → truthsrc validate (must be 0 hard) → compile
```

A draft that skips the steward is a fabrication with a file extension.

## Note shape for extracted drafts

Standard note shape (`kind: note`, banner comment per SCHEMA.md), with:

- `origin.board: extracted` (not a workshop board — provenance of method)
- `origin.stage`: the v0.3 stage code of the product dir you file under
  (`es`, `cs`, `rf`, `sm`, … — see the 13-product table in SCHEMA.md)
- `payload.info.extracted_from`: `"path/to/File.scala:123"` or the code FQN
- `payload.info.confidence`: `high` | `low`
- `payload.info.extraction_note`: what the code showed vs. what you inferred

Filename convention: `<type>-<stage>-<slug>-<seq>.yaml`, seq dense per
`(stage, board)`.

## Confidence tiers

**High confidence — direct emit candidates** (the code says it plainly):

| Code artifact | Draft note | File under |
|---|---|---|
| Event classes / case classes named `*Event`, `*Evt` | event note: name, fields from the class | `01-event-flow/` |
| Journal tables, `eventsByTag` queries, topic names | event note: the persisted event stream | `01-event-flow/` |
| Command/handler classes, `*Command` messages | command note: name, parameters | `02-commands/` |
| Aggregate roots, `EventSourcedBehavior` entities, sharding entity types | aggregate note (boundary candidate) | `03-aggregates/` |
| Projection / read-side table definitions, query models | read-model note: fields + source per field where derivable | `13-read-models/` |
| HTTP controllers / API routes | command note: the entry point, parameters from the route | `02-commands/` |
| External clients, connectors, adapters | externalSystem note: what it connects to, protocol | `05-context-map/` |

**Low confidence — review list** (candidate, never asserted):

| Code artifact | Draft note | File under |
|---|---|---|
| Schedulers, retry policies, saga compensations | policy candidate: describe the *mechanism observed*, mark `confidence: low` | `10-policies/` |
| Guard clauses, `if` conditions on event emission | `conditions` hints on the command note's `extraction_note` | `02-commands/` |
| Field mappings in projections | lineage candidate arrows (`A → B`) | `09-lineage/` |

Low-confidence notes go in a clearly-marked review list
(`inbox/REVIEW.md`): what the code showed, what you'd need a human to
confirm. Never promote a guess into a `triggers:`/`invokes:` block or a
`fields[].source` — those are R1/R2 hard rules and they will (correctly)
fail validation if invented.

## Structure is extractable, intent is not

Extract: names, fields, cardinalities you can point at, call graphs,
persistence shapes, topic names.

**Do not extract** (leave for the human): SLOs, data contracts, quality
rules, owners/teams, pricing/licensing, business descriptions and value
propositions, policy *intent* ("why does this rule exist"). The code has no
SLOs in it; writing them would be fabrication. This is the same
"structure vs intent" line the whole toolchain holds: the tool proposes
candidates, the human adjudicates.

## Ask, don't fill

Where the code is silent, you ask — you never fill. Intent vacuums
("why does this rule exist", "who owns this", "what's the SLO") become
entries in `inbox/REVIEW.md`, each phrased as a confirming question a
human can answer in one sentence:

- GOOD: "Policy `re-batch-window`: is the 5-minute window a business rule
  or a demo convenience? (code: `AreaScheduler.splitReady`, no comment)"
- BAD: a policy note asserting "the 5-minute window balances throughput
  and latency" — the code never said that.

This is the reverse-direction form of constraint-first design: the
community eventstorming skill prioritizes active user questioning over
industry assumptions going forward; we hold the same line going
backward. A blank with a good question beats a confident fabrication.

## Vocabulary discipline

Write drafts in the **problem space** (DDD ubiquitous language): the words
the business uses, not the framework's. `journal`, `cursor`, `shard`,
`snapshot`, `entity` are solution-space words — they don't belong in note
names or descriptions. Business semantics stay ("after an interruption the
run continues from the breakpoint"); mechanisms go. If the codebase only
gives you mechanical names, keep the mechanical name as
`extracted_from` provenance and let the steward rename.

## Validation gate

After drafting: `truthsrc validate --tree <dir>` must be **0 hard**.
Notices are fine (they're report-only). If a hard fires on your drafts,
your extraction is wrong or overreaching — fix the draft, never weaken the
rule. `truthsrc compile` must succeed; `roundtrip` byte-identity is the
final seal.

## Worked pass order (one codebase, one afternoon)

Five passes, each with an **exit gate**. Do not start the next pass until
the gate holds — a gate is a check you run, not a feeling. (Reference: the
community eventstorming skill's five-phase discipline — Requirements →
Big Picture → Processes → Data → Integration — where each phase has a
defined deliverable before proceeding. We hold the same bar in reverse.)

1. **Events first** (`01-event-flow/`): event classes + journal/topic
   inventory. Events are the architecture's glue — everything else hangs
   off them.
   Gate: every `*Event`/`*Evt` class is either emitted or listed in
   REVIEW.md as deliberately excluded (with reason). `validate` is 0 hard.
2. **Commands** (`02-commands/`): handlers, their parameters, the events
   each one emits (only where the code shows the emission). Controllers /
   HTTP routes count as command entry points; external clients and
   connectors (`*Client`, `*Connector`, adapters) become externalSystem
   notes under `05-context-map/`.
   Gate: every handler/command class accounted for; no `triggers:` /
   `invokes:` block written from inference.
3. **Aggregates** (`03-aggregates/`): entity boundaries from sharding /
   `EventSourcedBehavior` / aggregate roots. One aggregate, one boundary
   candidate — don't merge or split on judgment.
   Gate: every event/command note is attributable to a boundary candidate
   or flagged in REVIEW.md; no boundary drawn from judgment alone.
4. **Read models** (`13-read-models/`): projections and query tables;
   `fields[].source` only where the projection code names the source
   event/field, else leave source empty and flag for review.
   Gate: every field has a source or a review flag; persisted snapshots
   are marked as snapshots, not query models.
5. **Policies** (`10-policies/`, low confidence): schedulers, sagas,
   compensations — mechanism described, intent blank.
   Gate: all notes `confidence: low`; REVIEW.md written with
   confirming questions + deliberately-left-out list.
6. Write `inbox/REVIEW.md`: every low-confidence note, what would confirm
   it, and what you deliberately left out.
   Final gate: full-tree `validate` 0 hard + `compile` succeeds.

Then hand to the steward. Your job ends at the review list.

