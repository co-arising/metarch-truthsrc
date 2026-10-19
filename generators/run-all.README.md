# run-all.mjs v2 — toolchain-driven

**NEVER hand-glob directories.** Use `lib/compile.mjs` (compileTree).

v1 manually globbed `inbox/01-event-flow/` etc. and missed 674 files
(events/commands in `aggregates/*/notes/`). v2 uses the toolchain's
`compileTree()` which knows the canonical layout.

Pipeline: `tree → compileTree → canonical JSON → generators`

```bash
node generators/run-all.mjs <tree-dir> <out-dir>
```
