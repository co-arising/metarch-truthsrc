# SCHEMA — truthsrc v0.5

The truth source is a **tree** of small YAML atom files. `compile` projects the
tree to `canonical.json`; `decompose` is its byte-identical inverse. The tree is
the only edit surface.

Version history: **v0.1** — eventStorming notes (the sparse matrix). **v0.2** —
commandStorming vocabulary (commands, roles, policies) and the aggregate atom.
**v0.3** — the full solution contract: slices (guards, event bindings, fold
assignments), value objects, read models, stories, use cases. **v0.4** —
scenario A (trees reverse-engineered from code): the `pipeline` and `scenario`
kinds; SEQ de-mechanicalized (flow position stays problem-space, renumbering is
the compiler's job); the 13-artifact inbox layout (one workshop stage → one
product); the problem-space vocabulary requirement. **v0.5** — the relation
registry (22 declared relationships between knowledge elements, §"Relation
registry"); R1/R2 validation rules for relation references; `lib/query.mjs`
(the DESCRIBE-model query library: 10 verbs + registry-derived named verbs
over compiled canonical.json). All shipped rules
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
  domain-services/<slug>.port.yaml   # v0.5 E1: domain-service port declarations
  use-cases.yaml                    # single flow-model file (optional)
  pipelines/<slug>.pipeline.yaml    # v0.4: ordered business-step queues
  scenarios/<slug>.scenario.yaml    # v0.4: narrative scripts / demo runbooks
  sagas/<slug(id)>.saga.yaml         # cross-aggregate transaction products (optional)
```

## Atom file

Every atom is: a banner comment, scalar header lines, optional nested maps
(`origin:`, `order:`), optional object lists (`triggers:`/`invokes:`), then
verbatim JSON blocks (`payload:`, `events:`, `extraEvents:`).

```yaml
# ═══ truthsrc atom — hand-editable; contract: SCHEMA.md ═══

kind: note                       # note | policy | aggregate | slice | value-object | read-model | story | use-cases | pipeline | scenario | domain-service | saga
type: event                      # notes only — see vocabulary below
name: LoanRequested              # raw token; quoted if it contains spaces/punctuation
origin:                          # notes/policies — board capture position (see "Two SEQs" below)
  stage: eventStorming
  board: board1
  seq: 0                         # frozen board order; contiguity is the compiler's job (v0.4)
payload:                         # verbatim JSON — I3: the compiler never rewrites it
  {
    "type": "event",
    ...note JSON exactly as captured...
  }
```

### Header rules (V1/V2/V3)

| Rule | Requirement | Level |
|---|---|---|
| V1 | `kind` known; per-kind required fields present (`type`/`name`/`origin` for notes, `command`/`aggregate` for slices, `id`/`name`/`steps` for pipelines, `name`/`description` for scenarios) | hard |
| V2 | note filename tuple `(stage, type, name, seq)` unique; `origin.seq` values unique per `(stage, board)` across inbox + aggregate-owned notes + policies; header `stage` ≡ inbox directory. Contiguity `0..n-1` is **not** required — the compiler densifies on projection; never renumber by hand | hard for uniqueness, **notice** for contiguity (v0.4) |
| V3 | `payload.type`/`payload.name`/`payload.stage` (when present) agree with the header — for every atom kind | hard |
| V12 | `seq` on aggregates and catalog atoms is **optional** (v0.4). When present: integer and collision-free. "Which aggregate is #n" is compiler-derived, not tree content — see "Two SEQs" | hard for present seqs |
| SEQ1 | `seq` is all-or-nothing per family for ordering: mixed presence compiles (compiler falls back to file order) but the present seqs are ignored for ordering | notice |
| R1 | every explicit `payload.links` `{relation, target}` object must name a declared registry relation, and the (atom-kind, relation, target-kind) triple must match a registry entry. Legacy string-form links (`event:X`, `A → B` lineage arrows) are **not** R1's business — V8/CS7/ES5 already govern those carriers | hard |
| R2 | every relation target must resolve to an existing node: explicit-link targets (`"kind:id"`), role `can_issue[]` → slice commands (R12), role `can_view[]` → read-model ids (R13 inverse), read-model `fields[].source` `eventField:E.f` → known event E (R10). (Policy triggers/invokes already covered by V9, slice produces by V6b) | hard |

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
| ES4 | solution-language verbs (create/save/update/delete/click/insert/remove/fetch/load/persist/write/read) — report only | notice, see "Problem-space vocabulary" for the v0.4 convention |
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
| `stateGates` | command → `{fromStates[], toState, initial?}`; aggregates with no status lifecycle may carry flag-only entries `{initial: true}` recording creation-family membership (the initial-command whitelist is read from `initial` alone) |
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
  `cond`), `expression`. **P4 structured form** (2026-10-23, money trees):
  `{ruleId, errCode, onFail, when, desc}` where `when.form` ∈ `money-positive`
  (`amount`), `money-sufficient` (`amount`, `in`), `map-contains` / `map-absent`
  (`map`, `key`); `key`/`amount` are V13 expressions against the command
  parameters; `map`/`in` name state fields; `onFail` ∈ `reject` (default) |
  `succeed-empty` (idempotent no-op success — reply success, emit no events).
  Declaration order is the evaluation order.
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
`receipt.<slot>`, `literal:<value>` (`literal:SYSTEM_NOW` = injected clock).
`receipt.<slot>` is **bindings-only** (never a fold source): the producing
operation's durable receipt value, recorded in this event's own payload slot —
a TCC prepare/commit confirmation naming the receipt its phase outputs declare
(e.g. `reservation` on a prepare confirmation, `receiptId` on a commit
confirmation). A payload field populated by handler computation carries no
binding row at all.

| Rule | Check | Level |
|---|---|---|
| V4 | slice `payload.name` ≡ header `command`; header `aggregate` ≡ owning aggregate; event object `name` ≡ its key | hard |
| V5 | `order.commands` ≡ slice set, both directions, no duplicates | hard |
| V6 | `order.events` ≡ event pool both directions; a definition lives in exactly one slice; every produced event resolves | hard |
| V12 | `seq` unique per family (aggregates / value objects / read models / stories), integer | hard |
| V13 | binding/fold exprs resolve: `param.X` ∈ owning command parameters (slice-owned events; extraEvents have no owner → notice), `state.X` ∈ stateFields/identifier, `receipt.X` bindings-only ∈ own payload slots, `event.X` fold-only ∈ own payload slots, `state.K[E]` fold-only indexed read (`E` ∈ param/command or event/payload), known form required. Structured fold rows (`op` ∈ `set\|put\|remove\|money-apply`, per-op required fields, `sign` ∈ {1,−1}) and structured guards (`when.form` ∈ `money-positive\|money-sufficient\|map-contains\|map-absent`, `onFail` ∈ `reject\|succeed-empty`) are closed-vocabulary validated; guards carrying legacy `kind:` remain authoring-surface passthrough | hard (extraEvent `param.` = notice) |
| RF1/RF2/RF3 | entity, identifier, field data types present | hard |
| RF4/RF5 | empty event payload / parameterless command | notice |

**Query-command convention (2026-10-23, P4 Slice 2).** A slice command that
declares **no guards and no `produces`** (events pool `{}`) is a read-only
state query — the durable-evidence read path saga participants need
(golden master: `GetBalance(replyTo)` asking the entity for its state). The
truth source carries it as a first-class command so the tree stays the single
semantic source; generators apply the mechanical shape: the protocol message
carries only `replyTo: ActorRef[Get<Agg>StateReply]`, and the behavior handler
is `Effect.reply(cmd.replyTo)(Get<Agg>StateReply(state))` — the whole entity
state, keyed maps included (the golden master's flattened confirmation lists
are a display view; evidence queries need the `reservedAmount` /
`incomingCredits` **keys** for exact `contains(txid)` determination). The
definition digest is unaffected: the saga IR hashes sagas + workshop, not
aggregates.

## Catalog atoms (v0.3 — refining & storyMapping faces)

`value-objects/*.vo.yaml`, `read-models/*.rm.yaml`, `stories/*.story.yaml` —
same shape: `kind` + `name` + `seq` + verbatim `payload`.

| Rule | Check | Level |
|---|---|---|
| V10 | value object `payload.fields` is an array | hard |
| V11 | read model: `payload.fields` array, every field has a `source` derivation (`aggregateIdentity` or `eventField:<Event>.<field>`); `payload.sourceAggregate` resolves to an aggregate | hard |
| V13 | domain service: `payload.fq` present, `payload.methods` a non-empty array, every method carries a `sig` | hard |
| SM2 | story has `role` and `goal` | notice |

Read-model `payload.viewKey` (optional, v0.5 E2) is the read-side semantic
key for the view (kebab; a 2026-08-27 adjudicated rename of the command-style
key, e.g. `park-concept` → `parked-knowledge`). The api generator reads it
for the `OkReceipt` decision-view value and the `ViewKeys` object; a view
whose name is not renamed keeps its command-style kebab key as `viewKey`.

Read-model field markers (optional, v0.5.2 — Phase 2 typed read models).
The storyMapping `field` notes behind every read model
(`info.kind: "readModelField"`, `info.parent: <View>`) may carry three
adjudicated markers in `info`. All three are **opt-in**: a note without
them generates exactly the Phase 1 shape (the markers are the only
Phase 2 signal; nothing is inferred from `dataType` alone).

- `info.opaque: true` — the field's content is an adjudicated opaque
  payload (a point-in-time snapshot or an external original whose
  structure is deliberately *not* modeled). Generators keep the DTO
  field a `String`, annotate it as opaque, and store it verbatim.
  Setting it is an owner adjudication, recorded per field; a `JSON`
  field that is neither `opaque` nor expanded (below) is an un-adjudicated
  leftover, not a design.
- `info.structure: { name, fields: [{ name, dataType }] }` — the
  adjudicated expansion of a `JSON` field into a typed sub-document.
  `name` is the generated DTO's name; `fields` is the sub-document's
  field list, and every entry must trace to a definition the tree
  already carries (an event payload field, a value object's members) —
  expansion structures are never invented at generation time. The
  generator emits the DTO beside the view DTO and a typed storage
  codec; the field's `dataType` stays `JSON` (the marker, not the
  type string, carries the Phase 2 semantics).
- `info.queryable: true` — on a `List`-typed field: the list's elements
  are a query dimension. Generators emit an element finder
  (`findBy<Element>`) and the matching element index (SQL: the
  sub-table's `value`/key columns). Absence means the list is stored
  structured but not element-queryable.
- `info.finder: true` — on a scalar field whose name does not end in
  `Id`: the field is an adjudicated query dimension. Generators emit a
  `findBy<Field>` finder and the Q5 tier-3 same-name index (SQL DDL /
  Mongo index spec), exactly as for `*Id` fields (Q7,
  FsmDefinitionDecisionView.aggregateName).

Read-model storage registration (v0.5.2). A view's backend is declared
on its storyMapping `readModel` note's `info.storage` — and **the
absence of the `storage` key is itself the SQL declaration**: every
SQL-backed view carries a readModel note with no `storage` key, while
mongo/graph/vector views spell one out. A view with field notes but no
readModel note at all is *unregistered*, whatever its fields claim.
Tenant scope follows the aggregate, never the view template: a view
whose aggregate is not tenant-scoped (no `tenantId` on its events,
commands, or state) must not carry a `tenantId` field note either —
the tenant query pair and the tenant index are field-driven and are
generated only when the field exists. The converse also holds: when
the owner rules an aggregate tenant-scoped, `tenantId` is stamped at
the aggregate source (creation command parameter, event payloads,
state field — the question aggregate's shape), never left as an
unbacked view field (Q7 ruling, 2026-10-20: FsmDefinitionDecisionView
kept its `tenantId` field note and the fsm-definition aggregate was
stamped to back it). Supplementary indexes beyond the Q5 tiers are
declared on the readModel note as `info.extraIndexes:
[{name, columns}]` and emitted by the DDL generator in declaration
order (Q7: QuestionListView `(tenantId, status)`).

Domain-service atoms (`domain-services/*.port.yaml`, v0.5 E1) declare a
cross-aggregate port: `payload` = `{name, fq, zh, testRef?, methods:
[{sig, zh}], bridge?: {fq, target, module?}}`. They are the truth source for
the port trait files (service generator emits trait + thin Bridge verbatim
from `methods`/`bridge`). A port belongs to no single aggregate; functions
reference it by `portTrait: <fq>` from their anchor slice.

Slice `payload.declaredFunction` (optional, v0.5 E1) declares a Function —
the named verb behind an `fn:<id>` fold verb or an `expr:` call in that
slice: `{id, zh, category, anchoredTo, seam, signature, callExpr, portTrait?,
scalaImpl?, implRef, real, io, ...}` copied verbatim from the function
spec. Category ids come from the toolchain registry
`lib/function-categories.json` (the function taxonomy). `implRef` is a plain
reference — the implementation is code, never tree content.

`use-cases.yaml` (optional, single file) carries the flow model:
`{useCases: [{useCase, preconditions[], steps[{id, story, command, aggregate,
emissions[]}], extensions[]}]}`.

## Two SEQs — read this before numbering anything (v0.4)

The word "seq" names **two different things**. They are documented separately
because conflating them is the #1 source of "machine smell" complaints:

1. **Board capture position** (`origin.seq` on notes/policies): where the sticky
   note sat on the workshop board when captured. An event's *position in the
   business flow* (the event-storming sequence matrix: timeline/sequence/step)
   is **problem-space content** — "what happened before what" is the business
   narrative itself, and it stays in the tree. But the *mechanics* of keeping
   those integers contiguous (`0..n-1`, renumbering 47 notes because you
   inserted one) are the compiler's job: `decompose` densifies by construction,
   `compile` sorts by value, and V2 contiguity is a notice, not a hand-editing
   obligation.

2. **Catalog order** (`seq` on aggregates / value-objects / read-models /
   stories): "which aggregate is #n". This is **not tree content** — it is
   compiler-derived. v0.4 makes it optional: omit it and the compiler orders by
   directory/file name (deterministic). Keep it only to pin a legacy order;
   when present it must be an integer and collision-free (V12 hard).

Rule of thumb: if removing the number would lose business meaning, it is
problem-space and stays (case 1). If it only exists so the compiler can sort,
it is mechanics and goes (case 2).

## The pipeline atom (v0.4 — scenario A)

A pipeline is an **ordered business-step queue**: the named stages of a
repeatable business process (a batch chain, a fab route), each step with its
own inputs, outputs, and failure modes. It is the scenario-A counterpart of
the workshop's event flow — reverse-engineered from code, not captured from
stickies.

```yaml
# ═══ truthsrc atom — hand-editable; contract: SCHEMA.md ═══
kind: pipeline
id: batch-chain
name: Six-Stage Batch Chain
description: The six business steps of one batch, in fixed order.

steps:                           # verbatim JSON array — the compiler never rewrites it
  [
    {
      "id": "file-gen",
      "name": "Generate batch file",
      "description": "Encode items into the transfer file.",
      "reads": ["items"],
      "writes": ["generatedFile"]
    }
  ]
```

- **Vocabulary**: `steps`, never `stages`. ("Stage" is overloaded: pipeline
  step vs equipment stage vs workshop stage. The step vocabulary is the shared
  resume language: a breakpoint is always "which step finished last".)
- **Shape**: scalar headers first (`id`, `name`, `description`, …), then the
  `steps` JSON block and, when explicitly opted in, the schema-validated
  `execution` JSON object. Arbitrary additional rich headers remain unsupported.
  Legacy pipelines without execution remain document-only; shape validation does
  not prove that bindings, codecs or external effects are safe.
- **Canonical**: `pipelines: [{id, name, description, …, steps}]` (omitted when
  empty). File order is the canonical order.

| Rule | Check | Level |
|---|---|---|
| PL1 | `id` and `name` present | hard |
| PL2 | `steps` is a non-empty array; every step is an object with `id` + `name`; step ids unique within the pipeline | hard |
| PL3 | header fields other than `steps`/`execution` are scalars; block sections follow all scalar headers (roundtrip fidelity) | hard |
| PL4 | explicit `execution` and every step execution declaration conform to the versioned execution schema; orphan or unknown execution fields fail | hard |

The public `compile-execution` and `compile-sagas` commands validate the tree
before projecting it, then compile the selected contract with an explicit
binding. Use exactly one of `--tree` or `--in`, and an explicit `--out` outside
the truth tree. Unknown/repeated flags, input/output aliases, symbolic-link
outputs and different existing output files are rejected. Output is
**contract-only**, not runtime certification.


## The scenario atom (v0.4 — scenario A)

A scenario is a **narrative script**: a demo runbook, a scale test, a
deterministic story the business tells ("100k customers flow through two
chains; the same customer always gets the same result"). Free-form content
rides in an opaque `script` block.

```yaml
# ═══ truthsrc atom — hand-editable; contract: SCHEMA.md ═══
kind: scenario
id: scale-demo
name: Scale Demo Script
description: Deterministic demo script with 100k customers.

script:                          # verbatim JSON — opaque to the compiler
  {
    "customers": 100000,
    "batch_size": 2000
  }
```

| Rule | Check | Level |
|---|---|---|
| SC1 | `name` and `description` present | hard |
| SC2 | header fields other than `script` are scalars; block sections follow all scalar headers (roundtrip fidelity) | hard |

## The Saga atom (2026-10-22 — additive tree product)

A Saga is an independent **cross-aggregate transaction product**, not a new
inbox stage and not a pipeline's checkpoint/recovery mechanism. Authored
knowledge belongs in `sagas/<slug(id)>.saga.yaml`; use the existing
`parseDoc` / `emitDoc` API, with scalar headers followed by one `payload`
JSON object. No alternate YAML parser or hand-formatted JSON block is needed.

```yaml
kind: saga
id: money-transfer
name: Money Transfer
version: v1
# seq: 0                         # optional; only to pin product order
payload:
  {
    "purpose": "Transfer reserved funds between accounts.",
    "provenance": {
      "status": "designed",
      "source": "New design, not a historical workshop note"
    }
  }
```

This is a **surface-format example only**, not an executable Saga definition.
`id`, `name`, and definition `version` are required headers: id/name must be
non-empty strings; version is a non-empty string or a positive safe integer.
The filename is exactly `${slug(id)}.saga.yaml`, using `lib/shared.mjs slug()`;
it is not derived from display name or invented by hand. Saga ids are unique
across the family (even across definition versions). A present `seq` is a
non-negative safe integer, unique within `sagas/`; omit it when order need not
be pinned. If every Saga has seq, canonical order follows seq; otherwise it
follows filename and mixed seq presence emits SEQ1. Sparse seqs are preserved,
never densified or invented. Additional headers use the existing string/number
scalar format; all rich content belongs in payload, after all scalar headers.

**Canonical**: `sagas: [{id, name, version, …, payload}]` preserves the **whole
atom except `kind`**, including authored header order, optional seq presence,
version and payload. This is deliberately **not** the catalog's payload-only
projection: identity must not disappear or be inferred from payload.
`decompose` writes the headers and JSON block back via `emitDoc`, without
inventing notes, origins, versions, seqs or execution history. No Saga products
means no `sagas` canonical key and no new product directory on decomposition;
legacy no-Saga canonical bytes and constructor APIs are unchanged. The
canonical `schemaVersion` remains `truthsrc/v1`.

| Rule | Tree-level check | Level |
|---|---|---|
| V1 | each YAML file in `sagas/` parses; `kind` is exactly `saga` | hard |
| SA1 | scalar id/name/version identity, exact id-derived filename, no duplicate ids; misnamed YAML is diagnosed, not silently ignored | hard |
| V12 / SEQ1 | optional seq is a non-negative safe integer and collision-free / mixed presence uses filename order | hard / notice |
| SA2 | payload is a non-null JSON object, not an array/scalar | hard |
| V3 | payload id/name/version, **if repeated**, agree with the header | hard |
| SA3 | only payload is rich content; scalar headers come first and must survive parse/emit unchanged | hard |
| SA0 | basic tree fidelity only; payload/additional headers are not execution-validated | notice |

**Validation boundary**: these rules certify transport fidelity, not a TCC
contract. Payload internals, unknown execution keys/capabilities, references,
typed args, bindings, participant phases, commit/abort decisions, retries and
outcomes require a separate strict Saga semantic/compiler gate. A green
`validate` / `compile` / `roundtrip` does **not** make unknown keys valid or a
Saga runnable. Technical bindings and runtime certification are not supplied
by this tree projection. New knowledge records its real design provenance;
it must not manufacture historical stickies or claim observed execution.

## The 13-artifact inbox (v0.4)

A workshop is a sequence of *products*, not a bag of stickies. v0.4 fixes the
inbox layout to one directory per product, in canonical order — the directory
order **is** the order; there is no separate "stage" concept to maintain.
Each directory holds notes in the **standard note shape** (`kind: note`,
`type`, `name`, `origin: {stage, board, seq}`, `payload`); the `origin.stage`
uses the v0.3 stage code from the mapping table, so the toolchain treats
`01-event-flow/` exactly like the old `inbox/eventStorming/`. Event notes
carry their flow position in `origin.seq` and in `payload.info.sequence` —
the position is problem-space (see "Two SEQs"); the integer mechanics are the
compiler's.

| # | Directory | Product | v0.3 stage code |
|---|---|---|---|
| 01 | `01-event-flow/` | 事件流 — domain events in flow order, each with `sequence` | `es` eventStorming |
| 02 | `02-commands/` | 命令与触发 — commands, roles, external systems, command→event links | `cs` commandStorming |
| 03 | `03-aggregates/` | 聚合清单 — aggregate boundaries | `ad` aggregateDiscovery |
| 04 | `04-subdomains/` | 子域划分 | `sd` subdomainExploration |
| 05 | `05-context-map/` | 上下文映射 — bounded-context-level relations | `cm` contextMapping |
| 06 | `06-aggregate-detail/` | 聚合细化 — state, fields, value objects | `rf` refining |
| 07 | `07-aggregate-relations/` | 聚合间关系 — which aggregate references which (cardinality + business meaning) | `rf` refining |
| 08 | `08-message-detail/` | 消息字段细化 — event/command field definitions | `rf` refining |
| 09 | `09-lineage/` | 字段血缘 — field-level lineage | `rf` refining |
| 10 | `10-policies/` | 策略定义 | `cs`→`rf` commandStorming→refining |
| 11 | `11-stories/` | 用户故事 | `sm` storyMapping |
| 12 | `12-use-cases/` | 用例 | — (flow model) |
| 13 | `13-read-models/` | 读模型 — definitions incl. fields + lineage | — (read models) |

Notes:
- **Roles are the permission model.** The role vocabulary in `02-commands/`
  and `13-read-models/` must be one and the same set of ids. Role notes carry
  `can_issue` (commands) and `can_view` (read models); read models carry
  `visible_to`. "Role × command (issue) + role × read-model (view)" is the
  complete permission matrix — no separate artifact needed. Where a codebase
  has no explicit roles, record the minimal honest set (e.g. a human operator
  role + `system` for automatic steps) and mark the assumption.
- **#5 vs #7**: context-map holds bounded-context-level collaboration;
  aggregate-relations holds aggregate-level references. Different levels, no
  overlap.
- Directories with no genuine content for a given domain are skipped (record
  the reason in `inbox/README.md`) — an empty product is worse than an absent
  one.

## Problem-space vocabulary (v0.4 requirement)

The tree is written in the **problem space** (DDD ubiquitous language), never
the solution space:

- **Use**: the words the business itself uses — 充值/申购/客户订单/异常池,
  lot/FOUP/recipe/track-in/量测/OCAP. One term, one meaning, consistent across
  the whole tree. A domain expert should be able to read it cold.
- **Never**: implementation mechanics — framework and persistence vocabulary
  (cursors, journals, snapshots, shards, entities-as-infrastructure, serializers)
  do not belong in the tree. Business *semantics* stay ("after an interruption
  the run continues from the breakpoint without repeating finished steps");
  *mechanisms* go.
- **Test**: remove every technical term — if the tree still stands and the
  business reader still follows it, the vocabulary is clean.
- ES4 (solution-language verbs in event names) remains a notice, but v0.4
  elevates the principle: the vocabulary requirement above is the convention
  every new atom is held to, in review as well as in the gate.

## Relation registry (v0.5)

Relationships between knowledge elements are **typed and declared**, a
first-class metamodel citizen next to `ATOM_KINDS` (see `RELATION_REGISTRY` in
`lib/shared.mjs`). Query verbs derive from it (§"Query library"): adding a
relation grows the query surface without engine changes — verbs are grown, not
designed.

`propagates` marks whether the relation carries *impact* and is adjudicated by
a human domain expert, not the tool (the flags below are the initial human
ruling). `blast_radius` walks exactly the `propagates=true` edges, with
"可能影响" (may-impact, over-approximate) semantics:宁多报，不漏报.

| # | from → relation → to | propagates | 来源产物 | 说明 |
|---|---|---|---|---|
| R1 | aggregate —owns→ slice | ✅ | 03/06 | 结构归属 |
| R2 | aggregate —references→ aggregate | ✅ | 07 | 聚合间引用（引用/基数/业务含义） |
| R3 | aggregate —emits→ event | ✅ | 06 | 事件池归属 |
| R4 | slice —issues→ command | ✅ | 02/06 | 切片发出命令（1:1，命令节点即其切片） |
| R5 | slice —emits→ event | ✅ | 06 | 切片产生事件（定义归属） |
| R6 | command —produces→ event | ✅ | 08 | 命令产生事件，条件见切片 guards |
| R7 | event —triggers→ policy | ✅ | 10 | 事件触发政策 |
| R8 | policy —constrains→ slice | ✅ | 10 | 政策约束切片 |
| R9 | policy —invokes→ command | ✅ | 10 | 政策调用命令 |
| R10 | read-model —derives-from→ field | ✅ | 09/13 | 读模型派生自字段（血缘） |
| R11 | field —lineage→ field | ✅ | 09 | 字段血缘链 |
| R12 | role —can-issue→ command | ❌ | 02 | 权限，不传播行为影响 |
| R13 | read-model —visible-to→ role | ❌ | 13 | 权限，不传播行为影响 |
| R14 | pipeline —has-step→ step | ✅ | 01 | 流程步骤 |
| R15 | step —performed-by→ role | ❌ | 01/02 | 参与关系 |
| R16 | step —executes→ slice | ✅ | 01/06 | 步骤执行切片 |
| R17 | story —covers→ use-case | ❌ | 11/12 | 追溯，不传播 |
| R18 | use-case —realized-by→ slice | ✅ | 12/06 | 用例由切片实现 |
| R19 | scenario —exercises→ pipeline/slice | ❌ | 场景 | 演练路径 |
| R20 | value-object —used-by→ aggregate/slice/field | ✅ | 06/08 | 值对象被使用 |
| R21 | context —depends-on→ context | ✅ | 05 | 限界上下文依赖 |
| R22 | aggregate —belongs-to→ subdomain | ❌ | 04 | 归属 |

### Relation carriers (encoding decision)

v0.5 keeps the **kind-specific fields** and defines this mapping table — it does
*not* introduce a uniform `links` array. Rationale: a uniform array would force
rewriting every atom of every existing tree and would break the roundtrip
byte-identity gate (I2); the kind-specific fields already carry the relation
data and are roundtrip-safe. Where no kind-specific carrier exists, an
**explicit** `payload.links` object `{relation, target}` (target form
`"kind:id"`, e.g. `{relation: "constrains", target: "slice:replay-exception"}`)
fills the gap — R1/R2 validate it.

| Relation | Carrier in the tree |
|---|---|
| R1 aggregate owns slice | aggregate dir + `order.commands[]` → slice(command) |
| R2 aggregate references aggregate | explicit `{relation:"references", target}` (07 notes are prose-only in current trees) |
| R3 aggregate emits event | `order.events[]` + slice `events` pool → event |
| R4 slice issues command | synthesized 1:1 — one command per slice (V4/V5); the command node aliases its slice |
| R5 slice emits event | slice `payload.produces[]` ∩ event pool (definitions live in the aggregate pool per V6) |
| R6 command produces event | slice `payload.produces[]` (guards carry the conditions) |
| R7 event triggers policy | policy `triggers[].event` (structured block; V7/V8 dual-track) |
| R8 policy constrains slice | explicit `{relation:"constrains", target}` (no carrier in current trees) |
| R9 policy invokes command | policy `invokes[].command` (structured block; V7/V8 dual-track) |
| R10 read-model derives-from field | read-model `fields[].source` (`eventField:E.f` \| `aggregateIdentity`) |
| R11 field lineage field | 09-lineage note `payload.links[]` `"A → B"` arrows (chains split pairwise) |
| R12 role can-issue command | role note `payload.can_issue[]` |
| R13 read-model visible-to role | read-model `payload.visible_to[]`; inverse populated from role `payload.can_view[]` |
| R14 pipeline has-step step | pipeline `steps[]` (JSON block) |
| R15 step performed-by role | `step.actor` (absent in current trees) |
| R16 step executes slice | `step.slice` (absent in current trees) |
| R17 story covers use-case | explicit `{relation:"covers", target}` (no carrier in current trees) |
| R18 use-case realized-by slice | `use-cases.yaml` payload (no use-cases in current pilot trees) |
| R19 scenario exercises pipeline | scenario `script` (free-form; no machine-readable carrier) |
| R20 value-object used-by X | explicit `{relation:"used-by", target}` (dataType prose refs not parsed) |
| R21 context depends-on context | 05-context-map notes (prose-only in current trees — needs from/to) |
| R22 aggregate belongs-to subdomain | 04-subdomains (skipped in single-context trees) |

### Query library (v0.5)

`lib/query.mjs` — the DESCRIBE-model API over **compiled** `canonical.json`
(not raw trees). Ten verbs: `describe(kind,id,full?)`, `expand(id,
{depth=1, direction, relations, limit=100})`, `blast_radius(id, {depth=3})`
(propagates-only edges), `lineage(field)`, `anchors(kind,id)`, `search(q)`,
`conditions(command)`, `diff(a,b)`, `orphans()`, `consistency_check()` — plus
registry-derived named verbs (`slices_of`, `policies_triggered_by`,
`commands_of`, `read_models_of`, `steps_of`, `participants_of`,
`consumed_by`, `trigger_source_of`, …).

Uniform envelope: `{summary, result, next_actions[], budget{depth_used,
nodes_visited}}`. `describe` defaults to summary; `full=true` returns the atom.
`anchors()` honestly reports `{status:'unanchored', result:[]}` until the
back-anchor work lands code anchors in canonical.json — never faked.

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
  "useCases":     { "useCases": [] },
  "pipelines":    [ { "id": "batch-chain", "name": "...", "steps": [ { "id": "file-gen", "name": "..." } ] } ],
  "scenarios":    [ { "id": "scale-demo", "name": "...", "description": "...", "script": { "...opaque..." } } ]
}
```

- `sessions` — the L1 face: verbatim note payloads (policies ride along) in
  `(stage, board, seq)` order.
- `aggregates` — the solution contract: payload + `commands` filled from slices
  per `order.commands` + `events` filled from the pool per `order.events`.
  Decisions and folds are **not** in canonical — derive them with the formulas
  above.
- Catalog arrays are ordered by `seq` when present, otherwise by file name
  (v0.4 — `seq` is optional; see "Two SEQs"). `pipelines`/`scenarios` are
  omitted when empty (v0.4 additive extension — `schemaVersion` stays
  `truthsrc/v1`).
- `useCases` is omitted when `use-cases.yaml` is absent.
- `sagas` is omitted when empty. Each Saga entry is the whole atom minus
  `kind` (headers + payload); seq, when authored, is preserved with the same
  uniform-seq/file-order rule, never projected into the payload.
- A present tree-level `seq` rides along as a compiler-reserved sibling key in
  the corresponding canonical product (per the three-layer key test it is a
  migration/tool artifact, never tree semantics); absent `seq` emits nothing.
- `inboxLayout` (v0.4, optional): maps `"<stage>|<board>|<seq>"` → the inbox
  subdirectory the note was read from. Emitted only when the tree uses v0.4
  product dirs (`01-event-flow/` …); `decompose` uses it to reproduce the exact
  layout. v0.3 trees emit nothing and decompose defaults to stage-code dirs.

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
- **Saga identity** = scalar header `id`, unique in `sagas/`; its definition
  `version` is explicit and survives canonical/decompose, never inferred.
- **Board order** = `origin.seq` (frozen at capture; never renumbered by tools).
- **noteId** (if your capture pipeline mints one) lives in `payload` and is
  passed through untouched — it is downstream identity, not tree identity.
- **elementHash** (optional) lives in `payload` immediately after the
  `noteId` of the element it fingerprints: a 16-hex-char fingerprint of that
  knowledge element, carried so generated code can emit the full
  `@knowledge <noteId>@<elementHash>` anchor. It is a **read-only anchor**:
  tools pass it through untouched and never recompute, mint, or update it.
  Seed-backfilled once from the 2026-10-11 generation (user adjudication,
  2026-10-20) for exactly the noteIds that generation annotated; elements
  without a seed keep no `elementHash` (absence is meaningful — do not
  backfill by inference). Like `noteId`, it is downstream identity, not
  tree identity.
- **Restored atom (2026-10-20)**: the storyMapping readModel note
  `PauseProjectDecisionView` (noteId `fec73b9c-c76c-4b76-a502-c3a5b2785585`,
  elementHash `035607b1ed592a9c`) was missing from the tree although every
  other readModel note survived; its `info.projectionRefCodes` survive
  verbatim in the pre-tree compiled metadata (`kn-system-metadata-v11.json`,
  byte-identical across all copies). The note was restored from that source
  at `aggregates/project/notes/readModel-sm-pause-project-decision-view-777.yaml`
  with the next storyMapping seq (777; existing seqs are never renumbered).
  A missing atom is restored from evidence, never re-authored.
- **Restored causal links (2026-10-20, B-CAUSAL)**: the migration dropped every
  `event:Y@strong` / `event:Y@eventual` causal link (§CS) from event-note
  payloads. Exactly three existed in the corpus; all three survive verbatim
  in the pre-tree commandStorming board payload
  (`.ingest/metarch-stage02-payload.json` in the legacy backend-codegen repo)
  and were restored from that evidence: `event:TenantOwnerDesignated@strong`
  appended to the `TenantOnboarded` cs note's `links`,
  `event:MetadataConsumed@eventual` appended to the `MetadataExported` cs
  note's `links`, and the whole `StageApproved` cs note — missing like
  PauseProject above — recreated at
  `aggregates/stage/notes/event-cs-stage-approved-114.yaml` (noteId
  `40b95b31-ca40-4f86-af0b-ede9a83e1fc6`, the id its other stage variants
  share; elementHash `c255afc18ace0ba5`; seq 114, the next commandStorming
  board1 seq) with its stage02 payload (`event:SessionClosed@strong`).
  Generators render these links as `// 因果溯源:` comments in EventHandler
  cases. Restored from evidence, never re-authored.

## Surface carry (v0.5.1, 2026-10-20, B-TREESTAGE)

The canonical projections above are payload-centric: they do not carry every
byte of an atom's surface (headers, origins, stored blocks, physical
residence). Before v0.5.1 that made `decompose(compile(tree))` differ from
the tree in ~1,900 places on the metarch tree (tree-stage roundtrip red).
v0.5.1 closes the gap with **additive, compiler-reserved carry keys** —
present in canonical only when the tree atom carries the data, and written
back verbatim by decompose. No other canonical content changes shape.

- `noteSurface` (top level, keyed `stage|board|rank` like `inboxLayout`):
  per note, only the non-default fields — header `id` when it differs from
  `payload.noteId` (`null` = the atom has no header id), origin
  `author`/`createdAt` when the atom's origin carries those keys, and origin
  `seq` when it differs from the note's positional rank in its scope.
- `noteResidence` (top level, same keys): the note's physical directory
  (relative to the tree root) when it differs from decompose's default
  placement (`policies/` for policies, the owning aggregate's `notes/` for
  owned command/event notes, `inbox/<layout dir>` otherwise). Residence is
  the tree's organisational semantics; it is recorded, never recomputed
  away.
- Aggregate entries: `context`, `bmExtra`, `extraFolds` verbatim;
  `orderDecisions` / `orderFolds` (the stored `order.decisions` /
  `order.folds` lists — historical index orders, not derivable from
  `order.commands` / `order.events`); `eventResidence` (event name →
  defining slice's command, or `null` for `extraEvents`) recorded only
  where the definition's residence differs from the default (first
  producing command).
- Command entries: the slice's stored `decision` / `fold` blocks verbatim.
  The §slice formulas describe how these blocks were originally derived,
  but the stored blocks are **not** reproducible from payload + pool in
  general: stored folds carry override assignments (e.g. `patch:event.*`
  expressions) that the event definitions' `foldAssignments` do not, and
  stored decision guards predate the payload guard normalization
  (scalar/array shape drift in 11 guards). They are therefore carried as
  authored surface, like the payload itself. **Owner ruling (2026-10-20):**
  verbatim carry stands — stored decision/fold content is information and
  is never dropped for format reasons; where only the *shape* has drifted,
  the shape is normalized and the information is kept in the new form.
  Under that ruling the 11 drifted guard fields were normalized in both
  metarch trees, each to match its payload guard exactly (`notStatus`
  scalar → single-element array ×5, `notStatus` `""` → `[]` ×3, `from`
  single-element array → scalar ×3, across 9 slices); every conversion is
  lossless and all other stored bytes are untouched. (This supersedes the
  "decisions and folds are never stored" line in AGENTS.md for trees that
  already store them; re-deriving them wholesale is a schema decision for
  the tree's owner, not a compiler behaviour.)
- Root: compile accepts the workshop name under either `name:` or
  `workshop:`; `workshopKey: "workshop"` is recorded when the tree uses the
  latter, and decompose writes the tree's own spelling back.
- Policy atoms: decompose re-derives the structured `bindings:` block from
  `payload.info.bindings` (verified a verbatim mirror of the stored block
  on every policy in the corpus) and the filename from
  `policy-<stage-code>-<slug>-<seq>` with the atom's own origin seq.
- Catalog atoms: the header `id` is the payload's `id`, else its `noteId`
  (value objects carry identity in `noteId`; atoms with neither emit no id
  line). Read-model filenames drop the `DecisionView` suffix.
- `slug()` is per-character (every non-`[a-z0-9]` char becomes one `-`,
  runs not collapsed, edges kept) — the reference shape the metarch tree's
  filenames were built with.

With the carry in place, both metarch trees were surface-normalized once
(regenerated from decompose output; canonical byte-identical before and
after). Deliberate adoptions in that normalization: subdomainExploration
filenames converge from the migration-era `sx` code to the documented `sd`
code (121 files renamed, content untouched), policy atoms gain the
`type: policy` header line, and `workshop.yaml`'s `schemaVersion` adopts
the toolchain stamp `truthsrc/v1`. Tree-stage roundtrip is green on both
trees from v0.5.1 on.
