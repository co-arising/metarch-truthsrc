# Generators: Old Baseline → New Baseline Migration

The `scala-cqrs-es*` generators are the **old baseline** (hand-written Akka style).
The `*-dsl` generators are the **new baseline** (0.2 lib style).

## Mapping

| Old (deprecated) | New (baseline) | Status |
|---|---|---|
| `scala-cqrs-es` | `aggregate-dsl` | ✅ Replaced |
| `scala-cqrs-es-api` | `api-dsl` | ✅ Replaced |
| `scala-cqrs-es-ddl` | `ddl-dsl` | ✅ Replaced |
| `scala-cqrs-es-projection` | `projection-dsl` + `readmodel-dsl` | ✅ Replaced |
| `scala-cqrs-es-policy-exec` | `policy-dsl` | ✅ Replaced |
| `scala-cqrs-es-rules` | `policy-dsl` | ✅ Replaced |
| `scala-cqrs-es-function-specs` | — | ⚠️ No replacement; docs not codegen |

## New-baseline generators (all: Spec → Code → Compile ✅)

- `saga-dsl`, `monarch-dsl`, `event-dsl`, `command-dsl`, `aggregate-dsl`
- `policy-dsl`, `auth-dsl`, `readmodel-dsl`, `projection-dsl`
- `api-dsl`, `ddl-dsl`, `valueobject-dsl`, `ts-types`
