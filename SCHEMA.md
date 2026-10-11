# SCHEMA — truthsrc v0.3

The truth source is a **tree** of small YAML atom files. `compile` projects the
tree to `canonical.json`; `decompose` is its byte-identical inverse. The tree is
the only edit surface.

Version history: **v0.1** — eventStorming notes (the sparse matrix). **v0.2** —
commandStorming vocabulary (commands, roles, policies) and the aggregate atom.
**v0.3** — the full solution contract: slices (guards, event bindings, fold
assignments), value objects, read models, stories, use cases. All shipped rules
are production-verified: the reference generator (a Scala CQRS/ES stack) builds
compiling code from exactly this vocabulary.

```text
tree/
  workshop.yaml                     # schemaVersion + workshop name + sessionOrder
  inbox/<stage>/                    # unowned / not-yet-claimed notes
    <type>-<code>-<slug(name)>-<seq>.yaml
  aggregates/<slug>/
    aggregate.yaml                  # one aggregate: payload + order + extraEvents
    slices/<command-slug>.slice.yaml# one vertical slice per command
    notes/                          # command/event notes claimed by this aggregate
  policies/
    policy-<code>-<slug>-<seq>.policy.yaml
  value-objects/<slug>.vo.yaml
  read-models/<slug>.rm.yaml
  stories/<slug>.story.yaml
  use-cases.yaml                    # single flow-model file (optional)
```

## Atom file

Every atom is: a banner comment, scalar header lines, optional nested maps
(`origin:`, `order:`), optional object lists (`triggers:`/`invokes:`), then
verbatim JSON blocks (`payload:`, `events:`, `extraEvents:`).

```yaml
# ═══ truthsrc atom — hand-editable; contract: SCHEMA.md ═══

kind: note                       # note | policy | aggregate | slice | value-object | read-model | story | use-cases
type: event                      # notes only — see vocabulary below
name: LoanRequested              # raw token; quoted if it contains spaces/punctuation
origin:                          # notes/policies — ordering identity, the ONLY authority
  stage: eventStorming
  board: board1
  seq: 0                         # frozen board order, contiguous 0..n-1 per (stage, board)
payload:                         # verbatim JSON — I3: the compiler never rewrites it
  {
    "type": "event",
    ...note JSON exactly as captured...
  }
```

### Header rules (V1/V2/V3 — hard)

| Rule | Requirement |
|---|---|
| V1 | `kind` known; per-kind required fields present (`type`/`name`/`origin` for notes, `command`/`aggregate` for slices, `seq` for aggregates and catalog atoms) |
| V2 | note filename tuple `(stage, type, name, seq)` unique; `origin.seq` contiguous `0..n-1` per `(stage, board)` across inbox + aggregate-owned notes + policies; header `stage` ≡ inbox directory |
| V3 | `payload.type`/`payload.name`/`payload.stage` (when present) agree with the header — for every atom kind |

### Payload rules (I3 — verbatim)

The payload is the workshop's own JSON, byte-preserved in meaning. The compiler
orders; it never edits, annotates, or re-keys. Blank lines are not allowed
inside a JSON block; continuation lines are indented exactly two spaces.

## Vocabulary

**Stages** (fixed order — canonical sessions follow it):

`eventStorming → commandStorming → aggregateDiscovery → subdomainExploration → contextMapping → refining → storyMapping`

Filename stage codes: `es cs ad sd cm rf sm`.

**Note types:** `event question command role policy aggregate entity readModel
timer externalSystem context subdomain relation field story`.

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

## Stage rules — commandStorming (CS1–CS8)

Commands, roles, policies and external systems are captured as **notes** whose
`links` name their causal targets: `command:X` from a role note means "this role
issues X"; `event:Y` from a command/timer/externalSystem note means "this
produces/triggers Y"; `event:Y@strong` / `event:Y@eventual` on an event note is
an event→event causal chain with its consistency annotation.

| Rule | Check | Level |
|---|---|---|
| CS1 | every event has ≥1 trigger source (a command/timer/externalSystem/event note linking it) | notice |
| CS2 | every event→event link carries `@strong` or `@eventual` | notice |
| CS3 | every command is initiated by a role note or invoked by a policy (policy-triggered commands default to `System`) | notice |
| CS4 | every role triggers ≥1 command | notice |
| CS5 | every policy links ≥1 event + ≥1 command | notice |
| CS6 | every externalSystem/timer triggers ≥1 event | notice |
| CS7 | every link resolves to an ingested note (or aggregate pool entry) | notice |
| CS8 | command/policy/externalSystem/timer names unique — report only. **Role exempt**: same-name role cards are the convention (each card pins one command) | notice |

**Policy atoms** (v0.2 upgrade of the policy note): a policy carries a
*structured causal contract* next to its verbatim payload — the payload stays
authoritative for humans, the blocks are authoritative for tools:

```yaml
kind: policy
type: policy
name: AutoDisburseOnApproval
origin:
  stage: commandStorming
  board: board1
  seq: 7
triggers:
  - event: LoanApproved
    aggregate: Loan
invokes:
  - command: DisburseLoan
    aggregate: Loan
payload: { ...verbatim note JSON; info.triggers / info.invokes mirror the blocks... }
```

| Rule | Check | Level |
|---|---|---|
| V7 | `triggers` and `invokes` both present and non-empty | hard |
| V8 | `payload.links` (`event:*`/`command:*`) ≡ triggers/invokes projection; `payload.info.triggers/invokes` ≡ blocks | hard |
| V9 | every trigger event and invoked command resolves (note names or aggregate pools/slices) | hard |

## The aggregate atom (v0.2/v0.3 — the solution contract)

```yaml
kind: aggregate
name: Loan
seq: 0                            # product order — unique across aggregates
order:
  commands: [RequestLoan, ApproveLoan, DisburseLoan, RecordPayment]
  events: [LoanRequested, LoanApproved, LoanDisbursed, PaymentReceived, LoanRepaid]
payload: { ...aggregate field model, verbatim... }
extraEvents: [ ...events no slice command produces... ]   # optional block
```

Payload vocabulary (each key passes through untouched; generators consume them):

| Key | Meaning |
|---|---|
| `entity` | the one state entity of this aggregate (RF1: required) |
| `identifier` | identity field `{name, dataType, origin}` (RF2: required) |
| `stateFields[]` | state fields `{name, dataType, origin, writtenBy[], role}` (RF3: `dataType` required) |
| `statusEnum[]` | legal status values |
| `aggregateRuleRefs[]` | aggregate invariants `{ruleId, errCode, desc}` |
| `statusTransitions` | event → status it sets |
| `stateGates` | command → `{fromStates[], toState, initial?}` |
| `relations[]` | cross-aggregate references `{to, cardinality, foreignKey, semanticType}` |

## The slice atom — one command, vertical

```yaml
kind: slice
aggregate: Loan
command: RequestLoan
payload: { ...command object, verbatim... }
events:                                   # full event definitions owned by this command
  LoanRequested: { name, payloads[], bindings[], foldAssignments[] }
```

- **payload** — the command: `{name, description, parameters[], guards[],
  produces[]}` (RF3: parameters carry `dataType`; RF5: empty parameters is a
  notice). Guard kinds: `initialized`, `statusTransition` (`from`/`toStatus`/
  `notStatus` — `notStatus` is an **array**), `invariantRef` (`ref`/`errCode`/
  `cond`), `expression`.
- **events** — the single event pool. A full event definition lives in **exactly
  one** slice: the first command in `order.commands` whose `produces` names it
  (V6). Every produced event must resolve into the pool (V6b). An event no
  command produces lives in the aggregate's `extraEvents` block.

**Derived projections** (documented formulas — never stored, so they can never
drift; a generator computes them):

```
decision(cmd)  = { command: cmd.name,
                   guards:  cmd.guards,
                   emissions: cmd.produces.map(e => { event: e,
                               bindings: mapFrom(pool[e].bindings) }) }
fold(event)    = { event: event.name, assignments: mapFrom(event.foldAssignments) }
mapFrom(rows)  = Object.fromEntries(rows.map(r => [r.slot, r.expr]))
```

Binding/fold expression forms: `state.<field>`, `param.<parameter>`,
`literal:<value>` (`literal:SYSTEM_NOW` = injected clock).

| Rule | Check | Level |
|---|---|---|
| V4 | slice `payload.name` ≡ header `command`; header `aggregate` ≡ owning aggregate; event object `name` ≡ its key | hard |
| V5 | `order.commands` ≡ slice set, both directions, no duplicates | hard |
| V6 | `order.events` ≡ event pool both directions; a definition lives in exactly one slice; every produced event resolves | hard |
| V12 | `seq` unique per family (aggregates / value objects / read models / stories), integer | hard |
| RF1/RF2/RF3 | entity, identifier, field data types present | hard |
| RF4/RF5 | empty event payload / parameterless command | notice |

## Catalog atoms (v0.3 — refining & storyMapping faces)

`value-objects/*.vo.yaml`, `read-models/*.rm.yaml`, `stories/*.story.yaml` —
same shape: `kind` + `name` + `seq` + verbatim `payload`.

| Rule | Check | Level |
|---|---|---|
| V10 | value object `payload.fields` is an array | hard |
| V11 | read model: `payload.fields` array, every field has a `source` derivation (`aggregateIdentity` or `eventField:<Event>.<field>`); `payload.sourceAggregate` resolves to an aggregate | hard |
| SM2 | story has `role` and `goal` | notice |

`use-cases.yaml` (optional, single file) carries the flow model:
`{useCases: [{useCase, preconditions[], steps[{id, story, command, aggregate,
emissions[]}], extensions[]}]}`.

## Ownership distribution (where notes live)

A `command` or `event` note whose name appears in an aggregate's command/event
set lives under `aggregates/<slug>/notes/` — the aggregate has claimed it.
Everything else stays in `inbox/<stage>/`. The `origin.stage` header is frozen
at capture and never rewritten by the move: sessions are ordered by
`(origin.stage, origin.board, origin.seq)` wherever the file sits.

## canonical.json (v1)

```json
{
  "schemaVersion": "truthsrc/v1",
  "workshop": "loan-demo",
  "sessions": [
    { "session": "eventStorming",
      "scopes": [ { "scope": "board1", "notes": [ { "...verbatim payload..." } ] } ] }
  ],
  "aggregates": [
    { "name": "Loan", "...aggregate payload...": {},
      "commands": [ { "name": "RequestLoan", "parameters": [], "guards": [], "produces": ["LoanRequested"] } ],
      "events":  [ { "name": "LoanRequested", "payloads": [], "bindings": [], "foldAssignments": [] } ] }
  ],
  "valueObjects": [ { "name": "Money", "fields": [] } ],
  "readModels":   [ { "name": "LoanOverviewDecisionView", "sourceAggregate": "Loan", "fields": [] } ],
  "stories":      [ { "name": "RequestLoan", "role": "Applicant", "goal": "..." } ],
  "useCases":     { "useCases": [] }
}
```

- `sessions` — the L1 face: verbatim note payloads (policies ride along) in
  `(stage, board, seq)` order.
- `aggregates` — the solution contract: payload + `commands` filled from slices
  per `order.commands` + `events` filled from the pool per `order.events`.
  Decisions and folds are **not** in canonical — derive them with the formulas
  above.
- Catalog arrays are ordered by `seq` (dense; seq need not be contiguous).
- `useCases` is omitted when `use-cases.yaml` is absent.

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
- **Aggregate identity** = `name`; **slice identity** = `(aggregate, command)`.
- **Board order** = `origin.seq` (frozen at capture; never renumbered by tools).
- **noteId** (if your capture pipeline mints one) lives in `payload` and is
  passed through untouched — it is downstream identity, not tree identity.
