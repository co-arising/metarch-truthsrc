# invariant-dsl v2 (old codegen 1:1)

Generates one `<RuleName>Rule.scala` per rule (matches `golden_master/.../WithdrawRuleRule.scala`):

- `object <RuleName>Rule extends InvariantRule[<Event>, <State>, <Param>]`
- `private val <Err>: iMadzError = iMadzError("<code>", "<msg>")` per error
- `def apply(...)` with `>>> AI_PROMPT_START` block and `???`

Old naming convention: rule "WithdrawRule" → object "WithdrawRuleRule".

Spec: `{package, eventType, stateType, rules: [{name, paramType, paramName, subjectName, errors: [{valName, code, message}]}]}`

Usage: `node emit.mjs <spec.json> <out-dir>` (writes one file per rule)
