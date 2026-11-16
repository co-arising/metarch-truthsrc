# Classic CQRS v2 — independently preserved expected bytes

These are archival expected assets for the approved `classic-architecture@2`
contract, not JavaScript generator output or a runnable banking application.
`baseline/` and `timestamp-int/` each contain **15 complete Scala files** copied
byte-for-byte from the original public Scala `net.imadz.codegen.CodegenMain.main`
successful runs at source commit `cc335eb1e0d0fae17bf092fd61b126040196ea70`.
No template was transcribed; no JS expected output was used to fill these files.
No content, headers, whitespace, trailing bytes, or original defects were changed.

## Exact scope and sizes

- Baseline: 15 files, **36034 complete raw bytes**, copied from original `reference/raw-a`.
- Timestamp-int: 15 files, **36033 complete raw bytes**, copied from original `variant/raw`.
- Total: **30 Scala files, 72067 complete raw bytes**.
- The same 15 complete paths were freshly checked byte-equal against baseline B
  (`reference/raw-b`) and variant B (`variant/raw2`), respectively.
- Each of the four original manifests inventories 108 regular files. The other
  **93 files per run** remain inventory-only: their payloads were not read or copied.
  Full inventories are embedded in `provenance.json`, including hidden/config paths
  as names, byte counts and SHA-256 values only. No secret content is archived.

The 15 paths below are all taken from the actual original manifest inventories.
The first four retain the old F1 slice; the extension is Money, the event handler,
and nine original `RuleRule.scala` paths, including their duplicated suffixes.

- `app/net/imadz/banking/application/aggregates/CreditBalanceProtocol.scala`
- `app/net/imadz/banking/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala`
- `app/net/imadz/banking/application/aggregates/behaviors/CreditBalanceBehaviors.scala`
- `app/net/imadz/banking/domain/entities/CreditBalanceEntity.scala`
- `app/net/imadz/banking/domain/values/Money.scala`
- `app/net/imadz/banking/domain/entities/behaviors/CreditBalanceEventHandler.scala`
- `app/net/imadz/banking/domain/invariant/AddInitialOnlyOnceRuleRule.scala`
- `app/net/imadz/banking/domain/invariant/CancelIncomingCreditRuleRule.scala`
- `app/net/imadz/banking/domain/invariant/CommitIncomingCreditsRuleRule.scala`
- `app/net/imadz/banking/domain/invariant/DeductFundsRuleRule.scala`
- `app/net/imadz/banking/domain/invariant/DepositRuleRule.scala`
- `app/net/imadz/banking/domain/invariant/RecordIncomingCreditsRuleRule.scala`
- `app/net/imadz/banking/domain/invariant/ReleaseReservedFundsRuleRule.scala`
- `app/net/imadz/banking/domain/invariant/ReserveFundsRuleRule.scala`
- `app/net/imadz/banking/domain/invariant/WithdrawRuleRule.scala`

`scope.json` uses exactly `truthsrc.codegen-parity-scope/v1`, with 15 `paths`,
`expectedOnly: []`, and `actualOnly: ["anchors.json", "truthsrc.ledger.json"]`.
The two expected roots contain only their 15 Scala files. README, scope,
provenance and manifest stay here in the parent. An actual comparison root must
contain exactly the 15 scoped files plus those two ancillary receipts; receipt
bytes are not Scala parity targets. No other unexpected files are ignored.

Within this slice only `CreditBalanceEntity.scala` differs between variants,
by the original timestamp type input. The `.proto` difference outside this slice
is inventory evidence only, not copied content or comparison coverage.
Raw defects, duplicate imports, comments and `CodegenMain:parity-f1-cc335eb1`
headers are intentionally preserved. Never repair or replace expected bytes
from JS output. This is not 108-file parity, full template coverage, generated
application compilation, or business/runtime readiness.

## Reused frozen inputs and origin evidence

The new fixture directory contains **only two requests**. It does not duplicate
or edit metadata/options. Both requests keep the F1 `truthsrc.product-input-files/v1`
contract, `truthsrc.classic-architecture-input/v1` document role, empty assemblies,
input role bindings, dependencies and request options. Only the relative document
file and approved product version/schema/capability are adapted:

- Requirement `classic-architecture`, version `"2"`.
- Payload schema `truthsrc.classic-architecture/v2`.
- Capability `classic-source-scaffold`, version `"2"`.
- Architecture files `../classic-cqrs-f1/baseline.json` and
  `../classic-cqrs-f1/timestamp-int.json`.

| Existing read-only input | Bytes | SHA-256 |
| --- | ---: | --- |
| `test/fixtures/classic-cqrs-f1/baseline.json` | 159364 | `860aac654a4877fef37d933afb058424b6017efecd7becc0a5595f772b33dc02` |
| `test/fixtures/classic-cqrs-f1/timestamp-int.json` | 159363 | `51c5cb9de55e99b04cf79c46b1cfa389305a1db63689a22ea072aca98d5b5954` |
| `test/fixtures/classic-cqrs-f1/options.json` | 167 | `84406bd393b3632c0789e432919fd9b8614cc99da67432723890700e14cf031f` |

The metadata inputs were also checked byte-equal to their original raw-manifest
metadata sources. They are complete `SystemMetadata` exports from
`truthsrc.codegenparity.ClassicMetadataExport.main` over
`net.imadz.meta.Examples.bankingSystem`, not reduced examples or parsed Scala.
The timestamp-int input is the original `BalanceChanged.timestamp`
`LongType` to `IntType` probe, not a banking time-semantics migration.

`provenance.json` records the four original manifest pins, successful public CLI
receipt/completion pins with embedded small result summaries, complete 108-entry
inventories, precise 15-file selections, original source commit and F1 lineage.
It records repository-relative origin locations so reusable evidence is not
solely dependent on the historical absolute workspace. Missing historical local
raw trees do not prevent use of the saved expected roots and existing fixtures.
The original source closure and metadata-exporter pins are inherited from F1 and
explicitly not recertified by reading source/runtime trees or compiler classes.
No full raw tree, classes, environment values, secrets, application configuration
payloads, render-host verification or agent output was read or packaged.

`manifest.json` hashes every other new asset using repository-relative paths,
excluding itself, and links each Scala copy to its original manifest entry and
paired-repeat manifest. It is a preservation inventory, not an @2 execution pass.
Input/expected drift or an exclusive-path conflict must remain a failure; preserve
failure evidence and stop rather than overwrite or refresh this archive.

## Public CLI replay — fresh actual roots only

Requires Node **>= 22.13.0**, the public v2 generator and comparator, and owned
fresh output paths. Run from the physical repository root. Do not use symlinks,
hardlinks, mount aliases, overlapping roots, or an existing actual/report path.
Never generate into either frozen asset directory or any shared application.

The commands below are documentation for later replay. **This expected-owner task
did not run them**, import internal generator code, run tests/typechecks, generate
JS/Scala, compile a generated application, launch services, or verify @2 generation.

```sh
set -eu
J="$(pwd -P)"
F="$J/test/fixtures/classic-cqrs-v2"
R="$J/test/reference/classic-cqrs-v2"
OPTIONS="$J/test/fixtures/classic-cqrs-f1/options.json"
test -f "$J/bin/truthsrc.js"
test -d "$J/generators/scala-cqrs-classic-v2"

# Canonicalize macOS TMPDIR; both actual roots and both reports remain NEW.
RUN="$(mktemp -d "${TMPDIR:-/tmp}/classic-cqrs-v2.XXXXXX")"
RUN="$(cd "$RUN" && pwd -P)"

node "$J/bin/truthsrc.js" generate-products \
  --request "$F/request-baseline.json" \
  --generator "$J/generators/scala-cqrs-classic-v2" \
  --out "$RUN/baseline" \
  --options-json "$OPTIONS"

node "$J/bin/truthsrc.js" generate-products \
  --request "$F/request-timestamp-int.json" \
  --generator "$J/generators/scala-cqrs-classic-v2" \
  --out "$RUN/timestamp-int" \
  --options-json "$OPTIONS"

node "$J/tools/codegen-parity.mjs" \
  --expected "$R/baseline" \
  --actual "$RUN/baseline" \
  --scope "$R/scope.json" \
  --report "$RUN/compare-baseline.json"

node "$J/tools/codegen-parity.mjs" \
  --expected "$R/timestamp-int" \
  --actual "$RUN/timestamp-int" \
  --scope "$R/scope.json" \
  --report "$RUN/compare-timestamp-int.json"
```

Comparison is complete raw-byte equality, with no trim, newline conversion,
header stripping or repair. Exit 0 certifies only these 15 scoped files and the
exact declared inventory. Exit 1 is mismatch; exit 2 is blocked/I/O/recheck failure.
An `equal` report with a nonzero process exit is not a pass. Reports stay outside
both compared roots; every rerun needs new output and report paths. This portable
scope has no machine-specific `sourcePins`; archive hashes and embedded origin
receipts supply integrity/provenance, not a claim of verified @2 generation.
