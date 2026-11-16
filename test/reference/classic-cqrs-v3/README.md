# Classic CQRS v3 — independently preserved expected bytes

Archival expected assets for approved #702, `classic-architecture@3`.
Each comparison root contains **17 complete Scala files**, preserved as binary
copies before this asset owner makes any JS call (this owner made none).
The original 15 files are copied from the independent `classic-cqrs-v2` expected
assets, not regenerated. Root and Factory are copied from the existing successful
public Scala `net.imadz.codegen.CodegenMain` output, never from a JS renderer.
Original defects, comments, imports, headers, whitespace and final bytes remain
unchanged. This archive is not an application or an execution acceptance pass.

## Measured byte counts and exact scope

- Baseline: **17 Scala files / 40369 complete raw bytes**.
- Timestamp-int: **17 Scala files / 40368 complete raw bytes**.
- Total: **34 Scala files / 80737 complete raw bytes**.

The scope contains exactly the following original 15 plus two new paths.

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

`scope.json` uses `truthsrc.codegen-parity-scope/v1`, with `expectedOnly: []`
and `actualOnly: ["anchors.json", "truthsrc.ledger.json"]`. There is no expected
intersection with those control files. The expected roots contain only the 17
Scala paths each. README, scope, provenance and manifest are outside both roots;
the independent asset-preflight report is under the assigned owner assets child.
No other unexpected actual files are exempted. The comparator was not executed;
the main integration owner handles the initial missing-Root/Factory comparison.

## Independent source preservation

Every selected full raw file was freshly checked against its original per-run
manifest in all four original runs, then checked against its paired repeat and
copy source. All 15 prior expected files also match their corresponding originals.
The original runs are `.rounds/f1-byte-parity-20261116/reference/{raw-a,raw-b}`
and `.rounds/f1-byte-parity-20261116/variant/{raw,raw2}`.
Each manifest and actual metadata-only inventory has **108 regular files**, not
108 Scala: **83 Scala + 3 protobuf + 22 other**. The remaining **91 payloads per
run were not read or copied**. Provenance embeds inventory names, sizes and hashes
only; it does not recertify byte equality of those 91 files.

| Added full Scala file | Bytes | SHA-256, verified in all four original runs |
| --- | ---: | --- |
| `application/aggregates/CreditBalanceAggregate.scala` | 1021 | `2b06e99d1ccdb5903b259f04897c7c08859e863ea07dc48917bd7c54d8ea5121` |
| `application/aggregates/factories/CreditBalanceAggregateFactory.scala` | 3314 | `d7f457ba1e65825cde1008f515de765d67f64ed999d6b63cfd20960a775668df` |

The source identity is original owner `f1-reference-owner-20261116`, source commit
`cc335eb1e0d0fae17bf092fd61b126040196ea70`, with the original pinned
`.rounds/f1-byte-parity-20261116/bc-evidence/source-manifest.json` and `bc-source`.
All six AggregateRoot/Factory model, builder and template snapshots under
`docs/codegen-parity/baseline/bc/` exactly match full pinned `bc-source` bytes and
the original source-manifest records. The same check passes for TypeResolverDSL,
TypeSystem, CodeGenerationDSL, GeneratorContext, NamingConventions, PackageLayout
and KnowledgeAnchorDoc. Only these 13 relevant source payloads are verified; the
706-entry source closure is metadata, not a 706-payload scan or live-source claim.
Provenance records all 13 exact paths, complete SHA-256 values and source entries.

Original run receipts and completions are bound by their original bytes/SHA pins
and freshly opaque hashes. Receipt arguments/environment are never parsed or
shown; safe historical exit/pass summaries come from the pinned v2 provenance.
Only allowed pass/exit/timeout/reap fields are freshly parsed from completions.
No old transcript, secret, scaffold configuration or sensitive render-host payload
is read, printed or packaged. Existing v2, F1 and all old evidence remain read-only.

## Reused metadata, options and new request version

Both requests are the v2 request bytes with only requirement version `"3"`, payload
`truthsrc.classic-architecture/v3`, and capability `classic-source-scaffold@3`
changed. The same complete metadata references remain
`../classic-cqrs-f1/baseline.json` and `../classic-cqrs-f1/timestamp-int.json`.
Input roles, schema `/v1`, dependencies, assemblies and request options are unchanged.
Metadata/options are referenced, not duplicated, pruned or modified.

| Existing read-only file | Bytes | SHA-256 |
| --- | ---: | --- |
| `test/fixtures/classic-cqrs-f1/baseline.json` | 159364 | `860aac654a4877fef37d933afb058424b6017efecd7becc0a5595f772b33dc02` |
| `test/fixtures/classic-cqrs-f1/timestamp-int.json` | 159363 | `51c5cb9de55e99b04cf79c46b1cfa389305a1db63689a22ea072aca98d5b5954` |
| `test/fixtures/classic-cqrs-f1/options.json` | 167 | `84406bd393b3632c0789e432919fd9b8614cc99da67432723890700e14cf031f` |

The complete metadata bytes match the originals bound to all four output manifests.
The historical metadata-exporter/source-symbol identity is inherited explicitly
from v2 provenance; no exporter or JVM is executed in this task.

`provenance.json` uses `truthsrc.codegen-parity-provenance/v1` and binds the v2
lineage, original commands' public class identity, output manifests, four opaque
receipts/completions, inputs/options, selected original records and 34 byte copies.
`manifest.json` lists **39 shipped assets** in its portable `files` required set:
34 expected Scala files, two requests, README, scope and provenance. Every row is
confined to `test/reference/classic-cqrs-v3/` or
`test/fixtures/classic-cqrs-v3/` and has complete bytes/SHA-256 pins. The manifest
excludes itself from this set to avoid recursion (**40 files including itself**).
Historical source/lineage references elsewhere are audit identity, not additions
to this required set.

`ownerPreflightReport` retains the original local report's path and byte/SHA-256
identity as an external pointer with `availability: "local-audit"` and
`requiredForReplay: false`. This ignored report is not shipped, not listed in
`files`, and not required in a new clone. The original local preservation report
remains byte-for-byte unchanged: it records the older, pre-adjustment manifest
contract (40 rows, 41 files including self), is historical preservation evidence,
and is **not a runtime or current portable-metadata acceptance pass**. This
metadata-only correction changes no expected Scala, requests, scope or provenance.
All original asset creation used absent/exclusive binary mode with nonsymlink
canonical paths.

## Explicit remaining boundaries

This owner made **zero Scala, JS, comparator, test, typecheck, internal import-and-call,
JVM, build, service, download, publish or Git calls**. Assignment HEAD is recorded
as declared, not asserted from a new Git inspection. No generator implementation
or broader implementation review is part of this asset task.

Root and Factory have identical bytes in baseline and timestamp-int across the
four original runs. An additional independent changed-output-input Scala expected
for these two files is **OPEN**, not silently covered by the timestamp probe.
The expected archive does not certify v3 JS emission, determinism, public CLI
negative controls, compilation, Plain FP/ScalaCheck, financial rules or runtime
readiness. The intended scaffold boundary remains non-runnable.

Missing source pins, source/expected drift or exclusive-path conflicts must remain
BLOCKED. Never fabricate or refresh expected bytes from a renderer or repair old
assets. Later generation and comparison must use separate fresh actual roots.
