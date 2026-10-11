# SCHEMA — truthsrc v0.1

The truth source is a **tree** of small YAML atom files. `compile` projects the
tree to `canonical.json`; `decompose` is its byte-identical inverse. The tree is
the only edit surface.

```text
tree/
  workshop.yaml                  # schemaVersion + workshop name
  inbox/<stage>/                 # unowned / not-yet-claimed notes
    <type>-<code>-<slug(name)>-<seq>.yaml
```

## Atom file

```yaml
# ═══ truthsrc atom — hand-editable; contract: SCHEMA.md ═══

kind: note                       # v0: always "note"
type: event                      # see vocabulary below
name: "LoanRequested"            # JSON string literal
origin:                          # ordering identity — the ONLY authority
  stage: eventStorming
  board: board1
  seq: 0                         # frozen board order, contiguous 0..n-1 per stage
payload:                         # verbatim JSON — I3: the compiler never rewrites it
  {
    "type": "event",
    ...note JSON exactly as captured...
  }
```

### Header rules (V1/V2/V3 — hard)

| Rule | Requirement |
|---|---|
| V1 | `kind: note`; `type` in vocabulary; `name` non-empty; `origin.stage` known |
| V2 | filename tuple `(type, stage-code, slug(name), seq)` unique; `origin.seq` a non-negative integer, contiguous `0..n-1` per stage; header `stage` ≡ directory |
| V3 | `payload.type`/`payload.name`/`payload.stage` (when present) agree with the header |

### Payload rules (I3 — verbatim)

The payload is the note's own JSON, byte-preserved in meaning. The compiler
orders; it never edits, annotates, or re-keys. Blank lines are not allowed
inside the payload block; continuation lines are indented exactly two spaces.

## Vocabulary

**Stages** (fixed order — canonical sessions follow it):

`eventStorming → commandStorming → aggregateDiscovery → subdomainExploration → contextMapping → refining → storyMapping`

Filename stage codes: `es cs ad sd cm rf sm`.

**Note types (v0.1):** `event question command role policy aggregate entity
readModel timer externalSystem context subdomain relation field story`.
Stages later than eventStorming may restrict which types are legal — their
schemas will arrive with their rules (roadmap v0.2).

## Stage rules — eventStorming (ES1–ES5)

Event Storming output is a **time-ordered sparse matrix of domain events**.
`info.timeline` is the column; `info.sequence`/`info.step` are the row
coordinates; `info.pivotal` marks stage-boundary events.

| Rule | Check | Level |
|---|---|---|
| ES1 | event has a non-empty business `description` | hard |
| ES2 | event has `info.timeline` | hard |
| ES3 | duplicate event names — report only; merging is a human decision | notice |
| ES4 | solution-language verbs (create/save/update/delete/click/insert/remove/fetch/load/persist/write/read) — report only | notice |
| ES5 | every `question` with links links at least one `event:*` | hard |

The tool reports; humans decide. Hard failures fail the gate; notices annotate.

## canonical.json

```json
{
  "schemaVersion": "truthsrc/v0",
  "workshop": "loan",
  "sessions": [
    { "session": "eventStorming",
      "scopes": [ { "scope": "board1", "notes": [ { "...verbatim payload..." } ] } ] }
  ]
}
```

Notes appear in `origin.seq` order within each board; boards in first-appearance
order; sessions in fixed stage order. Bytes are deterministic (I1) — this file
is safe to commit, diff, and regenerate; it is not safe to hand-edit.

## The three-layer key test

When proposing a new key, ask three questions:

1. Can a domain expert audit the business by it? → belongs in `payload` (problem space).
2. Does it survive an architecture change? → solution contract; make it structural.
3. Is it an artifact of a migration, a tool, or a gate? → **forbidden** — the
   compiler owns it, never the tree.

## Identity keys (for downstream tools)

- **Atom identity** = `(stage, type, name, seq)` — the filename tuple.
- **Board order** = `origin.seq` (frozen at capture; never renumbered by tools).
- **noteId** (if your capture pipeline mints one) lives in `payload` and is
  passed through untouched — it is downstream identity, not tree identity.
