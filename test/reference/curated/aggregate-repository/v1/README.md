# Family `#12` `aggregate-repository` Curated Goldens (`v1`)

- **Family**: `#12` `aggregate-repository` (covers `emitter-unification-plan.md §5` `#12/22`)
- **Provenance**: `handwritten-golden` (`toolsRef: null`)
- **Contract**: `truthsrc.aggregate-repository-input/v1`
- **Artifacts (3 files, 87 lines headerless)**:
  - `app/example/bankwealth/application/aggregates/CreditBalanceRepository.scala`
  - `app/example/bankwealth/application/aggregates/FundOrderRepository.scala`
  - `app/example/bankwealth/application/aggregates/SipPlanRepository.scala`
- **Rulings (`docs/emitter-unification-host-family-rulings.md §20`, 2026-11-23)**:
  - L1 generated header dropped (`-46` bytes per file).
  - Q4 (`plan.md §8` family-level ruling): Approved Option A — `owned-local-actor-cache` synchronized mutable registry (`mutable.Map` + `var closed` under `synchronized`) is explicitly ruled legal as a bounded local non-actor-owning synchronous lookup cache, preventing double-spawn races while preserving 100% Scala ABI compatibility with `BankRuntime.scala`.
  - File-level `sources` (`source:bank-v1#/aggregates/{0,1,2}`), `deps` (`[<Name>Protocol.scala]`), and `aggregate-dsl` `productFootprint` preserved verbatim (`withSpan: 0`).
