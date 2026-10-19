# command-dsl v2 (old codegen 1:1)

Generates `<Name>CommandHelpers.scala` (matches `golden_master/.../CreditBalanceCommandHelpers.scala`):

- `trait <Name>CommandHelpers` with one `implicit object <Cmd>Helper extends CommandHelper[<Cmd>, <State>, <Param>, <Confirmation>]` per command
- Each helper has `toParam` / `createFailureReply` / `createSuccessReply`, each wrapped in `// ==== BEGIN MANUAL ====` / `// ==== END MANUAL ====` with `???`

Spec (aggregate-level): `{package, objectName, stateType, commands: [{name, fields, paramType, confirmationType, paramHint}]}`

Usage: `node emit.mjs <spec.json> <out.scala>`
