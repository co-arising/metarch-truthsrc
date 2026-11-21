# emitter/ — the unified generator

The single code generator of metarch-truthsrc (emitter-unification decision,
2026-11-21): curated architecture generalized into one emitter, one family
module per family, the classic `generators/` line retired family by family.
The program plan is [docs/emitter-unification-plan.md](../docs/emitter-unification-plan.md);
the decisions below restate its F1–F8 baseline as they apply to this package.

## Family contract

Every family is one module in `families/` registered into `registry.mjs`
under a uniform, fail-closed contract:

| member | meaning |
|---|---|
| `id` / `familyNumber` | registry key and program ledger number (#11…#42) |
| `inputSchema` | the curated JSON schema — the sole emission input (F2) |
| `checkInput(input)` | fail-closed validation; coded diagnostics, no silent defaults (D-P08) |
| `renderAll(input)` | byte-deterministic map `relativePath → content` (纪律 3) |
| `runNegatives(input)` | directed rejection battery, `{expected, rejected, failures}`; `null` = registered debt, reported — never silently green |
| `goldenRoot` | the curated golden tree — the family's spec (F3, 金样即规格) |
| `fixtureDir` / `toolsRef` / `toolsExport` / `toolsMode` | parity provenance against `tools/gen-*.mjs` (the byte-parity reference until classic retirement) |

`renderFamily()` in the registry is the only emission envelope: strict copy →
`checkInput` → `renderAll` → output-shape validation (clean relative paths,
text content). A family module cannot skip a gate.

## Commands

```bash
node emitter/cli.mjs families                            # registered families
node emitter/cli.mjs generate <familyId> <input.json> <outDir>
node emitter/cli.mjs verify <familyId> <input.json>      # golden parity + determinism + battery
node emitter/cli.mjs negatives <familyId> <input.json>
node emitter/parity.mjs                                  # Phase-1 acceptance (all families)
node emitter/parity.mjs <familyId>
node emitter/cli.mjs diff <oldDir> <newDir> [--json]     # per-file new-vs-old comparison (F5 呈报件)
```

## Porting note

The eight family modules are verbatim ports of `tools/gen-*.mjs` (Phase 1);
each carries its provenance in the registration block. `tools/gen-*.mjs`
remain the untouched byte-parity reference until each family's classic
replacement completes; four pre-battery curated modules (#11, #13, #25, #26)
carry no negatives battery — a registered debt to be backfilled through the
family gate, tracked by `emitter/parity.mjs` (`batteriesDebt`) and asserted
in `test/emitter-unification.test.mjs`.
