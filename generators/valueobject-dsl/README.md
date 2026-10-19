# valueobject-dsl v2 (old codegen 1:1)

Generates `<Name>.scala` (matches `golden_master/.../Money.scala`):

- `case class <Name>(...)` (not final, per old convention)
- `// Value Object Logic Stubs` marker inside

Spec: `{package, name, description, fields: [{name, dataType}], imports?: [...]}`

Usage: `node emit.mjs <spec.json> <out.scala>`
