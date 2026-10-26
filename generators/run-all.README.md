# run-all.mjs v2 — toolchain-driven

**NEVER hand-glob directories.** Use `lib/compile.mjs` (compileTree).

v1 manually globbed `inbox/01-event-flow/` etc. and missed 674 files
(events/commands in `aggregates/*/notes/`). v2 uses the toolchain's
`compileTree()` which knows the canonical layout.

Pipeline: `tree → compileTree → canonical JSON → generators`

## Actual strict/composition source anchors (P18)

The strict Saga and composition Scala entries emitted by `run-all.mjs` now use
`src/core/generate.mjs::applyEntries`: the existing path preflight, territorial
merge/refusal and final-file anchor boundary. This is independent of the
`saga-dsl` manifest's still-blocked `strict-scala` mode. Only this source face
is described by the local `truthsrc.ledger.json`; it is not a whole-app ledger.

`anchors.json` is derived `truthsrc.anchors/v1`, owned by `truthsrc-run-all`.
Saga keys use the admitted `saga:<id>` and carry their definition digest.
Composition/child keys use the actual `pipeline:<id>`; a child-plan file can
have both parent and child knowledge ownership. Module/symbol/span remain
null: the evidence certifies final file bytes, not runtime readiness or parser
symbols. No anchors are written into the authored tree or semantic digest.

The source face is written-only: accepted ADD/MERGE/IDENTICAL outcomes can
certify locations; KEEP does not create new generated ownership. Prior other
owners/paths are retained. Changed non-MANUAL source is refused, not silently
COVERed and recertified. All generator errors return nonzero and prevent this
run from publishing a successful source index; skips remain legitimate.
Source/config application is not an atomic transaction and failures may leave
partial output. Use an explicitly owned output directory and retain failures.

```bash
node generators/run-all.mjs <tree-dir> <out-dir>
```
