# pipeline.mjs — new-baseline orchestrator

Replaces `backend-codegen/tools/gen_pipeline.mjs` (old baseline, 47KB).

## What the old pipeline did

5-step orchestration:
```
CodegenMain → rules_domain_gen → gen_projection_handlers → gen_api_layer → gen_projection_ddl
```
With: staging/direct modes, territory enforcement (snapshot/diff),
rings checks, manifest generation, concern-based incremental.

## What the new pipeline does

21 independent `*-dsl` generators, each with `parse.mjs` + `emit.mjs`.
This orchestrator runs them in dependency order.

```bash
# Check mode: print plan
node generators/pipeline.mjs --tree <tree> --out <dir> --check

# Staging mode (default): generate to .staging, review, then copy
node generators/pipeline.mjs --tree <tree> --out <dir>

# Direct mode: generate straight to out
node generators/pipeline.mjs --tree <tree> --out <dir> --direct
```

## Dependency levels

1. Leaves: valueobject, event, command
2. Aggregates
3. Behaviors: saga, monarch, policy, invariant
4. Read side: repository, projection, readmodel
5. Services: service, connector, adapter, converter
6. Wiring: api, auth, bootstrap
7. Artifacts: ddl, proto, ts-types

## Safety

- Staging by default (review before merging)
- Manifest records what ran
- Territory: generators only write to their out dirs
- (Full snapshot/diff enforcement is future work — see old pipeline for reference)
