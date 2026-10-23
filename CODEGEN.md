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
| **Output** | a file set written to a target directory + a derived `truthsrc.anchors/v1` index (`knowledgeKey → locations[]`, preserving locations from other generators) |
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

## Apply and anchor evidence (Saga S8, 2026-10-22)

`src/core/generate.mjs` remains the sole application write channel. Producers
return entries; `knowledgeId` and `noteIds[]` declare knowledge-to-file links.
Before creating or changing application files, core checks the complete plan,
prior ledger paths, current generator's prior anchor paths and both receipts:
relative paths, duplicate/case-fold aliases, symlink targets, hardlinked files,
file/directory collisions, MANUAL marker/anchor conflicts and concern scope
leaks. A later invalid entry refuses the whole plan before earlier entries write.
The caller must explicitly own the target directory; preflight does not acquire
an inter-process lock or establish ownership from a ledger alone.

Only after actual ADD/COVER/MERGE/KEEP/IDENTICAL policy outcomes does core hash
final source bytes and atomically replace the derived `anchors.json` index.
KEEP and MANUAL merges never use planned template bytes as evidence. The v1
index distinguishes `planned`, `source-verified`, `stale` and `unmapped`, and
preserves other generators' locations without recertifying them. Without a
source-language parser, core certifies **file bytes only**, not modules, symbols
or spans. Legacy single-value indexes migrate explicitly to unverified planned
locations; old verification claims are discarded. Query rechecks actual bytes;
missing or changed source is not a fresh anchor. Retired/renamed sources are not
automatically deleted.

Application files, ledger and index are **not a cross-file transaction**. A
write failure can leave partially applied source; it rejects the invocation and
returns no successful index receipt. Index replacement is atomic, but rollback,
cross-process exclusion and hostile concurrent directory replacement protection
are not provided. Keep the index outside the authoritative truth tree, and do
not interpret contract JSON artifacts as runnable Saga code.

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

### The diff-apply merge + routes territory (V4-7)

The apply-side write policies (`src/core/merge.mjs`, ported from the production patch pipeline)
and the conf/routes territory close the last deferred api-face piece.

**The MANUAL-block merge.** In-place regeneration no longer requires a `--concern` scope when the
only drift sits inside declared MANUAL territory: the generated content is the BASE and the
target's `// ==== BEGIN MANUAL ==== … // ==== END MANUAL ====` blocks are implanted back,
anchored by the nearest preceding `def name(` (same-name anchors consume their blocks in
appearance order — the CommandHelpers repeated-object case; anchor-less blocks pair by group
order). Orphan blocks (hand code in a method the generator no longer emits) and unpaired markers
REFUSE the merge — live's manifest_merge passes a marker-less target through wholesale, truthsrc
refuses, because silent hand-content drop is the exact failure class the machinery exists to
prevent. Merge runs SAME-FACE only: ownership is read from the PRIOR ledger row's kind (before
this run's upsert — the merged map cannot answer cross-face questions), so a skeleton-glue
re-apply over a rules-owned implementation is a refusal, not a merge; under a `--concern` scope
the in-scope COVER path still performs the documented transient glue clobber + replay.

**The conf/routes E301 territory.** The api generator emits the MARKER BLOCK entry
(`# >>> gen_api_layer (E301) >>>` … `# <<< gen_api_layer <<<`, verbatim live marker text; line
order = per-aggregate DSL lines then view lines, canonical aggregate order ≡ live's sorted
aggDirs). The apply swaps the target's marker region byte-preserving everything outside it
(apply_manifest MERGE_MARKERS discipline, including the CRLF-normalized zero-write and the
target-dominant line-ending alignment); a marker-less target gets the append path with the
fingerprint head prepended when absent; half-marker states fail fast (MarkerBlockWriter
H052/H053 — a silent append would double the start marker whose next swap swallows manual
territory). A target-less outDir gets NO routes file — the live `fs.existsSync` guard (the api
face never creates conf/routes; that first fill belongs to the skeleton's MarkerBlockWriter
new-file path, not ported). Deliberately NOT ported: `--allow-manual-orphan` (orphans refuse,
full stop) and `.gen-backup` copies (truthsrc is git-native; the VCS is the rollback). The block
carries NO ledger row (live C6 shared territory, scope-leak exempt). The vector-search and
aggregate-state lines of the live block belong to unported faces and are honestly absent.

**The ledger noteIds slot.** Ledger rows gain the knowledge identity of each file (live ledger
row parity, api face): per-aggregate controllers → the sorted command ids they serve (omitted
when empty); ViewApi/ViewWrites/ViewKeys → the gated views' ①-layer metarch readModel ids (33 on
the corpus — PauseProjectDecisionView has none); CommandRoleMap → the ids of the commands it
declares roles for (130 corpus-wide); CommandDsl → none (a pure envelope carries no knowledge
payload).

Report (2026-10-15): 394 rows = 277 identical / 9 diff / 108 owned-by-other — the ninth diff is
the routes block row, whose 28 live-only lines are EXACTLY the unported faces' output (27
aggregate-state + 1 vector-search; `liveOnlyOutsideUnportedFaces: 0`), and the other eight are
the V4-5/V4-6 live-tree staleness residuals, unchanged.

### The regeneration-baseline increment (V4-8)

The queued "regenerate the live tree on the current chain" increment turned out to be a **no-op
that falsified its own premise**: the increment gate (inputs unchanged since the 2026-10-11 21:08
run) plus a forced rerun (718 files, all stamp-line-only: `CodegenMain:a0fca3da` → the driver
repo's current git hash) proved the live tree ALREADY IS the current chain's output. The eight
"live-tree staleness" residuals from V4-5/V4-6 were misattributed — every one was a truthsrc
fidelity gap, and each fell to a mechanical authority:

- **Nature exclusion** (UserEntity + UserRulesSpec + UserRules): `GeneratorContext.isStateFieldExcluded`
  drops state fields whose `nature` is in the concern-anchored exclusion set (concerns.json
  `credential-store`: StateField/credential/`aggregateColumn` → `excludedStateFieldNatures`).
  Ported as a canonical top-level slot (build-full-corpus `--concerns`, ConcernScope's predicate
  verbatim) consumed by `entityModel`'s `emittedStateFieldsOf` filter. Cross-face coupling
  restored: rules_domain_gen reads its stateFields set from the skeleton's generated Entity
  signature (lines 974-992), so a credential field is unresolved for rule translation and the
  coexist rule on it drops as untranslatable — truthsrc's rules face applies the same exclusion
  to its state authority instead of reading the raw canonical.
- **Scala replace semantics** (RoleCommandBinding protocol+root): the handler-family alias is
  `commandFamily.name.replace("Command", "CommandHandler")` — Scala replaces ALL occurrences;
  JS `.replace` only the first. `RoleCommandBindingCommandFamily` carries two "Command"s.
  Fixed with `replaceAll`.
- **Code-unit ordering** (Concept/KnowledgePatch entities): the chain sorts events with Scala
  `sorted` (UTF-16 code units); the extractor used `localeCompare`, which places
  `ConceptsMerged`/`KnowledgePatchMerged` (lowercase decision point) differently. Extractor
  sorts switched to code-unit comparators.
- **collectVarRefs fidelity** (UserRules dispatch order): the event-postcondition dispatch
  iterates the fill order of evtByEvent — library order gated on successful translation — and
  patch_core's `collectVarRefs` reads `var` singular, `vars` array AND `target` dotted. Both
  the augment's attribution walk and the rules face's own `collectRefsOf2` were lossy (`var`
  only), missing `IR-USER-EVT-003` (`anyNotNull.vars`) — its UserProfileUpdated key inserted
  late and the dispatch diverged. Both walks now mirror the source's three-key semantics.
- **Harness stamp discipline**: the `// @generated by` line is a generation-run fact (inc3
  principle) and never participates in byte comparison; face ownership is by generator NAME
  (the version suffix is the driver hash, refreshed every run). The repository directory is
  R6-Ⅰ-frozen in the live pipeline (WriteTerritory.FrozenTerritories) — its CodegenMain-stamped
  files are pre-migration relics, classified owned-by-other with the stamp recorded.

Report (2026-10-15, post-increment): 394 rows = **284 identical / 2 diff / 108 owned-by-other**
(107 identical rows modulo the stamp line, disclosed per row). The two remaining diffs are the
documented steady state: ModelCatalogAggregate root `commandHandler(adjudicator, fingerprint)`
port injection (the queued port-face increment) and the conf/routes block's unported-face lines.

### The aggregate-root port-injection increment (V4-9)

Candidate ① from V4-8: the last code diff — `ModelCatalogAggregate.commandHandler` carries
`(adjudicator: ConceptDeltaAdjudicator, fingerprint: ContentFingerprintPort)` and forwards only
`adjudicator` to `ModelCatalogBehaviors.apply`. Mechanism (rules_domain_gen 债④批尾, lines
3365-3457): functions.yaml `callExpr`s in the Access-gate form (`PKG.XxxAccess.<member>.<method>({args})`,
PORT_RX) register ports per member/trait/fqPkg; the per-aggregate registry splits two faces —
`all` = rules-expr refs ∪ fold `fn:` refs (the signature face), `cmd` = rules-expr refs only
(the Behaviors.apply argument face) — and the batch rewrites the zero-arg skeleton line to the
parametric closure form with fully-qualified parameter types (the line is the only change; zero
import intrusion). The other 26 roots keep the zero-arg form.

truthsrc already carried both raw faces in the canonical (`ports` = cmd face with members,
`foldPorts` = fold-face traits, member `null` because its only consumer read the import face).
Three surgical moves:

- `augment-rules-canonical.mjs` recovers the fold-port member from the Access-gate registry
  (`fingerprint` for ContentFingerprintPort) — rules_domain_gen's portByTraitFq entries always
  carry it.
- `rootModel` builds the union (foldPorts ∪ ports, deduped by trait FQ, code-unit sorted — the
  source sorts the trait-FQ set) for the signature and re-sorts the cmd face the same way for
  the apply arguments.
- `renderRoot` emits the parametric line when ports exist, the zero-arg line otherwise.

Regeneration note: the corpus inputs pin **kn-system-metadata-v55** (27 fieldTree aggregates —
alphabetically "latest" is v9 with 26, a trap; the pinned version is asserted by the
build-full-corpus self-check deep-equality against `model-catalog.canonical.json`).

Report (2026-10-15, post-increment): 394 rows = **285 identical / 1 diff / 108 owned-by-other**
(108 rows modulo the stamp line). The one remaining diff is the documented steady state: the
conf/routes block's 28 live-only lines are exactly the unported faces' output (aggregate-state
×27 + vector ×1). Code diffs: zero.

### The event-handler state-projection rewrite (V4-10)

Candidate ① from V4-9: the largest unported piece — rules_domain_gen's per-aggregate
EventHandler REWRITE pass (lines 2031-2665). Where the skeleton emits an identity EventHandler,
rules_domain_gen overwrites the file with lineage-driven state projections: the ④-layer fold
vocabulary (fn:/keep:/patch:/append:/concat:/remove:/upsert:/memberPatch:/memberRemove:/
memberUpsert:/memberAppend:/memberReplace:/memberCut: — every family exercised by the corpus)
is declaration-authoritative, then writtenBy lineage (type-compat mapping: same-type direct,
String←Id `.toString`, List[X]←X wrapped), then status transitions, then audit-field stems,
then same-name payload fallback, then the version leg; anything unmapped degrades to a
`// 待审:` review line per case — never silently dropped. Per-case `@knowledge` anchors (event
noteIds), the event→event causal comment (S7 #3, stage-02 payload), and the port-face apply
overload (the FULL port union, bare-trait typed — same union as the root face, unlike
Behaviors.apply's cmd-only face).

The decisive discovery: the live chain runs in **kn-export mode** (`[kn-export]` log line,
rules_domain_gen 425-475) — `metaJson.aggregates` is wholly REPLACED by fieldTree-derived rows.
Three consequences the fixtures must mirror:

- `stateFields` come from the EXPORT's fieldTree (the Entity-emitted set — VO-flattened members
  and their list-member writtenBy forms never enter; that's why live emits no `conflictId`
  待审 despite the ①-layer template carrying them).
- `statusTransitions` is NOT the ①-layer table — it is DERIVED from the ④层 folds'
  `literal:<X>` status assignments; events without one (KnowledgePatched/MetadataAssembled/
  MetadataExported) fall through to `枚举值无法判定` 待审 lines. `terminalStates` rides along
  from the export aggregate (CemEdge is the corpus carrier — the status one-way defense wrap).
- `ehIdField` is the fieldTree identifier OBJECT, not the name: the `fname === ehIdField`
  guards never fire, and the leg-6 ehSysFields exemption therefore does NOT cover the aggregate
  id — `payload 未映射: catalogId` stays in the review line. A string there silently drops it.

Moves: `augment-rules-canonical.mjs` gains `--export` (fieldMeta + fnSpecs slices + voCatalog +
terminalStates + eventCauses via `--stage02`) and `accessObj` on the port rows; the generator
gains `builders/writtenby.mjs` (the writtenBy grammar parser, verbatim from the source's
single-grammar lib) and `builders/eventhandler_face.mjs` (legs 0-6 + case assembly, byte-exact
message strings), a `renderEventHandlerRules` two-form renderer (parametric closure vs zero-arg;
`case _` at closure depth 6 vs match depth 4), and the `event-handlers` face registration;
`rowOf` carries `causedBy` (ledger parity with the live event-handlers rows). NOT ported
(unexercised, mechanically verified): the on-disk [SURGERY-KEEP] case-block probe (grep over
live behaviors/ = 0 hits — a target-tree read at generation time, meaningless in plan()'s
target-free contract until a corpus case exists) and the story/eventhandler_review.md audit
side-artifact.

Report (2026-10-15, post-increment): 421 rows = **312 identical / 1 diff / 108 owned-by-other**
(rules 172 · skeleton 108 · api 32; the skeleton's 27 event-handler rows remain as
owned-by-other records — the pipeline-order supersession the live ledger's final-writer-wins
also encodes). All 27 rewritten EventHandlers byte-identical, including the CemEdge
terminal-state wrap. npm test 22/22 (rules gate now 8 entries; concerns e2e replay re-asserts
three shared glue paths). Code diffs: zero.

### The M3 vector face (V4-13)

Candidate ① from the V4-12 projection/storage census: the smallest identity loop —
VectorSearchApiController.scala (71 lines live) + its E301 route line. The live emitter is
`gen_api_controllers/tpl_vector_search.mjs` (still an ACTIVE template, unlike the retired
repository emission), fed by `vector_truth_source.mjs`'s `collectVectorViews`: readModel notes
declaring `info.storage.kind === 'vector'`, scanned DIRECTLY from the ①-layer notes (not
through the readmodels ③-layer gate — the 27-decision-view face and the vector corpus stay
unmixed). One view today: KnowledgeSemanticView (bge-m3 · 1024d · hnsw cosine).

truthsrc mirrors the same split: `augment-api-canonical` gains the `vectorViews` slot (the
collectVectorViews port over the file-shaped Object.values traversal — name/noteId/storage/
refCodes/fields/sourceTypes, sourceTypes mechanically extracted from the refCodes
`sourceType = "X"` literals), and the generator gains `templates/vector_search.mjs` — the
template ported VERBATIM (query chain `OllamaEmbeddingClient.embed → Repository.search`,
k clamp 1..50 default 8, sourceType whitelist note|concept, 503 EMBEDDING_UNAVAILABLE degraded
semantics, per-view `@knowledge` anchor with hash16 through the api-face sidecar). The route
line lands AFTER the view lines (live E301 block order: DSL → views → vector; the state lines
remain the only absent face). Global artifact: families=[], ledger noteIds = the view note id
(4cfd5d46… → 39318a67908589c3, byte-identical anchor on the first pass).

Report (2026-10-15, post-increment): 422 rows = **313 identical / 1 diff / 108 owned-by-other**
(rules 172 · skeleton 108 · api 33 — the new row identical on first generation). The routes
block's live-only remainder drops 28 → 27: everything left is the unported aggregate-state face
(S1 拍板面·candidate ③). npm test 22/22 (api gate 8 entries; concerns e2e api runs 6→7;
diff-apply counts +1 across the board).

### The projection/storage sweep: DDL, state API, and the engine's biggest face (V4-14)

One batch closed every remaining candidate: ② the dual-dialect DDL, ③ the S1 aggregate-state
controller, ④ the view/repo/impl storage face, ⑤ the projection handlers.

**② DDL (`scala-cqrs-es-ddl`)** — the `gen_projection_ddl.mjs` port. `conf/sql/2.sql` = the
③-layer GATED DecisionViews minus graph cards (no SQL dialect) minus mongo document views (old
tables not dropped = rollback-safe), the deterministic type map (description/content/info→TEXT
and payloadJson→MEDIUMTEXT are 毒丸判例 tombstones — MysqlDataTruncation halted projections),
faithful sorted keys as PRIMARY KEY. `conf/sql/5-pgvector.sql` = the M3 vector dialect over the
①-layer `vectorViews` slot (camel→snake, declaration-order composite PK, HNSW via
distance→ops). Byte-identical on the first pass.

**③ StateApi (`scala-cqrs-es-api` grows `templates/state_api.mjs`)** — the engine trio port
(AggregateStateControllerBuilder/Model/Template): one controller, one method per aggregate,
`api.global.read()` → IdGuard → `repository.entityRef(id).ask(Get<X>State)`; serialization is
controller-owned (per-aggregate hand-written OWrites — no macros), credential-nature fields
excluded, keyword fields backtick-escaped at access sites (`st.\`type\``). The 27 route lines
close the E301 block's last live-only region: **routes 229 = 229, liveOnly 0**. Fixture
canonicals ride the corpus `stateRoster` sidecar (the face is global; their own roster is
1 aggregate). The live file ends WITHOUT a trailing newline — kept.

**④⑤ Projection (`scala-cqrs-es-projection`, new)** — 369 outputs: defs ×43 (composite /
single-handler / multi-aggregate shapes; **dispatcher wiring order = the readModel note's
`event:` LINK order** — not the refCodes key order: CollisionResolved rides the links without a
refCode; duplicate links dedupe first-wins — ParkConcept carries ConceptEstablished twice;
zero-handler groups emit nothing — OpenSession's Stage), handlers ×240 (engine skeleton + the
`gen_projection_handlers` MANUAL port: table/vector/graph channels derive the mechanical form
from the referenceCodes — 28 corpus blocks derive byte-equal, the port's proof; every
divergence — handwritten MERGE-preserved content, post-fill refCode drift like the strOr()
removal — rides the manual-blocks sidecar), repos ×43 (Table companion with sorted DTO fields
and Instant→Option[Instant], field anchors via elementHashes, the AssemblyEngine method set:
sorted keys → findByIdentity, non-key `*Id` + composite-key members → findBy*), impls ×43
(table scalikejdbc / MongoViewStore / GraphMutationExecutor / PgVectorStore+OllamaEmbeddingClient).

Three sidecars under `golden/scala-cqrs-es-projection-metarch/` carry the non-derivable inputs,
each with a one-off distiller: `manual-blocks.json` (247 live MANUAL blocks — 53 handwritten),
`proto-fields.json` (the PO whitelist/types), `stale-generations.json` (26 impls whose BODIES
predate the current builder — the 2026-10-15 stamp refresh renewed stamps across 718 files
without rewriting bytes, so live carries mixed generations behind fresh stamps; those files ride
verbatim, documented as relics). Handwritten-forever (absent): KnInstanceProjection + handler +
store, ParkConceptDecisionViewCompositeHandler. PauseProject ×10 are live relics (the ①-layer
note is gone; the incremental gate never rewrites them).

Report (2026-10-16, post-increment): **794 rows = 686 identical / 0 diff / 108 owned-by-other**
(skeleton 108 · rules 172 · api 35 · projection 369 · ddl 2; routes liveOnly 0; reverse
coverage = the 14 disclosed handwritten/relic files). npm test 24/24 (new ddl + projection
gates; api gate 9 entries; concerns/diff-apply counts +1 across the board).
