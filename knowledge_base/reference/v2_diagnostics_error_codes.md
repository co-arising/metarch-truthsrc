# co-arising 2.0 Diagnostics & Error Code Manual

> Complete reference for every `EARS_*` and `V2_*` diagnostic emitted by `metarch-truthsrc`. Every parse, bind, and compiler diagnostic includes `file:line:col` (`location`) and a source caret excerpt (`snippet`).

---

## 1. EARS Syntax, Normalization & Domain-Boundary Codes (`EARS_*`)

| Code | Severity | Meaning | Remediation |
| --- | --- | --- | --- |
| `EARS_SYNTAX` | error | Lexer or parser syntax error in `.ears` source. | Fix the token/grammar mismatch at the reported `file:line:col`. |
| `EARS_PRED_CYCLE` | error | Circular reference between predicates in `where:`. | Break the cycle so predicates form a DAG. |
| `EARS_DUP_PRED` | error | Duplicate predicate name in `where:`. | Rename or merge the duplicate predicate definition. |
| `EARS_DUP_EXTERN` | error | Duplicate `extern` declaration in the same spec. | Keep a single `extern` declaration per predicate name. |
| `EARS_DUP_RULE_ID` | error | Duplicate `[RULE_ID]` inside the same spec. | Assign unique rule IDs across the spec. |
| `EARS_NEG_PRED_NAME` | error | Predicate/extern starts with a negative prefix (`not*`, `invalid*`, `un*`, `未*`, `不*`, etc.). | Name predicates positively (e.g., `validAmount`) and negate at use sites (`not validAmount`). |
| `EARS_UNKNOWN_AGGREGATE` | error | `slice <Agg>...` references an aggregate not declared in `structures/`. | Declare the aggregate in `structures/*.yaml` or fix the typo. |
| `EARS_UNKNOWN_STORY` | error/warn | `story <Name>` is not declared in `structures.stories`. | Add the story entry under `stories:` in `structures/*.yaml`. |
| `EARS_UNKNOWN_COMMAND` | error | `WHEN <Cmd>` references a command not declared on the aggregate. | Declare the command in `aggregates[*].commands`. |
| `EARS_UNKNOWN_EVENT` | error | `SHALL emit <Event>` references an undeclared event on the aggregate. | Declare the event in `aggregates[*].events`. |
| `EARS_UNKNOWN_TRIGGER_EVENT` | error | `WHEN event <Agg>.<Event>` references an undeclared aggregate event. | Declare `<Event>` on `<Agg>` in `structures/*.yaml`. |
| `EARS_UNKNOWN_PORT_OP` | error | `WHEN <Port>.<Op>` in an application story is not declared in `structures.ports`. | Declare the port and operation under `ports:` in `structures/*.yaml`. |
| `EARS_UNKNOWN_DISPATCH_TARGET` | error | `SHALL dispatch <Agg>.<Cmd>` targets an undeclared aggregate command. | Declare `<Cmd>` on `<Agg>` in `structures/*.yaml`. |
| `EARS_UNKNOWN_PIN_ARTIFACT` | error | `SHALL pin <Artifact>` is not listed in `story.pins`. | Register `<Artifact>` in the story's `pins:` list. |
| `EARS_UNKNOWN_RESPONSE` | error | `SHALL respond <Type>` is not listed in `story.responses`. | Register `<Type>` in `story.responses` and `valueObjects:`. |
| `EARS_UNKNOWN_RESPONSE_FIELD` | error | Constraint on `respond` references an undeclared value-object field. | Check field names in `structures.valueObjects`. |
| `EARS_UNKNOWN_READ_MODEL` | error | `SHALL expose <View>` targets an undeclared read model. | Declare `<View>` in `structures.readModels`. |
| `EARS_UNKNOWN_VIEW_FIELD` | error | Constraint on `expose` references an undeclared read-model field. | Check field names in `structures.readModels[*].fields`. |
| `EARS_UNKNOWN_SYMBOL` | error | Identifier/path in guard or `post:` is not a declared state field, parameter, event field, or bound quantifier variable. | Declare the field in `structures/*.yaml` or fix the identifier spelling. |
| `EARS_UNDECLARED_EXTERN` | error | `extern <name>` is missing from `structures.externContracts` (anti-escape gate). | Register `<name>` with typed `params:` in `structures.externContracts`. |
| `EARS_EXTERN_ARITY_MISMATCH` | error | `extern` parameter count differs from `structures.externContracts`. | Align parameter list with the structure contract. |
| `EARS_UNKNOWN_ENUM_LITERAL` | error | String literal compared against a field with closed `enum:` or `units:` is outside the allowed vocabulary. | Use a declared enum/unit value or extend the closed vocabulary in `structures/*.yaml`. |
| `EARS_TYPE_MISMATCH` | error | Incompatible types in comparison or arithmetic (e.g., string compared with `<`). | Align operand types or fix the field type in `structures/*.yaml`. |
| `EARS_UNANCHORED_RULE_ID` | warn/error | Rejection code is not listed in `aggregate.ruleRefs`. | Register the error code in `ruleRefs:` for documentation/audit anchoring. |

---

## 2. Compiler, YAML, Verification & Governance Codes (`V2_*`)

| Code | Severity | Meaning | Remediation |
| --- | --- | --- | --- |
| `V2_YAML_PARSE` | error | Syntax error, tab indentation, duplicate key, or unbalanced flow brackets in YAML structure/binding file. | Fix the YAML error at the reported `file:line:col` caret snippet. |
| `V2_LEGACY_GUARD_FORBIDDEN` | error | Legacy `@guard`, `guardExpr`, or `domain-decision@4` detected in v2 `structures/`. | Remove behavioral expressions from YAML and express them in `.ears`. |
| `V2_NO_SPECS` | error | No `.ears` files found at `--behaviors`. | Check the `--behaviors` path and ensure `.ears` files exist. |
| `V2_SOLVER_MISSING` | error | Configured SMT solver (`z3` or `cvc5`) is not available on `PATH`. | Follow the printed OS-specific install command (`brew install z3`, `apt-get install -y z3`, etc.). |
| `V2_PATH_LAYER_MISMATCH` | error | `story` placed under `domain/` or `slice` placed under `application/`. | Move the file to `behaviors/domain/` or `behaviors/application/` to match its header. |
| `V2_LAYER_ACTION_VIOLATION` | error | Domain rule uses application action (`pin`/`dispatch`/`respond`/`expose`) or application rule mutates aggregate directly (`emit`/`transition`). | Keep domain actions in `behaviors/domain/` and orchestration actions in `behaviors/application/`. |
| `V2_BILINGUAL_DRIFT` | error | `<stem>.zh.ears` sibling does not normalize to the same `canonicalSha256` as `<stem>.ears`. | Reconcile EN and CN specs until both express identical formal logic. |
| `V2_SMT_GATE_FAILED` | error | Z3 found a logic gap, rule conflict, invariant violation, dead rule, or BMC counterexample. | Resolve the printed A/B Clarification Card in the `.ears` spec. |
| `V2_FIRST_HIT_SHADOWED_RULE` | error | A rule is unreachable because earlier rules under DMN First-Hit order completely subsume its guard. | Reorder rules (most specific first) or tighten earlier guards. |
| `V2_INCONSISTENT_EVENT_FOLD` | error | Two rules emitting the same domain event define conflicting `post:` state transitions. | Make `post:` folds identical for every rule emitting the same event. |
| `V2_UNCOVERED_FILE` | error | File under `governedRoots` is missing from `coverage-manifest.json` (zero gray-zone invariant). | Classify the file (`D1`/`D2`/`S1`/`S2`/`S3`) in `coverage-manifest.json`. |
| `V2_STALE_MANIFEST_ENTRY` | error | Manifest entry points to a deleted or out-of-scope file. | Remove or update the stale path in `coverage-manifest.json`. |
| `V2_INVALID_TIER_EVIDENCE` | error | Tier/branch/evidenceTier tuple violates `D1/D2→E1`, `S1→E2`, `S2→E3`, `S3→E4`. | Align `branch` and `evidenceTier` with the file's `tier`. |
| `V2_MISSING_INLINE_MARKER` | error | File declaring `shadowMode: "inline-marker"` lacks `// @coarising:contract(...)`. | Add the inline contract marker or switch `shadowMode`. |
| `V2_MISSING_HUMAN_SIGNOFF` / `V2_STALE_HUMAN_SIGNOFF` | error | E4 file lacks `humanSignoff` or its SHA-256 changed since last signoff. | Re-review the file and update `humanSignoff.fileSha256` + `signedAt`. |
| `V2_ARCH_FORBIDDEN_IMPORT` | error | Governed file matches a `forbiddenImports` regex from `bindings/*-effects.yaml`. | Remove the forbidden cross-layer dependency. |
| `TERRITORY_LOCKED` | error | `truthsrc guard-write` blocked an edit inside `generated-tests/`, `generated-scaffold/`, or `projections/`. | Edit the `.ears` truth source instead and re-run `check-v2 --sync`. |
| `CLOZE_OUT_OF_BOUNDS` / `CLOZE_MARKER_TAMPER` / `CLOZE_FULL_OVERWRITE_BLOCKED` | error | `truthsrc guard-write` blocked edits outside `@cloze:start..@cloze:end` or attempts to tamper with markers. | Restrict edits strictly to lines inside the active `@cloze` slot. |
