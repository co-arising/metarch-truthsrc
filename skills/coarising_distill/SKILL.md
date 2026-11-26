---
name: coarising-distill
description: >-
  Distill an unstructured PRD, RFC, or requirements document into an orthogonal
  co-arising 2.0 truth source (structures/*.yaml + behaviors/{domain,application}/*.ears
  + bindings/*-{effects,readside}.yaml), preserving user stories, use cases, journeys,
  read-model provenance, and authz PEP contracts, converging via Z3/SMT and emitting
  read-only signoff docs (signoff/{use-cases,lineage,ac,tables}).
---

# co-arising 2.0 Truth Distillation Skill (`PRD → Verified Truth Source`)

Use this skill whenever the user hands you a PRD, user story doc, meeting notes, or legacy specification and wants to convert it into a mathematically verified `co-arising 2.0` truth source.

## Mandatory Pre-Read (Do This BEFORE Writing Any YAML or `.ears`)

Before authoring a single line of YAML or EARS, **MUST read both bundled reference specs** inside this skill folder:

1. **`references/structures_and_bindings_schema.md`** — exact valid YAML schema for `structures/*.yaml` (`roles`, `nominalTypes`, `exactTypes`, `valueObjects`, `aggregates`, `readModels` with mandatory `source:`, `ports` with `callerKind`/`authz`, `stories`, `useCases`, `pipelines`, `journeys`, `sagas`, `externContracts`, `waiveLineage`) and `bindings/*-{effects,readside}.yaml`.
2. **`references/ears_v2_grammar.md`** — exact EARS v2 grammar for `behaviors/domain/*.ears` (`slice`), `behaviors/application/*.{story,integration}.ears` (`story ... layer application`), `WHEN event`, `post:` folds, expressions, and diagnostic error codes.
3. Also inspect any existing starter files already in the workspace under `truth/<context>/` (created by `truthsrc init-v2`) to align naming and paths.

> Do NOT guess YAML keys or invent EARS syntax from memory. Everything accepted by the compiler is documented in `references/structures_and_bindings_schema.md` and `references/ears_v2_grammar.md`.

## Hard Rules (Non-Negotiable)

1. **Orthogonal separation**: Static nouns, narrative topology (`journeys`, `useCases`, `stories`), logical read models, and authz PEP contracts go ONLY in `structures/*.yaml`. NEVER put `@guard`, `guardExpr`, or behavioral rules in YAML. Physical storage/materialization choices (`shared-materialized-view`, `dedicated-table`) and side-effect protocols go ONLY in `bindings/*.yaml`.
2. **Closed vocabularies**: Every status string, currency/unit, role, and external predicate MUST be explicitly declared (`enum:`, `units:`, `roles:`, `externContracts:`) so compiler boundary gates catch typos.
3. **Write Model vs. Read Model discipline**:
   - **Write Model (`aggregates`)**: every numeric/exact event field MUST be consumed by a `post:` fold, an event-triggered story, or a readModel `eventField:` — OR explicitly waived with a typed `waiveLineage` (`routing-id`, `redundant-param:<p>`, `saga-trigger`, `audit-only`). Unwaived unconsumed numeric fields fail compilation (`V2_LINEAGE_UNCONSUMED_NUMERIC_FIELD`).
   - **Read Model (`readModels`)**: logical query views in Problem Space. Every field MUST declare a machine-checkable `source:` (`stateField:<Agg>.<f>`, `eventField:<Ev>.<f>`, `aggregateIdentity`, or `derived:<reason>`) — NEVER free-form prose!
   - **Naming Disambiguation**: CQRS event projections are called **`readModels`** (logical) and **`materializedViews`** (physical, in `bindings/*-readside.yaml`). Human-readable PM signoff documents go under **`signoff/`** (`--out-signoff signoff`), NEVER conflated with CQRS read projections.
4. **Authz PEP boundary (Problem Space) vs. PDP engine (Solution Space)**:
   - Every inbound `Port.operation` MUST declare its `callerKind` (`human | system | scheduler | webhook | anonymous`) and `authz` PEP contract (`mode: auth-core | static-roles | external-pdp | public | internal-only`).
   - Do NOT hardcode dynamic org-tree/Workday multi-rule policies in YAML; use `mode: external-pdp` with `policyRef` and typed `contextParams` so the compiler verifies all required attributes reach the external `AuthorizationPort`.
   - Internal/scheduler/event-driven surfaces (`callerKind: system | scheduler` or `mode: internal-only`) are never exposed as public HTTP routes.
5. **Directory-to-Layer discipline**:
   - `behaviors/domain/*.ears` — `slice <Aggregate>.<Command>` (pure domain invariants, arithmetic, state transitions, `post:` folds).
   - `behaviors/application/*.story.ears` — `story <Name> layer application` (inbound workflows: `pin`, `dispatch`, `respond`, `expose`).
   - `behaviors/application/*.integration.ears` — `story <Name> layer application` (external integration policies & `WHEN event` choreography).
   - `bindings/*-effects.yaml` — solution-space S1 effect protocols & `forbiddenImports`.
   - `bindings/*-readside.yaml` — solution-space physical materialized view bindings (supports N logical `readModels` sharing 1 physical materialized view).
6. **Never guess away ambiguity**: Whenever `compile-v2` / `v2_compile` returns Z3 **A/B Clarification Cards** (`gap`, `conflict`, `invariant`, `dead-rule`), ALWAYS present the A/B options in plain business language to the user and wait for their adjudication before editing `.ears`.
7. **Positive-affirmative predicate naming**: In `where:`, name predicates positively (`validAmount`, `withinCap`) and negate at use sites (`not validAmount`).

## Procedure (5-Phase Event-Modeling Distillation Funnel)

### Phase 0 — PRD Decomposition: Actors, Journeys, User Stories & Use Cases
1. Read the requirements document completely. Extract:
   - **Actors / Callers (`roles:`)**: both human roles (`kind: human`) and non-human callers (`kind: system | scheduler | webhook | ai-agent`).
   - **User Stories (`stories:`)**: `role`, `goal`, `soThat`, `release`, `coversUseCases`.
   - **End-to-End Use Cases (`useCases:`)**: ordered causal steps (`actor → port → command → emissions → readsView / updatesViews → pipeline / saga`) + `prdRefs` + `extensions` (failure/timeout/compensation branches).
   - **Story-Mapping Journeys (`journeys:`)**: group stages, stories, useCases, and screens into user journeys when multiple workflows form a release.
2. Confirm the Actor + Use Case map with the user (or proceed if they asked for a full first draft straight away).

### Phase 1 — Orthogonal Write Model, Read Model & Authz PEP Contracts (`structures/*.yaml`)
1. **Write Model (`exactTypes`, `nominalTypes`, `aggregates`, `sagas`, `pipelines`)**:
   - Declare fixed-point `exactTypes` (never float), aggregates with `stateFields` (using `waiveLineage: immutable-config` for seed-only config fields like `singleCap`), `commands` (`parameters`, `produces`), `events` (explicit `fields`, optional `source: cmd.<p> | state.<s> | const:<v>`, and explicit `waiveLineage` for intentional routing/audit/saga-trigger fields), and `ruleRefs`.
2. **Read Model (`readModels` — Logical Problem Space)**:
   - For every view referenced in `useCases.readEvidence`, `steps.readsView`, `steps.updatesViews`, or `expose`: declare `sourceAggregate`, `sourceEvents`, and per-field machine-checkable `source:` (`stateField:`, `eventField:`, `aggregateIdentity`, or `derived:<reason>`).
   - Prefer `stateField:` when the aggregate already folds that field into state (avoid write-only dead state fields!).
3. **Inbound Surfaces & Authz PEP (`ports`, `valueObjects`, `externContracts`)**:
   - Declare every inbound `Port.operation` with `callerKind` and `authz` (`auth-core` / `static-roles` / `external-pdp` / `public` / `internal-only`).
   - Declare every external predicate in `externContracts` with exact `params` and `ownerPort`.
4. Write `truth/<context>/structures/<context>.yaml` (or split into `structures/*.yaml` + `structures/use-cases.yaml`).

### Phase 2 — Layered Behavior Authoring & Solution-Space Bindings
1. For each domain command in `useCases`, author `behaviors/domain/<agg>-<cmd>.ears` (invariants, DMN First-Hit rules, `SHALL emit`, and `post:` event folds covering all state mutations).
2. For each inbound user workflow, author `behaviors/application/<name>.story.ears` (`auth`, idempotency `pin`, `dispatch`, `respond`/`expose`, `ALWAYS ... SHALL NOT supply`).
3. For external callbacks/settlement/async choreography, author `behaviors/application/<name>.integration.ears` and declare S1 effect protocols in `bindings/<context>-effects.yaml`.
4. If multiple logical `readModels` share a physical materialized view or require specific SQL indexes/storage, declare `bindings/<context>-readside.yaml` (`co-arising.readside-binding/v2`).

### Phase 3 — Full-Chain Compiler & Z3 Hard-Gate Convergence Loop
1. Run `v2_compile` (via `truthsrc mcp`) or CLI with `--strict-lineage` and `--out-signoff`:
   ```bash
   truthsrc compile-v2 \
     --structures truth/<context>/structures \
     --behaviors truth/<context>/behaviors \
     --bindings truth/<context>/bindings \
     --out .truthsrc/canonical-v2.json \
     --db .truthsrc/knowledge.sqlite \
     --out-signoff signoff \
     --strict-lineage \
     --lang zh \
     --format human
   ```
2. Fix deterministic syntax/binding/lineage/authz/readside errors (`EARS_*`, `V2_*`) directly using the reported `file:line:col` caret snippet.
3. For any **Z3 Clarification Card** (`V2_SMT_GATE_FAILED`):
   - Translate the Z3 counterexample and Option A / Option B into plain domain language.
   - Ask the user to pick Option A, Option B, or a custom business rule.
   - Apply their decision to `.ears` and re-run `compile-v2` until `[PASS]`.

### Phase 4 — Business Signoff & Handoff to Implementation
1. Present the generated read-only signoff pack for PM/business approval:
   - `signoff/use-cases.md` (User Stories, Journeys, Use Case Mermaid sequence diagrams, PRD traceability)
   - `signoff/lineage.md` (Field Lineage Ledger, Explicit Waivers, Authz PEP Matrix, ReadSide Physical Materialization Map)
   - `signoff/ac/*.md` (PM-friendly Style E AC) & `signoff/tables/*.md` (DMN decision tables)
2. Emit Onion 5-layer code (`domain / application / interfaces / infrastructure / modules`) + `@cloze` skeletons, locked BDD/HTTP oracles, and the derived task queue:
   ```bash
   truthsrc generate-v2 --in .truthsrc/canonical-v2.json --out . --target typescript,scala --package <pkg> --with-scaffold
   truthsrc emit-tests-v2 --in .truthsrc/canonical-v2.json --out . --target typescript,scala --package <pkg>
   truthsrc tasks-v2 --root . --format human
   ```
3. Hand off derived Channel 4B `@cloze` slots to `coarising-cloze-worker` (or `workflows/coarising_cloze_pipeline.py`).
4. Once verified, export the offline visual workbench:
   ```bash
   truthsrc view-v2 --root . --out workshop.html
   ```
