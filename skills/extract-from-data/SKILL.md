---
name: extract-from-data
description: Extract a truthsrc v0.5 truth tree from a dataset the agent can reach (scenario C). Pulls three separate layers — facts, views, opinions — out of agent execution traces, logs, or any reachable data, and organizes them against the truth tree as the domain skeleton. Emits draft notes into inbox/ only, never writes aggregates/, policies/, or read-models/ directly. Use when the agent has first-hand data and needs to turn it into domain knowledge.
---

# extract-from-data — truth tree from agent-reachable data

You are the **drafter**, never the author. Data gives you *facts*; the truth
tree gives you the *skeleton* to hang them on; *opinions* are yours to
propose and the human's to overturn. Three layers, never mixed: a note is
a fact, a view, or an opinion — never two at once.

## §0 Input: a dataset you can touch

Anything the agent can reach: execution logs (JSONL from a coding agent),
a database, an API, a directory of files. Format doesn't matter — each
source owns its **adapter**, a mechanical mapping from its native records
to the normalized fact schema (§5). The adapter is the source's job (each
agent extracts its own logs); this skill defines the schema and the three
layers, not the parsing.

Optional but powerful: an existing truth tree. With it, the tree is the
**skeleton** — facts get attributed to its events/aggregates, views get
organized by its structure. Without it, facts come first; once enough
accumulate, hand them to `bootstrap-from-description`.

## §1 The three layers

### L1 — Facts （事实）: what happened, nothing more

A fact is a normalized record of something that happened: *what, when, in
which entity, from which source record*. Immutable, minimal processing.
The agent adds no interpretation — not even a grouping.

- `payload.info.layer: fact`
- `payload.info.extracted_from`: source record id + adapter name
  (`"claude-code-jsonl:evt-88412 via claude-adapter"`)
- `payload.info.confidence`: `high` (recorded by the system) | `low`
  (self-reported by the agent, e.g. `problemAddressed`)
- Facts never explain. "Command X ran 3 times, 45s/120s/30s" is a fact;
  "the build is slow" is not — that's L3.

### L2 — Views （视图）: facts reorganized by domain knowledge

A view is the same facts, reorganized using the truth tree as the
organizing key: grouped by aggregate, laid on an event timeline, traced
through lineage, rolled up into a read model. **The tree decides the
shape; the facts supply the content.** One set of facts can yield many
views; each view names the tree concepts it organizes by.

- `payload.info.layer: view`
- `payload.info.organized_by`: the tree concepts used
  (`"aggregate:TaskRun, event:GateChecked"`)
- `payload.info.built_from`: the fact note ids it reorganizes — every
  view traces back to facts, no exceptions
- Natural landing: `13-read-models/` drafts (a view *is* a read-model
  candidate) and `09-lineage/` arrows

### L3 — Opinions （观点）: judgments grounded in facts

An opinion is an interpretation: "this gate is the bottleneck", "this
policy never fires", "these two commands always run together". Opinions
are the agent's proposals, never assertions.

- `payload.info.layer: opinion`
- `payload.info.grounded_in`: the fact/view note ids supporting it —
  **no naked opinions**; an opinion without grounding is a fabrication
- `payload.info.confidence`: `low` by default; only the human raises it
- Natural landing: `inbox/REVIEW.md`, plus `10-policies/` candidates
  (an opinion like "gate X never fails" is a policy review candidate)

## §2 The tree is the skeleton

With a tree: every fact gets an attribution edge to the tree's
event/aggregate/command it instantiates ("this CommandRun *is* an
instance of event CommandExecuted in aggregate TaskRun"). Attribution is
mechanical where the mapping is 1:1; ambiguous mappings go to REVIEW.md
for the human to confirm once, then apply mechanically.

Without a tree: emit facts only. Views and opinions need a skeleton to
organize against — don't invent one. The fact pile becomes the input to
`bootstrap-from-description` later.

Either way: **the application may have no code yet, but with the tree it
already has the skeleton — the soul. Facts, views and opinions are the
flesh the agent grows onto it, and the tree is what lets the agent
understand what it's looking at.** Reorganizing the data by domain
knowledge is not a reporting step; it is how the agent *comprehends* the
domain.

## §3 Where each layer lands

| Layer | Draft note | File under |
|---|---|---|
| fact | event note: what happened, fields from the record | `01-event-flow/` |
| fact | command note: a directive the agent received or issued | `02-commands/` |
| fact | aggregate note: the entity boundary the facts cluster by | `03-aggregates/` |
| view | read-model note: facts rolled up by tree concepts | `13-read-models/` |
| view | lineage arrows: which fact produced which | `09-lineage/` |
| opinion | policy candidate: the judgment, mechanism described, intent blank | `10-policies/` (`confidence: low`) |
| opinion | review entry: judgment + grounding + what would confirm it | `inbox/REVIEW.md` |

`origin.board: extracted-data` (not `extracted` — that's code).
Filename: `<type>-<stage>-<slug>-<seq>.yaml`, seq dense per
`(stage, board)`.

## §4 Hard rules

- **Never invent, per layer**: facts — no record, no note. Views — every
  view traces to fact ids (`built_from`). Opinions — every opinion
  traces to fact/view ids (`grounded_in`). A broken chain is fabrication.
- **One note, one layer.** Never mix fact wording into an opinion note
  or opinion wording into a fact note. The steward must be able to
  delete every opinion without losing a single fact.
- **Sanitize**: secrets, tokens, PII never enter the tree — the adapter
  strips them before the fact layer.
- **Inbox first, always**: never write `aggregates/`, `policies/`, or
  `read-models/` directly. Promotion is the human's stewardship act.
- Problem-space vocabulary (see `extract-from-code` §Vocabulary
  discipline): solution-space words don't belong in names — *unless* the
  data's own domain is the engineering plane, where the agent's own words
  are the domain language.

## §5 Reference: normalized fact schema (agent execution traces)

The worked example. Any agent's native logs map to these seven fact
shapes; other domains define their own, keeping the
what/when/entity/source spine:

- `TaskStarted` / `TaskCompleted` {taskId, parentTaskId?, outcome, durationMs}
- `CommandRun` {command, exitCode, durationMs, problemAddressed?} —
  *what problem this run solved*, self-annotated by the agent at run time
- `StepExecuted` {kind: read|write|exec|delegate|…, target, durationMs}
- `FileChanged` {path, changeKind, linesAdded?, linesRemoved?}
- `GateChecked` {gate, passed, detail?} — consistency gates are facts
- `DecisionMade` {question, choice} — stewardship moments are facts

## §6 Validation gate & pass order

`truthsrc validate --tree <dir>` must be **0 hard**; `compile` must
succeed. Fix the draft, never the rule.

1. **Facts** (`01/02/03-event-flow/`): run the adapter, emit one note
   per normalized record. Don't group, don't summarize.
2. **Attribution**: hang each fact on the tree's concepts — or REVIEW.md
   if ambiguous, or facts-only pile if there is no tree yet.
3. **Views** (`13/09-read-models/`): reorganize by tree concepts, every
   view carrying `built_from`.
4. **Opinions** (`10-policies/` + REVIEW.md): propose, ground, mark low.
5. Write `inbox/REVIEW.md`: ambiguous attributions, ungroundable
   opinions, what the human must confirm, what you left out.

Then hand to the steward. Facts are yours to extract; meaning is theirs
to adjudicate.
