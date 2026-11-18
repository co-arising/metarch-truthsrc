# Classic CQRS v4 — independent raw Scala expected archive

These assets seal the approved `classic-architecture@4` packet before generator
implementation. Each input has **19 complete Scala files**: the original 17 are
binary copies of independent v3 expected; Repository Port and Impl are binary
copies of original public `net.imadz.codegen.CodegenMain` output. No expected
content is derived from JS output, builders or templates. This owner ran no
Scala/Node generator, comparator, tests, typecheck, JVM/build or services.

## Measured scope and bytes

- Baseline: **19 files / 43037 bytes**.
- Timestamp-int: **19 files / 43036 bytes**.
- Total: **38 files / 86073 bytes**.

The comparison roots are `baseline/` and `timestamp-int/`. Only the following
complete original paths are selected, in the scope's declared order.

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
- `app/net/imadz/banking/application/aggregates/CreditBalanceAggregate.scala`
- `app/net/imadz/banking/application/aggregates/factories/CreditBalanceAggregateFactory.scala`
- `app/net/imadz/banking/application/aggregates/repository/CreditBalanceRepository.scala`
- `app/net/imadz/banking/infrastructure/repositories/aggregate/CreditBalanceRepositoryImpl.scala`

`scope.json` has `expectedOnly: []` and
`actualOnly: ["anchors.json", "truthsrc.ledger.json"]`. README, scope, provenance
and manifest live **outside both comparison roots**. No additional actual payload
is exempted, and neither ledger nor anchors is an expected Scala file.

## Authenticated original boundaries

All 19 selected files were actually read as full raw bytes and authenticated
against each original sidecar manifest in **all four original runs**:
`.rounds/f1-byte-parity-20261116/reference/raw-a`, `reference/raw-b`, `variant/raw`
and `variant/raw2`. Selected baseline A/B and timestamp-int A/B bytes are equal.
The original 17 v3 files match their per-variant originals and repeats before
copying. The two additions also have identical complete bytes across all four
runs; they are not changed-output Scala parity variants.

| Added selected file | Actual bytes | Actual SHA-256 in all four runs |
| --- | ---: | --- |
| Port, `application/aggregates/repository/CreditBalanceRepository.scala` | 1425 | `38bc1381a4531f67d07d7b6be20b46c7c0cede42dadb9a9d359082bfb4dd6d85` |
| Impl, `infrastructure/repositories/aggregate/CreditBalanceRepositoryImpl.scala` | 1243 | `07832102033229fada393dce533116c1ec06afee18a33a383feae831f23b2c1e` |

Each original run has **108 regular files: 83 Scala + 3 protobuf + 22 other**.
Only 19 payloads per run were read/authenticated here. The remaining **89 payloads
per run remain unread and unauthenticated**; their names, stat sizes and historical
manifest hashes are metadata inventory only, not fresh byte certification.
The safe original completion files are freshly pinned and parsed for successful
exit, timeout, reap and group-empty fields. Public receipt identities and safe
summaries are captured from pinned v3 provenance and cross-bound to the original
manifest/completion metadata. Underlying receipt arguments/environment, invocation
files, transcripts, secrets and unselected payloads were not read.

## Original source and actual support inventory

The frozen source identity remains original owner `f1-reference-owner-20261116`,
commit `cc335eb1e0d0fae17bf092fd61b126040196ea70`, root `.rounds/f1-byte-parity-20261116/bc-source`.
The original source manifest is **211155 bytes**, SHA-256
`2583d4ca4b8e636220a6ab851805de7d2361310dbca1b7e9ec1eb73c27c8da38`.
Its 706 source entries are inventory, not a claim to authenticate all source files.

Provenance enumerates **41 actual full-source payloads** authenticated
against their source-manifest SHA-256 and actual Git blob bytes. This includes
six new Repository Port/Impl model/builder/template files, six reused Root/Factory
MBT files and the concrete metadata/registry/resolver/naming/layout/import/knowledge
header/dispatch/writer support inventory. **35** have existing frozen
`docs/codegen-parity/baseline/bc` snapshots and pass full raw byte equality against
`bc-source`; the rest are explicitly pinned-source-only with no docs snapshot.
All six new MBT snapshots are present and exactly equal. The inventory is the
bounded selected-route source support, **not** the transitive build/import/type
closure of every branch of the complete original CodegenMain application. Unused
scanner support and lineage-only source checks are identified as such in provenance.
No live sibling source was substituted and no source was executed.

## Original inputs and portable request contract

The new requests preserve v3 text layout and change **only** requirement version
`4`, payload `truthsrc.classic-architecture/v4`, and capability
`classic-source-scaffold@4`. They still reference complete original F1 metadata:
`../classic-cqrs-f1/baseline.json` and `../classic-cqrs-f1/timestamp-int.json`.
Input schema `/v1`, roles, assemblies, dependencies and request options remain
unchanged. Inputs/options are not copied, pruned or modified.

| Read-only original input | Bytes | SHA-256 |
| --- | ---: | --- |
| `test/fixtures/classic-cqrs-f1/baseline.json` | 159364 | `860aac654a4877fef37d933afb058424b6017efecd7becc0a5595f772b33dc02` |
| `test/fixtures/classic-cqrs-f1/timestamp-int.json` | 159363 | `51c5cb9de55e99b04cf79c46b1cfa389305a1db63689a22ea072aca98d5b5954` |
| `test/fixtures/classic-cqrs-f1/options.json` | 167 | `84406bd393b3632c0789e432919fd9b8614cc99da67432723890700e14cf031f` |

The full inputs match original manifest-bound metadata bytes. The exporter source
`tools/codegen-parity/ClassicMetadataExport.scala` is independently authenticated,
4379 bytes / `bc46d15c3f3538d609ce02f4bc807b8ff8b0cbddf39392970690183f8410da6a`.
Its original source symbol is `net.imadz.meta.Examples.bankingSystem`; it exports
complete tagged Scala Products with field names/defaults. The frozen Examples and
original timestamp-int source probe are independently authenticated as complete
bytes with the original exact LongType-to-IntType replacement. No exporter runs.

`manifest.json` requires exactly **43 shipped rows**: 38 Scala, two new requests,
README, scope and provenance. Every required `files` path is under this new v4
reference/fixture tree and has actual bytes/SHA-256 pins. The manifest excludes
itself (**44 shipped files including self**) and does not recursively self-pin.
Original F1 inputs/options are separately pinned existing repository references,
not new shipped rows. Historical/local paths are optional captured lineage;
repository-relative paths are used where possible. No absolute historical pointer
is required to replay the portable shipped archive.

The local `.rounds/classic-cqrs-v4-20261117-01/assets/asset-preflight.json` is
**optional** (`availability: "local-audit"`, `requiredForReplay: false`), pinned
outside `files`. It records exclusive ordered copies and original before/after
preservation before the final manifest is written. It is ignored local audit, not
a new-clone dependency or a runtime acceptance receipt.

## Raw defects and explicitly unclaimed outcomes

This is **scaffold-only, not runnable** (`classic-scaffold-only`, runnable false).
Nineteen selected files are **not type-closed** and are not certified compilable.
Raw Port imports the unresolved
`net.imadz.banking.application.aggregates.CreditBalanceAggregateProtocol.CreditBalanceAggregateCommandFamily`;
raw Impl imports the unresolved
`net.imadz.banking.application.aggregates.CreditBalanceProtocol.CreditBalanceCommandFamily`.
The actual selected Protocol declares `CreditBalanceCommand` at line
24, not either synthesized family. Owner-prefix routing does not
prove those members exist. No aliases, protocol objects or financial/business
interpretations were invented to repair the original output.

Original generated header, comments, duplicate EntityRef/ImplementedBy port
imports, raw invalid default-family types, any original `???`, whitespace and
trailing LF bytes are preserved without fixes. Port ends with two LF bytes;
Impl ends with one. The Impl sharding scaffold is not executed business logic.

This seal is **asset provenance/integrity only**, not JS emission or public CLI
parity acceptance. Additional legal/invalid plans are **not Scala parity**.
Changed-output two-ended Scala coverage for the new Port/Impl remains OPEN.
PlainFP, ScalaCheck, ScalaCompilation, BusinessRuntime, FinancialOracle, ABI and
BankMigration are NOT_RUN. Old successful/failed evidence remains unchanged.
No implementation/shared code, current author tree, `.truthsrc`, anchors, ledger,
journal or old assets were written. No stage/commit/push, worktree, cleanup,
build/download/service/container or task/workflow actions were performed.
Missing source/bytes, pin drift or exclusive path conflicts require BLOCKED,
never guessed or JS-derived expected.
