# run-all.mjs — integration pipeline

One command: truth tree → all generated code.

```bash
node generators/run-all.mjs <tree-dir> <out-dir> [--binding <binding-dir>]
```

Runs each new-baseline generator:
1. Finds tree files (e.g., `inbox/01-event-flow/*.yaml` for events)
2. `parse.mjs` → Spec JSON
3. `emit.mjs` → code

Bindings (intent: handlers, field details, package names) live in
`generators/bindings/` — one JSON per generator. Tree provides structure,
binding provides intent. See each generator's README for the boundary.

## Current coverage

| Generator | Tree source |
|---|---|
| event-dsl | `inbox/01-event-flow/*.yaml` |
| command-dsl | `inbox/02-commands/*.yaml` |
| aggregate-dsl | `aggregates/*/aggregate.yaml` |
| policy-dsl | `policies/*.policy.yaml` |
| readmodel-dsl | `read-models/*.rm.yaml` |
| monarch-dsl | `pipelines/*.pipeline.yaml` |
| valueobject-dsl | `value-objects/*.vo.yaml` |

Saga (`kind: saga` atoms) and auth/api/ddl are binding-driven for now —
their tree parsers are thin. See MIGRATION.md.
