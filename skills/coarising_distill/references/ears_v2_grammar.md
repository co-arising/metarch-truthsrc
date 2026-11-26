# EARS v2 Grammar & Error-Code Reference (Bundled with `coarising-distill`)

> Self-contained grammar reference for `behaviors/domain/*.ears` and `behaviors/application/*.{story,integration}.ears`. Read this BEFORE writing any `.ears` file.

---

## 1. File Header & Directory Placement (Hard Gate `V2_PATH_LAYER_MISMATCH`)

| Kind | Header (EN) | Header (CN) | Required Directory | Allowed Actions |
| :--- | :--- | :--- | :--- | :--- |
| Domain slice | `slice <Aggregate>.<Command>` | `切片 <Aggregate>.<Command>` | `behaviors/domain/*.ears` | `reject`, `emit`, `transition`, `succeed-empty`, `keep` |
| Application user story | `story <StoryName> layer application` | `故事 <StoryName> 层级 应用` | `behaviors/application/*.story.ears` | `reject`, `pin`, `dispatch`, `respond`, `expose`, `keep` |
| External integration policy | `story <PolicyName> layer application` | `故事 <PolicyName> 层级 应用` | `behaviors/application/*.integration.ears` | `reject`, `pin`, `dispatch`, `respond`, `expose`, `keep` |

> Never put a `story` under `behaviors/domain/` or a `slice` under `behaviors/application/`.
> Every `<Aggregate>`, `<Command>`, `<Port>.<op>`, `<Event>`, `<ResponseVO>`, `<ReadModel>`, and `extern` referenced in `.ears` MUST already exist in `structures/*.yaml`.

---

## 2. Domain Slice Template (`behaviors/domain/<agg>-<cmd>.ears`)

```ears
slice WalletLedger.ReserveFunds

where:
  positiveAmount  = amount > 0.00                         as "预留金额为正"
  withinCap       = amount <= ledger.singleCap            as "未超过单笔限额"
  sufficientFunds = ledger.availableAmount >= amount      as "可用余额充足"
  txNotReserved   = not (txId in ledger.reservedByTx)     as "交易号尚未预留"
  ledgerActive    = ledger.status == "active"             as "账户未冻结"

axioms:
  [AX-WL-1] ALWAYS ledger.availableAmount >= 0.00
  [AX-WL-2] ALWAYS ledger.reservedTotal >= 0.00

rules:
  [LEDGER_FROZEN]       IF not ledgerActive    THEN SHALL reject request with LEDGER_FROZEN
  [NON_POSITIVE_AMOUNT] IF not positiveAmount  THEN SHALL reject request with NON_POSITIVE_AMOUNT
  [EXCEEDS_SINGLE_CAP]  IF not withinCap       THEN SHALL reject request with EXCEEDS_SINGLE_CAP
  [TX_ALREADY_RESERVED] IF not txNotReserved   THEN SHALL reject request with TX_ALREADY_RESERVED
  [INSUFFICIENT_FUNDS]  IF not sufficientFunds THEN SHALL reject request with INSUFFICIENT_FUNDS

  [FUNDS_RESERVED]      WHILE ledgerActive and positiveAmount and withinCap and txNotReserved and sufficientFunds
                        WHEN ReserveFunds
                        SHALL emit FundsReserved
                        post:
                          ledger.availableAmount'    = ledger.availableAmount - amount
                          ledger.reservedTotal'      = ledger.reservedTotal + amount
                          ledger.reservedByTx'[txId] = amount
```

Key domain syntax rules:
- Use aggregate aliases declared in `structures/*.yaml` (e.g. `ledger.availableAmount`, `state.availableAmount`).
- `post:` uses primed state fields (`ledger.field' = ...` or `ledger.map'[key] = ...`).
- `SHALL transition order.status -> "confirmed" AND emit OrderConfirmed` is valid for enum state transitions.
- Every rejection code (`with <CODE>`) should be registered in `aggregates[*].ruleRefs`.
- Rule ordering uses **DMN First-Hit**: place guard rejections before the happy-path acceptance rule, and ensure the happy-path `WHILE` condition is the exact conjunction of all positive predicates (or Z3 will report a **gap** or **conflict**).

---

## 3. Application Story / Integration Template (`behaviors/application/<name>.story.ears`)

```ears
story WalletTransfer layer application

where:
  validAmount = amount.currency == "CNY" and amount.amount > 0.00 as "金额为正人民币"
  extern sessionAuthenticated(actor)                              as "会话已认证"
  extern requestExists(actor, clientRequestId)                    as "请求号已登记"
  extern payloadMatchesOriginal(actor, clientRequestId, amount)   as "重入参数与原请求一致"

axioms:
  [AX-WT-1] ALWAYS TransferSubmit SHALL NOT supply internalAccountId, operationId

rules:
  [WT-01] IF not sessionAuthenticated(actor)
          WHEN TransferSubmitPort.submit
          THEN SHALL reject request with UNAUTHORIZED

  [WT-02] IF not validAmount
          WHEN TransferSubmitPort.submit
          THEN SHALL reject request with INVALID_AMOUNT

  [WT-03] WHILE not requestExists(actor, clientRequestId)
          WHEN TransferSubmitPort.submit
            AND sessionAuthenticated(actor) AND validAmount
          SHALL pin TransferOriginal from (actor, clientRequestId)
            AND dispatch WalletLedger.ReserveFunds
            AND respond TransferAck with ack.replayed == false and ack.accepted == true

  [WT-04] WHILE requestExists(actor, clientRequestId)
          WHEN TransferSubmitPort.submit
            AND sessionAuthenticated(actor) AND validAmount
            AND payloadMatchesOriginal(actor, clientRequestId, amount)
          SHALL respond TransferAck with ack.replayed == true and ack.accepted == true
            AND SHALL NOT dispatch WalletLedger.ReserveFunds

  [WT-05] IF not payloadMatchesOriginal(actor, clientRequestId, amount)
          WHILE requestExists(actor, clientRequestId)
          WHEN TransferSubmitPort.submit
            AND sessionAuthenticated(actor) AND validAmount
          THEN SHALL reject request with REQUEST_CONFLICT
```

Key application syntax rules:
- **Triggers**: `WHEN <Port>.<op>` (from `structures.ports`) OR `WHEN event <Aggregate>.<Event>` (event choreography from `structures.aggregates[*].events`).
- **Actions**:
  - `SHALL reject request with <CODE>`
  - `SHALL pin <Artifact> from (<arg1>, <arg2>)`
  - `SHALL dispatch <Aggregate>.<Command>` / `SHALL NOT dispatch <Aggregate>.<Command>`
  - `SHALL respond <ResponseVO> with ack.<field> == <literal> [and ...]`
  - `SHALL expose <read-model-name> with view.<field> == <literal> [and ...]`
  - `SHALL keep <state>`
- **Security axioms**: `[AX-...] ALWAYS <InputName> SHALL NOT supply <field1>, <field2>`.

---

## 4. Supported Expressions & Predicates

| Construct | Syntax | Notes |
| :--- | :--- | :--- |
| Boolean logic | `and`, `or`, `not` (`且`, `或`, `不满足`) | Standard SMT Bool |
| Comparisons | `==`, `!=`, `<`, `<=`, `>`, `>=` | Scale-aligned fixed-point decimal or enum |
| Arithmetic | `+`, `-`, `*`, unary `-` | Nonlinear `var * var` promotes to `QF_NIA` (L2 `@cloze`) |
| Intervals | `x in [lo..hi]`, `x in (lo..hi]` | Numeric bounds |
| Finite sets | `x in {"a", "b"}`, `x not in {"c"}` | Checked against closed `enum` |
| Map ops | `k in agg.map`, `agg.map[k]` | Total map membership & lookup |
| Optionals / strings | `x is empty`, `x is non-empty`, `x is some`, `x is none`, `x == none`, `post: x' = none` | Option presence check & clearing (`none` / `null` / `无值` -> Scala `None`, TS `null`) |
| Quantifiers | `forall x in col : <pred>`, `exists x in col : <pred>` | Over `Seq[T]` |
| Aggregations | `count(col)`, `len(col)`, `sum(col)` | Over `Seq[T]` |
| Time windows | `elapsed within 5m`, `nowMs within 30s of createdAtMs` | Units: `ms`, `s`, `m`, `h`, `d` |
| External oracle | `extern fn(a, b)` | Must match `structures.externContracts` name & arity |
| Pure host helper | `@host(fn, a, b)` | Deterministic host helper |

---

## 5. Common Pitfalls & Diagnostic Codes

| Code | Cause | Fix |
| :--- | :--- | :--- |
| `EARS_NEG_PRED_NAME` | Predicate in `where:` or `extern` starts with `not`, `non`, `un`, `invalid`, `no`, `未`, `不`, `无`, `非` | Rename positively (`validAmount`, `txReserved`) and negate at use sites (`not validAmount`) |
| `V2_PATH_LAYER_MISMATCH` | `slice` under `application/` or `story` under `domain/` | Move file to matching directory |
| `V2_LEGACY_GUARD_FORBIDDEN` | `@guard`/`guardExpr` placed in YAML | Move behavior into `*.ears` |
| `EARS_UNKNOWN_ENUM_LITERAL` | String literal in `.ears` not in `enum:` / `units:` | Add the literal to `structures/*.yaml` or fix typo |
| `EARS_UNDECLARED_EXTERN` / `EARS_EXTERN_ARITY_MISMATCH` | `extern fn(...)` missing or wrong arity in `externContracts` | Register exact name & `params` in `structures/*.yaml` |
| `V2_FIRST_HIT_SHADOWED_RULE` | Earlier rule's condition subsumes a later rule (dead rule) | Tighten earlier rule or reorder rules |
| `V2_SMT_GATE_FAILED` | Z3 found a logic gap, conflict, or invariant violation | **NEVER guess** — present the A/B Clarification Card to the user and apply their choice |
| `V2_BILINGUAL_DRIFT` | Sibling `.zh.ears` AST hash differs from `.ears` | Keep EN/ZH clauses structurally isomorphic |
| `V2_STATE_CHANGE_WITHOUT_EVENT` | Domain rule mutates state (`transition`/`post:`) without `SHALL emit <Event>` | Add `SHALL emit <Event>` so Event Sourcing replay updates state |
| `V2_UNPROPAGATED_EVENT_FIELD` | Deterministic (L1) event declares a field absent from command parameters and state | Add the field to command parameters, declare `source: state.<f>`/`const:<v>`, or align names |
| `V2_EVENT_FIELD_TYPE_MISMATCH` | Event field type is incompatible with command parameter / state / constant source | Align types in `structures/*.yaml` |
| `V2_POST_EVENT_FIELD_MISSING` | `post:` references a variable not carried by the emitted event | Add the field to the emitted event's `fields:` (or use `none` to clear `Optional[T]`) |
| `V2_POST_EVENT_TYPE_MISMATCH` | `post:` expression evaluated against emitted event types mismatches state target | Align event field and state field types |
| `V2_LINEAGE_UNCONSUMED_NUMERIC_FIELD` | Emitted numeric/exact event field is never folded or read (fail-closed error!) | Fold it in `post:`, consume it in a story/readModel, or add typed `waiveLineage` |
| `V2_LINEAGE_WRITE_ONLY_STATE_FIELD` / `V2_LINEAGE_UNWRITTEN_STATE_FIELD` | State field is written-only or read-only without waiver | Read/write it or declare `waiveLineage` (`immutable-config`, `seed-only`, `audit-log`, `external-read`) |
| `V2_LINEAGE_UNSOURCED_READMODEL_FIELD` | Logical readModel field omits machine-checkable `source:` | Add `source: stateField:...`, `eventField:...`, `aggregateIdentity`, or `derived:<reason>` |
| `V2_AUTHZ_UNDECLARED_OPERATION` / `V2_AUTHZ_UNKNOWN_ROLE` / `V2_AUTHZ_UNKNOWN_CONTEXT_PARAM` | Port operation missing `authz` PEP contract or references undeclared role/param | Declare `authz:` (`auth-core`, `static-roles`, `external-pdp`, `public`, `internal-only`) |
| `V2_READSIDE_COLUMN_TYPE_CONFLICT` / `V2_READSIDE_UNKNOWN_READMODEL` | Physical `bindings/*-readside.yaml` conflicts with logical `readModels` | Align shared materialized view columns and served readModels |
