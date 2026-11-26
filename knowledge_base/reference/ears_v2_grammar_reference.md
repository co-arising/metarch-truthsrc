# EARS v2 Bilingual Grammar Reference

> Applies to `metarch-truthsrc` co-arising 2.0 (`lib/ears/` + `lib/v2/`). Both English and Chinese keywords compile to byte-identical `CanonicalForm` ASTs and SHA-256 hashes.

---

## 1. File Header & Directory Placement

| Kind | Header (EN) | Header (CN) | Required Directory | Allowed Actions |
| --- | --- | --- | --- | --- |
| Domain slice | `slice <Aggregate>.<Command>` | `切片 <Aggregate>.<Command>` | `behaviors/domain/*.ears` | `reject`, `emit`, `transition`, `succeed-empty`, `keep` |
| Application user story | `story <StoryName> layer application` | `故事 <StoryName> 层级 应用` | `behaviors/application/*.story.ears` | `reject`, `pin`, `dispatch`, `respond`, `expose`, `keep` |
| External integration policy | `story <PolicyName> layer application` | `故事 <PolicyName> 层级 应用` | `behaviors/application/*.integration.ears` | `reject`, `pin`, `dispatch`, `respond`, `expose`, `keep` |

> Placing a `story` under `domain/` or a `slice` under `application/` is blocked at compile time with `V2_PATH_LAYER_MISMATCH`.

---

## 2. Top-Level Sections (Style A)

```ears
slice QuotaBucket.Reserve

where:
  validQty  = qty in [bucket.minQty..bucket.maxQty] as "quantity within range"
  withinCap = bucket.usedQty + qty <= bucket.totalCap

axioms:
  [AX-QB-1] ALWAYS bucket.usedQty <= bucket.totalCap

rules:
  [QTY_RANGE]    IF not validQty  THEN SHALL reject request with QTY_RANGE
  [CAP_EXCEEDED] IF not withinCap THEN SHALL reject request with CAP_EXCEEDED
  [RESERVED]     WHILE validQty and withinCap
                 WHEN Reserve
                 SHALL emit QuotaReserved
                 post:
                   bucket.usedQty' = bucket.usedQty + qty
```

Style C (`{ define ... axioms { ... } rule [ID] { ... } }`) is also accepted and normalizes to the identical AST.

---

## 3. EARS Clause Patterns

- **Ubiquitous**: `[ID] ALWAYS SHALL <actions>` (`恒成立 必须 ...`)
- **Unwanted (Guard Rejection)**: `[ID] IF <cond> [WHEN <trigger>] THEN SHALL <actions>` (`如果 ... 则 必须 ...`)
- **State-Driven / Complex**: `[ID] [WHERE <opt>] WHILE <state> WHEN [event] <trigger> [AND <cond>] SHALL <actions>`
- **Event-Driven Cross-Aggregate Choreography (P1 #5)**:
  ```ears
  [BC-01] WHILE not batchPinned(actor, reqId)
          WHEN event BatchOrder.BatchApproved
          SHALL pin BatchOriginal from (actor, reqId)
            AND dispatch BatchOrder.ApproveBatch
  ```
  - `WHEN <Port>.<Op>` binds against `structures.ports`.
  - `WHEN event <Aggregate>.<Event>` binds against `structures.aggregates[*].events` (unknown events fail with `EARS_UNKNOWN_TRIGGER_EVENT`).

---

## 4. Expressions & Predicates

| Construct | Syntax (EN / CN) | Semantics / SMT Encoding |
| --- | --- | --- |
| Boolean ops | `and`/`且`, `or`/`或`, `not`/`不满足` | Standard SMT Bool |
| Comparisons | `==`, `!=`, `<`, `<=`, `>`, `>=` | Scale-aligned fixed-point `Int` or interned `Enum` |
| Arithmetic | `+`, `-`, `*`, unary `-` | Scale-aligned fixed-point; nonlinear var*var promotes theory to `QF_NIA` (L2) |
| Intervals | `x in [lo..hi]`, `x in (lo..hi]` | Closed/open numeric bounds |
| Finite Sets | `x in {"a", "b"}`, `x not in {"c"}` | Closed-vocabulary enum validated |
| Map membership & lookup | `k in agg.map`, `agg.map[k]` | SMT `(Array Int Bool)` + `(Array Int Int)` |
| Emptiness & Option matching | `x is empty`, `x is non-empty`, `x is some` (`有值`), `x is none` (`无值`) | Optional `__present` Bool flag or empty string check |
| Collection quantifiers | `forall x in col : <pred>` (`所有`), `exists x in col : <pred>` (`存在`) | Bound variable typed to `col` element; TS `.every`/`.some`, Scala `.forall`/`.exists` |
| Sequence aggregations | `count(col)`, `len(col)`, `sum(col)` | `Int` / `Decimal`; TS `.length`/`.reduce`, Scala `.size`/`.foldLeft` |
| Time-window comparisons | `elapsed within 5m`, `nowMs within 30s of createdAtMs` | Duration literals (`ms`, `s`, `m`, `h`, `d`) expanded into decidable LIA inequalities |
| External host oracle | `extern fn(arg1, arg2)` (`外部判定`) | Must be registered in `structures.externContracts` with matching arity |
| Pure host computation | `@host(fn, arg1, ...)` | Deterministic host helper outside SMT arithmetic |

---

## 5. Positive-Affirmative Naming & Bilingual Isomorphism

- Predicate names in `where:` and `extern` MUST be positive-affirmative (must NOT start with `not`, `non`, `un`, `invalid`, `no`, `未`, `不`, `无`, `非` → `EARS_NEG_PRED_NAME`).
- If a `<stem>.zh.ears` sibling exists alongside `<stem>.ears`, `compile-v2` parses both and enforces `zh.canonicalSha256 === en.canonicalSha256` (`V2_BILINGUAL_DRIFT` on mismatch).

---

## 6. SMT Theory Tiers & Codegen Channels

| Tier | Condition | SMT Logic | Codegen Channel |
| --- | --- | --- | --- |
| **L1** | Domain slice, linear arithmetic, `externCount == 0`, single-command | `QF_AUFLIA` | **Channel 4A**: zero-token deterministic TS + Scala |
| **L2** | Nonlinear multiplication (`x * y`) or multi-command `k`-step BMC | `QF_NIA` / `QF_AUFLIA` | **Channel 4B**: typed scaffold + `@cloze` TDD + locked BDD oracles |
| **L3 / App** | `layer application` or `externCount > 0` | `QF_AUFLIA` (+ app BMC) | **Channel 4B**: typed Port scaffold + `@cloze` TDD + locked BDD oracles |
