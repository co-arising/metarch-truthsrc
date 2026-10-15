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
emitted file: `path, kind, schemaNode?, schemaCategory, families[], deps[]`)
is what the closure engine runs over — it doubles as the drift detector: a file on disk
with no ledger row is hand-written, and regenerating with `--concern` will not
touch it. Rows merge with the outDir's prior ledger by path, final-writer-wins
(when one face overwrites another's file, its row replaces the old one). Invocation:

```text
truthsrc generate --in products/ --out repo/ --generator scala-cqrs-es \
                  --concern aggregate-scaffold --families Loan
```

### The engine, as landed (V4-4 inc14)

`src/core/concerns.mjs` is a verbatim port of the production `concerns_lib`
(E5-WP1, 2026-09-12): `loadConcernRegistry` (fail-fast on bad JSON, unregistered
flavors, unknown schema categories), `resolveConcernFilter` (concern ×
`--families`; familySets expand and dedupe), `inScopeOf`/`expandScope` (the
kind × category × families predicate over ledger rows) and `compileClosure`
(deps closure to fixpoint, double-keyed by `schemaNode` and file stem —
external types that resolve to no row drop out, exactly like production).

`deps` are generated-artifact identifiers (class names = file stems) declared
by the generators; they carry the real compile edges (protocol↔entity,
controller→`<Agg>Protocol`/`<Agg>Repository`), so the closure mirrors
production's converter→protocol behavior: whatever an in-scope artifact
compiles against comes along, cross-flavor.

With `--concern`, `apply` regenerates in place under the computed scope:

| plan entry | write policy |
|---|---|
| inside the closure | written (overwrite allowed — this is the regeneration) |
| family artifact outside the scope, file exists | kept — the on-disk version is authoritative (zero-diff refill parity) |
| family artifact outside the scope, file absent | written (a new family's first fill) |
| global artifact (`families: []`) | always written and disclosed (family filtering does not apply to cross-family shared artifacts) |

Without `--concern` the apply contract is unchanged (refuse to overwrite a
differing file — MERGE-protected blocks land in the diff-apply batch; the
concern scope is the in-place regeneration path). After writing, a scope-leak
gate re-checks that every family artifact whose content changed sits inside
the closure (an engine/write-policy disagreement refuses to certify), and the
ledger records the audit chain (`ledger.concern`: name, families, scope-file
hash, in-scope / closure / kept / global counts).

Two operational contracts mirror the production pipeline:

- **Replay the chain.** Concern scope is path-scoped, and the skeleton and
  rules faces share the Behaviors/CommandHelpers paths. A skeleton `--concern`
  run transiently writes skeleton glue over the rules-owned paths; re-run the
  rules generator (its own concern, or `full`) to re-assert its face — the
  exact analogue of production's in-run pipeline order (skeleton pass, then
  the rules pass overwrites the glue).
- **Presets are project config.** The registry lives next to the consuming
  project (default `./concerns.json`; `--concerns <file>` points elsewhere);
  the reference registry for the metarch corpus is
  `golden/scala-cqrs-es-metarch/concerns.json`. Its flavors map the reference
  generators' exact `artifactKinds` — the production registry has a vocabulary
  drift (flavor `behavior`/`policy` vs its own ledger's
  `behavior-skeleton`/`policy-exec`) that truthsrc avoids by mapping what its
  generators actually emit.

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

### Real truth-source baseline (inc4) — metarch, `@knowledge` anchors

The byte-identity baseline is the **metarch truth source** (`golden/scala-cqrs-es-metarch/`,
aggregate `Subdomain`), generated from the live `CodegenMain` IngestedSystem run
(multi-module), not the banking Examples demo. The CreditBalance fixture is kept as
the regression for the *no-anchor* path. Two extra inputs mirror the internal
generator's two independent sources:

- **structure + noteId** come from the canonical (every anchored field carries a
  `noteId`);
- **the `@<hash16>` suffix** comes from `elementHashes` — a `{ noteId: hash16 }`
  sidecar (`golden/scala-cqrs-es-metarch/elementHashes.json`, a slice of the graph
  export's `elementHashes`), passed as the `elementHashes` option. The generator
  only looks it up (`env.anchor(noteId)`); the hash is computed upstream by the
  knowledge export, exactly as the internal `CQRSApplicationGenerator` reads a
  precomputed `elementHashes` map. A missing entry yields a bare `@knowledge <uuid>`.

Anchor doc comments render as `@param <name>[ <desc>]  @knowledge <uuid>@<hash16>`
on command/event/state/factory members, and a bare `@knowledge <uuid>@<hash16>`
before the entity object and the repository trait.

The metarch baseline also exercises convention slots that are data, not hardcode:
`commandFamily` (trait name; the command-handler alias is derived by replacing the
first `Command` with `CommandHandler`), per-command reply names, a verbatim
`persistence.tagPrefix`, `empty()` neutral-value derivation per field type, and the
`triggeredBy` ordinary parameter. Imports follow the internal rule exactly — the
sorted **multiset** of fqns over the set of distinct fully-qualified TypeRefs
(distinctness includes type parameters), filtered by a pure package comparison
(`shouldImport`); module layout never affects the import set.

### Richest-aggregate breadth (inc5) — metarch `ModelCatalog`

A second metarch aggregate, `ModelCatalog`, is pinned byte-identical to live
`CodegenMain` (`golden/scala-cqrs-es-metarch/model-catalog.canonical.json` +
`model-catalog.elementHashes.json`, test `scala-cqrs-es-metarch-modelcatalog.test.mjs`).
Where `Subdomain` is the simplest aggregate (2 write commands, 2 events, no value
objects), `ModelCatalog` is the opposite extreme and forces the breadth paths:

- **8 write commands + 1 query, 8 events** — commands/events/replies/helpers render
  in **alphabetical** order with the `Get<Name>State` query command appended last; the
  factory's init command is the alphabetically-first write command (`ApplyKnowledgePatch`).
- **5 value objects** — `List[CatalogConflict]`, `CatalogConflictSet`, `CatalogPatchSet`,
  `List[ConceptDelta]`, `List[ConceptIndexEntry]` resolve to `net.imadz.metarch.domain.values.*`
  imports via each field's `typeImport`; the import multiset emits
  `scala.collection.immutable.List` once per **distinct** `List[X]` (four lines).
- **fold-expr vocabulary** the Subdomain folds never hit — `literal:X` → a quoted string
  (type-aware: numbers/`Nil`/`null`/booleans stay bare), `expr:…` strips its prefix, and
  `event.X` / `fn:X` pass through verbatim; and **every** event gets a handler case, an
  empty-fold event rendering identity `state`. Mirrors `AssemblyEngine.foldAssignmentsToRefCode`.

The canonical + sidecar are produced by **`tools/extract-metarch-canonical.mjs`**, a
structural projection of a backend-codegen graph export (`fieldTree.aggregates[<name>]` +
`elementHashes`) into the canonical schema — all code-shaping decisions stay in the
generator, so the byte-identity gate validates the extractor and generator jointly. The
extractor reproduces the hand-authored Subdomain canonical exactly (modulo the ignored
`defaultValue`, which the generator recomputes from the field type).

**Scope boundary (confirmed by reading the live file):** `CodegenMain` emits only the
aggregate **skeleton** — `ModelCatalogBehaviors` wires `queryBehaviors` alone. The
`runReplyingPolicy` write-flow wiring in the live `ingested-app` file carries a
`@generated by rules_domain_gen` header: it is produced by a **separate** generator
(the V4-3 rules/projection face), not the skeleton port. This gate therefore covers
skeleton breadth, not policy wiring.

### The rules face (V4-3) — a second generator, semantically derived

`generators/scala-cqrs-es-rules` is a **second generator** over the same canonical. It
reproduces the production `rules_domain_gen` pass, which *overwrites* the aggregate's
behaviors glue (and adds the domain rules) after `CodegenMain` has written the skeleton —
mirroring the real two-pass pipeline (skeleton, then rules win on the overlapping paths).
inc6 ported `CommandHelpers`, inc7 added `Behaviors`, inc8 added `RuleParams`, inc9
added `Rules` + `RulesSpec` and inc10 added `Policies` + `PoliciesSpec` (all
byte-identical to the live `di-poc` output, verified fresh by re-running `CODEGEN_MULTI=1
rules_domain_gen --agg=ModelCatalog` into a temp copy with the app/ →
modules/kernel/src/main/scala signature mirror).

The load-bearing difference from the skeleton generators: this face is **not** a structural
projection. A command's `toParam` field **order** is a union discovered over

1. the `{var}` references of the `COMMAND_PRECONDITION` rules **attributed to the command**
   (walked in declared param order), plus `triggeredBy`, then
2. the ④-layer `behaviorModel` emission bindings and `emitWhen` cond refs, in binding order.

So `AssembleMetadata`, declared `(tenantId, projectId, version, manifest, triggeredBy)`,
projects `toParam` as `(triggeredBy, projectId, version, manifest, tenantId)` — the
rule-referenced field first, then the binding order. The declared order never appears.

Per the Fork-A ruling (EP_Truthsrc_Codegen_V04), the fixtures carry the **raw** inputs and
the generator ports the discovery. `tools/augment-rules-canonical.mjs` attaches, per write
command, `preconditionRules` (`{id, noteId, expression, humanDescription}`, cases-driven
attribution: multi-command and `AGGREGATE_INVARIANT` rules demote to aggregate level and are
not attached) and the raw `behaviorModel` decision (`emissions`/`emitWhen`, binding order
preserved) from the backend-codegen `generated_rules.json` / `executable_cases.json` /
refining `behaviorModel`. The discovery itself — `collectVarRefs`, `inputFieldOf`,
`normalizeEmitWhen`, `condParamRefs` and the loop ordering — is ported verbatim into
`builders/rules.mjs`. The query command is imported (both `Get<Name>State` and its `Reply`)
but gets no helper object.

inc6 ported loops 1+2 of the union discovery only; the event-same-name and command→event
lineage augmentation loops are not yet needed (the ModelCatalog corpus does not exercise
them — verified: loops 1+2 reproduce all 9 helpers byte-for-byte) and land with the
aggregates that require them. The policy-binding loop (paramDefs ∪ policy-note
`info.bindings` keys) landed with inc10's Policies face.

**Behaviors (inc7)** — the command-flow wiring, one match case per command in declared
order. Each write command renders
`runReplyingPolicy(<rule>, <Cmd>Helper)(state, cmd)[.withPost(...)].replyWith(cmd.replyTo)`.
Three decisions are semantic, all driven by augment-attached slots:

- **Port injection is per-command**: the generator deep-walks the command's `behaviorModel`
  (`emitWhen` conds for `expr`-keyed strings, emission bindings for `expr:`-prefixed values)
  looking for `<member>.` references into the ext-port registry (`canonical.ports`, from
  `functions.yaml`'s `callExpr` PORT_RX + explicit `portTrait`). A referencing command gets
  the class form `new <Agg>Rules.<Cmd>Rule(<members>)` with an `apply(<member>: <Trait>)`
  apply overload (require-guarded closure capture); the rest wire the bare Rule object.
  ModelCatalog: exactly one — `ApplyKnowledgePatchRule(adjudicator)`.
- **`.withPost(<Agg>Rules.checkEventPostconditions)`** renders only when the aggregate has
  `EVENT_POSTCONDITION` rules over its own events (`emitsEventPostconditionCheck`).
- **`@knowledge <noteId>@<hash16>` per write case** — the command's concept noteId (now
  extracted per command into the canonical) + the elementHashes sidecar entry (the same
  `elementHashes` option contract as the skeleton generator). The `Get<X>State` query case
  is the mechanical `Effect.reply(cmd.replyTo)(<X>Reply(state))` body (S1 ruling) and
  carries no anchor.

**RuleParams (inc8)** — `domain/invariant/params/<Agg>RuleParams.scala`, one
`final case class <Cmd>Params(...)` per write command inside a single object. The field
set+order is the **same union discovery** as `toParam` (the projection VOs and the helpers
cannot disagree), the types come from the declared command parameters (`string (uuid)` →
`Id`), and `List[...]`-typed fields get ` = List.empty` (the E101 extension-slot default:
unbound slots emit their default instead of skipping the emission). Two per-class lines are
rule-driven:

- an `@knowledge` anchor line per **deduped rule targetId** — every precondition rule of a
  command carries the command's own concept noteId as `definedIn.targetId`, so a command
  with three attributed rules renders exactly one anchor (the dedup is by value);
- a doc comment listing the attributed **rule IDs** (` / `-joined, attached order) or
  `（无命令级规则）`.

The file's three import lines are decided by regex over the *rendered* field lines, exactly
as the source does: `CommonTypes.Id` when any field is `: Id`, `java.time.Instant` when any
is `: Instant`, and `<base>.domain.values._` when a type token right after `: ` (optionally
under `List[`) names a VO in the `voNames` registry — the case-class names of the target
repo's `domain/values/*.scala`, attached by the augment tool. ModelCatalog needs Id + values
(`List[ConceptDelta]`), not Instant.

**Rules (inc9)** — `domain/invariant/<Agg>Rules.scala`, the invariant object. The expression
engine (`exprToScala`, ported verbatim from `patch_core.mjs` into `builders/expr.mjs`)
translates every rule's machineSpec JSON into a Scala boolean via Option-combinator forms
(`notNull` → `Option(x).isDefined`/`notNull(x)`, `in` → `Set(...).contains`, `implies` →
`(!a || b)`, …); an untranslatable rule degrades to a sentinel condition mined from the
rule's negative executable cases (`sentinelFallback`) or is skipped — never guessed.

- **checkAggregate** opens with the RULING5 initialization gate (the creation-family
  whitelist is generator-side authority, ported verbatim) and chains the aggregate-level
  rules (`aggregateRules`, attributed cases-driven by the augment tool), each anchored at
  its own rule targetId.
- **Command checks are ④-layer guards-ordered**: the raw behaviorModel decision (now
  attached WHOLE, guards included — inc6/7/8 carried only emissions/emitWhen) drives the
  check chain in its declared guard order; each `invariantRef` guard resolves its rule,
  translates the machineSpec, and takes the rule library's humanDescription over the guard
  desc. Commands without ④-layer guards fall back to the heuristic path (rules sorted by
  `id.localeCompare`).
- **Emissions**: the fixed leg renders `Right(List(<events>))` with ④-layer bindings
  (`param.`/`state.`/`system:now`/`literal:`/`expr:`/`item` four-source annotations);
  `emitWhen` conditional legs append `::: (if (<cond>) List(...) else Nil)`. An
  untranslatable emitWhen cond is a FATAL, never a guess.
- **The Rules import face is a UNION**: the Rule-constructor ports (`rulesPortTraits`,
  expression-driven) plus the EventHandler **fold-face** ports — a `fn:<id>` fold
  assignment whose `callExpr` is Access-gate form port-ifies its trait
  (`foldPorts` slot; ModelCatalog: `ComputeCatalogStateHash` → `ContentFingerprintPort`
  imported with NO Rule taking it). This is why live `ModelCatalogRules` imports two port
  traits while only `adjudicator` is constructor-injected.
- **checkEventPostconditions**: per-event `firstBad<Event>` helpers over the attached
  `eventPostconditions` (var-ref host ∈ the aggregate's events), filtered by the
  event-construction conflict guard (a check field the producers don't guarantee non-null
  is skipped). Event noteIds come from the extract tool's new per-event projection (they
  were previously absent from the sidecar — the `@<hash>` anchors on evt rules need them).

**RulesSpec (inc9)** — `test/…/<Agg>RulesSpec.scala`, the pure-domain ScalaTest suite, one
`"<cmd> <type> <ruleId>" in { … }` block per executable case (raw rows attached as
`executableCases`, grouped by the case's own `aggregate` field). The Spec header anchors
are the sorted union of the three registration points (command-rule / event-rule /
aggregate-rule noteIds). Per case: the `patchForCases` completeness patcher (also ported
verbatim; the Node `scalaEval` evaluator mirrors the generated code's runtime semantics)
repairs `given.state`/`when.params` so the target rule is the ONLY failing one; literals
render through the `literalFor` family (`builders/literals.mjs`) — `Id` values go full FQN
`net.imadz.common.Id.of(...)` with deterministic v3-UUID sentinels, VO object values
(`CatalogConflict("","",Nil,...)`) render from the `valueObjectSigs` signatures, `status`
falls back to the aggregate-status `in` rule's first enum value. The port Impl vals (债④
closure form) are generated from the ports' full declaration face (scalaImpl + methods +
bridge from `functions.yaml`'s `ports:` section): a bridge-object impl renders as a direct
val, an object-shape impl as an anonymous-class delegation with FQ-qualified signatures.

**Policies (inc10)** — `domain/policy/<Agg>Policies.scala` + its Spec, the S2-44 reaction
face: `on(event): List[<Cmd>Params]` pure objects (对偶 domain/invariant — Rules eat
`(State, Params)` and produce Events; Policies eat Events and produce Params). The raw
inputs are policy **notes** (attached by the augment tool as `policies`, attributed by
target aggregate = `info.targetAggregate ||` command host, `generate=false` notes never
travel): `info.bindings` (command param ← `event.<field>` / `item` / `item.<field>` /
`literal:` — declaration-is-authority), `info.fanOutOn` (collection fan-out) and
`info.fanOutWhere` (filter predicate). Load-bearing decisions:

- **Params-side types come from the rendered RuleParams signature** (the source re-reads
  the file it wrote earlier in the same run — `paramDefs` order ≠ declared order, S2-46);
  the generator parses its own just-rendered rule-params content.
- **Event-side types are DERIVED**, not read: the raw ②-layer payload `dataType`s travel
  with the fixture (`evtPayloads`) and the generator maps them through the same
  normalize+scalaSig the skeleton generator renders the Entity from — derived signature ≡
  generated signature. This keeps truthsrc free of target-repo reads while preserving the
  Id-vs-String wrapping (`Id.of(e.x)` / `e.x.toString`) and the `List[X] → X` element-VO
  resolution that drive `fanOutWhere`.
- **Unbound fields** fall back to the E101 extension-slot default when the signature
  declares one; still unresolved → the whole policy skips (宁缺勿造, never guessed).
- **fanOut** renders `e.<field>[.filter(item => <cond>)].map(item => <Cmd>Params(...))`;
  the predicate goes through the same `exprToScala` lexicon as `emitWhen` conds. The Spec's
  sentinel for a filtered fan-out is the **differentiated pair** (`filterSentinel`:
  `eq`/`notEmpty` over `item.<field>` under and/or) rendered via `literalFor` over the
  element VO signature, with `Id.of`-wrapped fields forced to a parseable UUID — the
  ModelCatalog corpus has no filtered fan-out, so this machinery is exercised only when an
  aggregate carrying one lands in the fixtures.
- Spec event literals judge the **raw** dataType strings (`String (UUID)` →
  `Id.of(...)`, `List<ConceptDelta>` → VO default construction with a values import,
  VO payloads → `null` sentinel).

### The api support face (V4-4 inc11) — a third generator, global artifacts

`generators/scala-cqrs-es-api` is a **third generator** over the same canonical. It
reproduces the production `gen_api_layer` family's **global** artifacts — the pieces that
cover the whole workshop corpus, not one aggregate (their ledger `families` are empty by
the same concern semantics the live pipeline records):

- **ViewKeys** — `infrastructure/auth/ViewKeys.scala`: one `val <Const> = "<key>"` per
  gated DecisionView. Keys are the S2-17 kebab of the view name resolved through the
  viewkey rename map (old→new, unmapped pass through); the val **order** is
  `localeCompare` over the *resolved* key, so renamed views sort among their semantic
  neighbours.
- **CommandRoleMap** — `infrastructure/auth/CommandRoleMap.scala`: the PB1 derivation —
  write side `roles(c) = ∪ role:` targets of notes that link `command:c` (three co-link
  forms: command note title as cmd ref, role note title as role ref, arbitrary notes
  linking both), read side per view = `decisionSupport` commands' roles ∪ the readModel
  note's explicit `role:` links (S2-88 read/write split: readModel notes are excluded from
  write-side co-links, only contribute view read-roles). Role link targets render through
  the 14-value vocabulary (`AI Agent` → `Roles.AiAgent`); out-of-vocabulary → fail-fast.
  Empty view roles render `Seq.empty[String] // 无角色限制（scope 兜底）` with the
  trailing-comma handled per line (a 2026-09-06 compile-red lesson).
- **CommandDsl** — `infrastructure/api/CommandDsl.scala`: the static envelope
  (OkReceipt/ViewListDto/ViewItem/IdGuard/InstantGuard), verbatim text.

The ③-layer field-note gate (`gateViews`, S2-56) is ported verbatim: only views carrying
`type:'field'` notes (`info.parent` = view name) survive into the api face, and those
notes' `dataType`s enrich the view fields (UUID 口径回补). Zero-annotation-intersection
is FATAL (the gate refuses to silently pass everything); draft views without field notes
are dropped with a warning. The per-aggregate **controllers** (below) and the read side
(below) consume the skeleton pass's `Protocol.scala` output the way the live two-pass
pipeline does.

Fork-A fixture slots (attached by `tools/augment-api-canonical.mjs`): `roleLinkNotes`
(compact co-link participants — mechanical filter), `readModels` (the ③-layer read-model
face as-is), `viewFieldNotes` (the gate's annotated-view registry), `viewKeyRenames`,
`paramOrigins` (the ④-layer template origin registry, keyed `<Agg>.<Cmd>.<param>` —
the B2 origin lane's r1/enricher input), `viewNoteIds` (the ①-layer metarch readModel
note ids, first-wins — the read side's anchor source) and `mongoViewNames` (the
`storage.kind=mongo` declarations — the read side's engine axis). All derivation lives
in the generator (`builders/rolemap.mjs`, `builders/controller.mjs`).

### The controller face (V4-4 inc12) — per-aggregate B2 DSL endpoints

The same generator also emits `app/controllers/<Agg>ApiController.scala` (Play
convention: `controllers` package at repo root). The command IR is **not** carried by
the fixture — the generator renders `<Agg>Protocol.scala` through the scala-cqrs-es
skeleton generator's own `protocolModel`/`renderProtocol` (byte-identity proven by that
generator's golden gate) and parses that text with the verbatim `parseProtocol`. That
mirrors the live two-pass pipeline (gen_api_layer parses the Protocol file the skeleton
pass wrote) while keeping truthsrc free of target-repo reads.

Load-bearing decisions, all ported verbatim (`builders/controller.mjs` + `templates/
controller.mjs`/`tpl_dsl.mjs`):

- **Lane-A addressing table** (the GEN-ID bug 治本 table, builder_spec-anchored):
  `r2` body-key (`entityRef(<key>Cid.toString)`, receipt = business key),
  `httpKey` synthetic Req-only field (AssembleMetadata's `catalogId` — the protocol
  command has no such param; the event key rides the entityRef seed), `r2c` composite
  deterministic `nameUUIDFromBytes` keys, `r1` minted keys, factory `generatedId`.
  Unregistered aggregates fall through to the historical behavior — the table IS the
  fix, registering is the mechanism.
- **VO-List skip**: `List[<VO>]` params (not `List[String|Id]`) skip the endpoint
  unless whitelisted — `ApplyKnowledgePatch(concepts: List[ConceptDelta])` is the
  ModelCatalog instance (recorded in the entry's `skippedNote`, absent from the file).
  Query commands (`Reply` without an `error` slot) skip too.
- **Tier gates**: `BOOTSTRAP_TIERS` (register=anonymous, onboard/accept=global, rest
  tenant) with out-of-vocabulary fail-fast; `reqTypeOf` boundary mapping (Id/Instant →
  String, `Option[Id]` → `Option[String] = None`).
- **Guards**: IdGuard pairs from the Id-ref set (session-injected `tenantId` excluded,
  httpKey appended), InstantGuard outer / IdGuard inner wrapping.
- **Req VOs** at file tail (`Json.reads` companions, no anchor — the reqVos model has
  no noteId, matching live); per-endpoint `@knowledge <noteId>@<hash16>` anchors on the
  7 `def` lines (the controller serves commands — anchors hang off the served object).
- **OkReceipt decision-view literals**: `decisionSupport` reverse lookup through the
  rename map (`JsString("catalog-version-releases")`), `JsNull` when unmapped.
- **conf/routes**: the per-endpoint route lines are computed on the model but NOT yet
  emitted — they merge into the hand-authored `conf/routes` E301 marker block, which
  needs the diff-apply/MERGE face (deferred with the v0.4 apply batch).

Not yet ported (follow with the read side): ViewApi/ViewWrites (`buildViewModels` is
already in the builder layer), the establish-409 / Flow-delegate endpoint kinds
(templates are ported; they need Concept/User/DoR aggregates in a fixture), the
ServesUseCase anchor enforcement (story-face slot), mongo/vector/graph storage faces.

### The read side (V4-4 inc13) — ViewApiController + ViewWrites

The same generator also emits the read face (`templates/views.mjs`, verbatim port of the
production `tpl_views.mjs`): `app/controllers/ViewApiController.scala` (form B — one
single-line `def` per list/item endpoint over the 34 gated decision views, plus the
generic `tenantList`/`globalList`/`tenantItem`/`globalItem`/`compositeItem` helpers and
the `pageGuard`) and `app/controllers/ViewWrites.scala` (34 per-view `OWrites` in one
implicit domain). Load-bearing decisions:

- **Engine axis** (视图存储重设计 2026-10-08): `info.storage.kind=mongo` views (15 of 34,
  the canonical's `mongoViewNames` slot) render the list endpoint as an inline
  `findByTenantPaged`/`countByTenant` for-comprehension (SQL-level tenant push-down +
  real paging); the remaining tenant views use the `tenantList` findAll helper, User-族
  views (`deactivatedUsers`, `userProfiles`) the `globalList` helper.
- **Composite-key items** (F2 刻意契约): views without exactly one `isKey` field (notes,
  parkedKnowledge, sessions, tenantInvitations) route their item endpoint to
  `compositeItem` → semantic 400 PARAM_INVALID, never a random hang.
- **Per-view anchors** (S7 #1b): each list/item def pair and each OWrites carries
  `@knowledge <readModel-noteId>@<hash16>` — the note ids come from the canonical's
  `viewNoteIds` slot (the ①-layer metarch `readModel:<name>` face, first-wins in
  session→scope→note order = live's `noteIdOfKey` traversal). `PauseProjectDecisionView`
  has no metarch readModel note → anchor-bare, exactly matching live. The hash sidecar
  for the whole api face is the api-face `elementHashes.json` (the live hash resolver's
  source — the kn export's elementHashes, 3050 keys; the skeleton face's 108-key sidecar
  carries commands only, and readModel note hashes live only in the kn export).
- **Null-safe serialization** (`jsExprOf`, 空安全继承 060a217/60b796a): `Instant` →
  `jsInstant(d.x)` (the JsNull wall lives only in the helper, J-11), nullable uuid →
  `Json.toJson(Option(d.x).map(_.toString))`, `List[VO]` → `Json.toJson` (companion
  OFormat discovery), Scala keywords backtick-escaped (`d.\`type\``).
- **conf/routes**: the GET lines are computed (`routeLines`) but not emitted — same
  diff-apply deferral as the write side.
- **Ledger**: both entries are `kind: 'controller'`, `schemaCategory: 'projection'`,
  `families` = the gated views' `sourceAggregates` union sorted (multi-family honest
  attribution — vs the global support artifacts' `families: []`). Live's per-row
  `noteIds` field has no truthsrc ledger counterpart yet (deferred with conf/routes).

Byte identity: both files reproduce the live ingested-app output on the first render
(35453/38783 bytes); `buildViewModels` (already ported in inc12) plugs straight in with
the two new slots.

Still not ported from the api family: the establish-409 / Flow-delegate endpoint kinds
(templates are ported; they need Concept/User/DoR aggregates in a fixture), the
ServesUseCase anchor enforcement (story-face slot), the M3 vector-search controller
(`tpl_vector_search.mjs`), and the storage-infrastructure faces (repository specs /
projection DDL — `gen_repository_specs`/`gen_projection_ddl`, a different family).


### The full corpus, as landed (V4-5)

`golden/scala-cqrs-es-metarch/full-corpus.canonical.json` carries all 27 fieldTree aggregates
(built by `tools/build-full-corpus.mjs`: 27× extract → 27× rules-augment → merge → one api-augment;
self-check deep-equals the merged ModelCatalog fragment against the proven single-aggregate
golden, so a wrong input copy cannot pass). `tools/full-corpus-identity.mjs` runs the three
generators over it and diffs every emitted file byte-for-byte against the live tree
(backend-codegen `tools/kn_repo_freshness.mjs` gates that the committed tree IS the current
knowledge release), producing `full-corpus.identity.{json,md}`. Report (2026-10-15): 236
identical / 49 diff / 108 owned-by-other, zero reverse gaps, zero generator failures.

The live tree is a multi-pass pipeline — every path belongs to whichever generator wrote it
last, so the harness classifies each row by the live file's first-line stamp before comparing.
On today's tree rules_domain_gen owns the event-handlers (a lineage-driven rewrite pass
truthsrc does not port) and all Behaviors/CommandHelpers; gen_api_layer owns the controllers
plus 15 repositories (a minimal `entityRef`-only rewrite); 12 repositories are pre-migration
skeleton artifacts. Cross-owner rows are recorded, never diffed.

Mechanical semantics this batch pinned against live authorities (all gated by the existing
goldens, which exercise none of the new cases):

- **dataType → Scala** — full `DataTypeMapper.map` table (AssemblyEngine.scala:1035): int/integer
  → `Int`, string (enum)/(json)/json → `String`, decimal → `BigDecimal`, datetime → `Instant`,
  recursive `List[…]`, `array<string>` → `List[String]`, empty → `String`, unknown → verbatim
  (VO). The rules face carries the same table (`builders/datatype.mjs`) — live inherits its
  Params types from the on-disk skeleton protocol (two-pass pipeline); truthsrc re-derives the
  identical mapping statically.
- **Scala keyword identifiers** — `scalaIdentifier` (naming.mjs), verbatim
  NamingConventions.scala:135 vocabulary, backticked at the doc-row/param/state-field/
  payload/factory emission sites (`` `type` `` being the canon case).
- **Optionality** — ②-layer `optional: true` (extractor now carries it) → `Option[T]` with
  `= None` in the Protocol, `Option[T]` bare in the Factory, `Option[T] = None` in event
  payloads (the 2026-10-05 live batch's end-to-end option fidelity).
- **Optimistic-lock `version`** — numeric `version` state field initializes to 0 (not the
  neutral 1) so create-events emit (0,1) (EP_Catalog_Concept_Write_Model §3.5).
- **Import collapse** — the Protocol/Root faces dedupe same-fqn imports
  (`sortBy(_.fqn).map(_.fqn).distinct`); Entity/Factory/Repository keep the multiset.

The remaining 49 diffs are three families, none of them port defects: (a) the rules-face
supply loops the ModelCatalog golden never exercised — event-same-name payloads (2026-09-28),
lineage, CEM fallback, the idempotentOn guard, the spec-header aggregate anchor (~40 files);
(b) live assembly-generation skew — User/Concept entities and RoleCommandBinding
protocol/root were last generated by the pre-migration Scala assembly; today's fieldTree
(v9 and v55 alike) carries fields that tree lacks, so truthsrc (which renders the current
export) diverges — regeneration of the live skeleton face converges these; (c) the aggregate
root's port-aware `commandHandler` signature (adjudicator/fingerprint params — 2 aggregates).

### The rules-face supply-leg closure (V4-6)

Family (a) closed. `computeParamDefs` keeps loops 1+2+policy; the two whole-map passes now run
after it (`builders/rules.mjs`): `supplyEventSameName` (source 1116-1129 — a command parameter
sharing name AND type with a payload of an event the command produces joins the Params VO) and
`supplyLineage` (source 1131-1152 — `Cmd.field` hints pull non-identifier parameters in; query
fragments are silently dropped, the source's mutation-without-set semantics preserved verbatim).
The hints themselves are derived at augment time onto the canonical payloads
(`lineageHint` ← ④-layer emissions bindings, constant + emitWhen legs, first-wins — source
444-462), and `cmdEvents` is shared (`cmdEventsOf`) by the Rules face and the models faces.

The corpus also exposed two asymmetric registrations the single-aggregate golden could never
show, both now ported via one augment slot (`ruleAnchor: {cmd, evt, agg, ids}`, source lines
89-106): the RulesSpec header noteIds (`paramsNoteIds`) draw from the LIBRARY-wide
target-buckets, not the cases-attributed rules — CemEdge's two unrendered AGGREGATE_INVARIANT
rules still anchor its spec header — and the inline anchor map `ruleTargetId` is library-wide,
so a rule rendered through a ④-layer guard ref without cases (IR-USER-CMD-002) still anchors.
Two latent port bugs surfaced with real bytes: `idempotencyExprOf` called its bmDecision hook
with live's two-arg arity against the one-arg closure (silent null → the whole idempotent
branch missing from NoteRules), and the ported `eventArgs` dropped the `forEach` return
(DoRRules rendered `List(Ev(item…))` instead of `Nil ::: p.verdicts.map { … }`).

Report (2026-10-15): 277 identical / 8 diff / 108 owned-by-other — the rules face is 143/145
with only the two User files left, api 32/32, and the 8 residuals are all live-tree staleness,
mechanically evidenced: the 6 skeleton-face rows (family b above), plus UserRules — the library
refined `IR-USER-AGG-003` from `{"toRefine": true}` (untranslatable at live-generation time,
correctly skipped — proven against the library's git history) to the translatable `coexist`
form, and moved `IR-USER-EVT-004_userId` between library rows, reordering the event-
postcondition chain — and UserRulesSpec, the same state-face skew as UserEntity propagating
into the spec's UserState fixture args (9 fields vs the stale tree's 7). Regenerating the
live User face on the current chain converges all of them.
