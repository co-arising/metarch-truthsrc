---
name: coarising-distill
description: >-
  Distill an unstructured PRD, RFC, or requirements document into an orthogonal
  co-arising 2.0 truth source (structures/*.yaml + behaviors/{domain,application}/*.ears
  + bindings/*-effects.yaml), converging via Z3/SMT A/B Clarification Cards and
  projecting PM-readable Style E AC & Style B DMN decision tables.
---

# co-arising 2.0 Truth Distillation Skill (`PRD → Verified Truth Source`)

Use this skill whenever the user hands you a PRD, user story doc, meeting notes, or legacy specification and wants to convert it into a mathematically verified `co-arising 2.0` truth source.

## Hard Rules (Non-Negotiable)

1. **Orthogonal separation**: Static nouns (`exactTypes`, `valueObjects`, `aggregates`, `ports`, `readModels`, `stories`, `externContracts`) go ONLY in `structures/*.yaml`. NEVER put `@guard`, `guardExpr`, or behavioral rules in YAML.
2. **Closed vocabularies**: Every status string, currency/unit, and external predicate MUST be explicitly declared (`enum:`, `units:`, `externContracts:`) so the compiler's 4 strict domain-boundary gates can catch typos.
3. **Directory-to-Layer discipline**:
   - `behaviors/domain/*.ears` — `slice <Aggregate>.<Command>` (pure domain invariants, arithmetic, state transitions).
   - `behaviors/application/*.story.ears` — `story <Name> layer application` (inbound user stories: `pin`, `dispatch`, `respond`, `expose`).
   - `behaviors/application/*.integration.ears` — `story <Name> layer application` (external system integration policies & `WHEN event` choreography).
   - `bindings/*-effects.yaml` — solution-space S1 effect protocols (`three-phase-reconcile`, `transactional-outbox`, `saga-compensation`, `idempotent-consumer`) and `forbiddenImports`.
4. **Never guess away ambiguity**: Whenever `compile-v2` / `v2_compile` returns Z3 **A/B Clarification Cards** (`gap`, `conflict`, `invariant`, `dead-rule`), ALWAYS present the A/B options in plain business language to the user and wait for their adjudication before editing `.ears`.
5. **Positive-affirmative predicate naming**: In `where:`, name predicates positively (`validAmount`, `withinCap`) and negate at use sites (`not validAmount`).

## Procedure

### Phase 1 — Domain Noun Distillation (`structures/*.yaml`)
1. Read the requirements document completely. Identify:
   - Bounded Context name (`system`, `context`).
   - Exact numeric/money types (`exactTypes` with fixed `scale` and closed `units`).
   - Aggregates: state fields (with `enum:` for finite states), commands (typed parameters + `produces:`), events (typed fields), and `ruleRefs`.
   - Application layer: inbound `ports` + `operations`, `valueObjects` (responses), `readModels` (views), `stories` (`pins`, `responses`, `callerContract`), and `externContracts` (every host/auth/idempotency check with exact arity).
2. Write `truth/<context>/structures/<context>.yaml`.
3. Present a concise glossary table to the user and confirm domain terms before authoring behaviors (unless the user asked for a full first draft straight away).

### Phase 2 — Layered Behavior Authoring (`behaviors/{domain,application}/*.ears` & `bindings/`)
1. Extract pure domain rules (math, bounds, state machine, event folds `post:`) into `behaviors/domain/<agg>-<cmd>.ears`.
2. Extract user-facing workflows (auth, idempotency `pin`, command `dispatch`, response/view `respond`/`expose`, untrusted-input `ALWAYS ... SHALL NOT supply`) into `behaviors/application/<name>.story.ears`.
3. Extract external system settlement/callback/reconciliation policies into `behaviors/application/<name>.integration.ears` and declare the matching S1 effect protocol in `bindings/<context>-effects.yaml`.

### Phase 3 — SMT Hard-Gate Convergence Loop
1. Run `v2_compile` (via `truthsrc mcp`) or CLI:
   ```bash
   truthsrc compile-v2 \
     --structures truth/<context>/structures \
     --behaviors truth/<context>/behaviors \
     --out .truthsrc/canonical-v2.json \
     --db .truthsrc/knowledge.sqlite \
     --out-ac projections/ac \
     --out-tables projections/tables \
     --lang zh \
     --format human
   ```
2. Fix any deterministic syntax/binding/layer errors (`EARS_*`, `V2_PATH_LAYER_MISMATCH`, `V2_FIRST_HIT_SHADOWED_RULE`) directly using the reported `file:line:col` caret snippet.
3. For any **Z3 Clarification Card** (`V2_SMT_GATE_FAILED`):
   - Translate the Z3 counterexample and Option A / Option B into plain domain language.
   - Ask the user to pick Option A, Option B, or a custom business rule.
   - Apply their decision to `.ears` and re-run `compile-v2` until `[PASS]`.

### Phase 4 — Business Signoff & Handoff to Implementation
1. Present the generated read-only `projections/ac/*.md` (PM-friendly AC) and `projections/tables/*.md` (DMN decision tables) for business signoff.
2. Materialize scaffolds, locked BDD oracles, and the derived task queue:
   ```bash
   truthsrc generate-v2 --in .truthsrc/canonical-v2.json --out . --target typescript,scala --package <pkg>
   truthsrc emit-tests-v2 --in .truthsrc/canonical-v2.json --out . --target typescript,scala --package <pkg>
   truthsrc tasks-v2 --root . --format human
   ```
3. Hand off the derived Channel 4B `@cloze` slots to `coarising-cloze-worker` (or the AGY `coarising_cloze_pipeline.py` parallel workflow).
