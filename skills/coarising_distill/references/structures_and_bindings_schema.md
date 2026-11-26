# co-arising 2.0 YAML Schema Reference (`structures/*.yaml` & `bindings/*-effects.yaml`)

> Self-contained schema reference bundled with `coarising-distill` (derived directly from `lib/v2/structure-loader.mjs`, `lib/v2/coverage-audit.mjs`, and `schema/effect-binding-v2.schema.json`). Read this completely BEFORE authoring any YAML file.

---

## 1. Forbidden Legacy Keys (Hard Compile Error `V2_LEGACY_GUARD_FORBIDDEN`)

NEVER put behavioral or v1 guard keys anywhere inside `structures/*.yaml`:

- Forbidden keys: `@guard`, `guard`, `guards`, `guardExpr`, `expressions`, `domainDecision`
- Forbidden schema strings: `domain-decision@4`, `domain-guards-v3`, `domain-guards-v4`
- All behavioral rules, guards, and state folds belong ONLY in `behaviors/{domain,application}/*.ears`.

---

## 2. `truth/<context>/structures/<context>.yaml` Schema

### 2.1 Top-Level Keys

| Key | Type | Required | Purpose |
| :--- | :--- | :---: | :--- |
| `system` | `string` | yes | System identifier (kebab-case), e.g. `order-hub` |
| `context` | `string` | yes | Bounded Context identifier (kebab-case), e.g. `orders` |
| `exactTypes` | `array` | optional | Fixed-point decimal and unit-decimal (money) types (no floating point) |
| `valueObjects` | `array` | optional | Structured DTOs / responses (`respond <VO>`) |
| `readModels` | `array` | optional | Query projections (`expose <ReadModel>`) |
| `ports` | `array` | optional | Inbound application ports (`WHEN <Port>.<op>`) |
| `externContracts` | `array` | optional | Declared external host predicates (`extern fn(a, b)`) with exact arity |
| `aggregates` | `array` | yes | Domain aggregates with `stateFields`, `commands`, `events`, `ruleRefs` |
| `stories` | `array` | optional | Application story metadata (`pins`, `responses`, `views`, `callerContract`) |

### 2.2 Supported Type Expressions (`parseTypeExpr`)

| Syntax | Meaning |
| :--- | :--- |
| `Int` / `Integer` / `Long` | 64-bit integer |
| `Bool` / `Boolean` | Boolean |
| `String` | Unbounded string (or closed string when `enum: [...]` is specified) |
| `Decimal` / `Decimal(N)` | Fixed-point decimal with scale `2` or `N` |
| `<ExactTypeName>` | Reference to an entry in `exactTypes` (e.g. `AmountDecimal`, `Money`) |
| `<ValueObjectName>` | Reference to an entry in `valueObjects` |
| `Map[KeyType, ValueType]` | Total map / ledger (e.g. `Map[AccountId, AmountDecimal]`) |
| `Optional[ElemType]` | Nullable / optional value (`x is some`, `x is none`) |
| `Seq[ElemType]` | Ordered sequence (`forall`, `exists`, `count`, `len`, `sum`) |
| `<NominalId>` (e.g. `AccountId`, `OrderId`, `FundCode`) | Nominal string identifier |

### 2.3 Field Declaration Forms (Allowed in `stateFields`, `parameters`, `fields`)

Three forms are accepted by the parser:

1. **Concise mapping shorthand (most common)**:
   ```yaml
   - qty: QtyDecimal
   - usedQty: QtyDecimal = "0.00"
   - reservedByTx: Map[TxId, AmountDecimal] = []
   ```
2. **String shorthand**:
   ```yaml
   - "maxSingleLimit: AmountDecimal = \"50000.00\""
   ```
3. **Explicit object form (REQUIRED whenever declaring a closed `enum: [...]`)**:
   ```yaml
   - name: paymentOutcome
     type: String
     default: "pending"
     enum: ["pending", "succeeded", "failed"]
   ```

### 2.4 `exactTypes` Item Schema

Two forms:

- **Plain fixed-point decimal**:
  ```yaml
  - name: AmountDecimal
    form: decimal
    scale: 2
  ```
- **Unit-bearing fixed-point decimal (e.g., Money)**:
  ```yaml
  - name: Money
    form: unit-decimal
    scale: 2
    amountField: amount
    unitField: currency
    units: ["CNY"]
  ```
  > Every currency literal compared against `amount.currency` in `.ears` MUST be listed in `units: [...]` (closed-vocabulary gate).

### 2.5 Complete Valid `structures/<context>.yaml` Example

```yaml
system: wallet-app
context: wallet

exactTypes:
  - name: AmountDecimal
    form: decimal
    scale: 2
  - name: Money
    form: unit-decimal
    scale: 2
    amountField: amount
    unitField: currency
    units: ["CNY", "USD"]

valueObjects:
  - name: TransferAck
    fields:
      - replayed: Bool
      - accepted: Bool

readModels:
  - name: wallet-order-view
    fields:
      - settled: Bool
      - name: status
        type: String
        enum: ["pending", "settled", "rejected"]

ports:
  - name: TransferSubmitPort
    operations:
      - name: submit
        parameters:
          - actor: ActorId
          - clientRequestId: RequestId
          - amount: Money
        returns: TransferAck
  - name: WalletQueryPort
    operations:
      - name: get
        parameters:
          - orderId: OrderId
        returns: wallet-order-view

externContracts:
  - name: sessionAuthenticated
    ownerPort: TransferSubmitPort
    params:
      - actor: ActorId
  - name: requestExists
    ownerPort: TransferSubmitPort
    params:
      - actor: ActorId
      - clientRequestId: RequestId
  - name: payloadMatchesOriginal
    ownerPort: TransferSubmitPort
    params:
      - actor: ActorId
      - clientRequestId: RequestId
      - amount: Money

aggregates:
  - name: WalletLedger
    aliases: [ledger, state, walletledger]
    stateFields:
      - availableAmount: AmountDecimal = "0.00"
      - reservedTotal: AmountDecimal = "0.00"
      - singleCap: AmountDecimal = "50000.00"
      - reservedByTx: Map[TxId, AmountDecimal] = []
      - name: status
        type: String
        default: "active"
        enum: ["active", "frozen"]
    commands:
      - name: ReserveFunds
        parameters:
          - txId: TxId
          - amount: AmountDecimal
        produces: [FundsReserved]
    events:
      - name: FundsReserved
        fields:
          - txId: TxId
          - amount: AmountDecimal
    ruleRefs:
      NON_POSITIVE_AMOUNT: "amount must be strictly positive"
      EXCEEDS_SINGLE_CAP: "amount must not exceed singleCap"
      INSUFFICIENT_FUNDS: "availableAmount must cover amount"
      TX_ALREADY_RESERVED: "txId must not be reserved twice"
      LEDGER_FROZEN: "frozen ledger rejects reservations"

stories:
  - name: WalletTransfer
    pins: [TransferOriginal]
    responses: [TransferAck]
    views: [wallet-order-view]
    callerContract:
      idempotencyKey: "(actor, clientRequestId)"
      retryPolicy: "at-least-once safe; identical replay must never re-dispatch"
      forbiddenUntrustedFields: ["internalAccountId", "operationId"]
```

---

## 3. `truth/<context>/bindings/<context>-effects.yaml` Schema

Required top-level fields (`schema/effect-binding-v2.schema.json`):

| Key | Type | Allowed Values |
| :--- | :--- | :--- |
| `schemaVersion` | `string` | MUST be `"co-arising.effect-binding/v2"` |
| `system` | `string` | Matches `structures/<context>.yaml` `system` |
| `context` | `string` | Matches `structures/<context>.yaml` `context` |
| `architectureStyle` | `enum` | `"cqrs-es-three-phase-effect"` \| `"outbox-event-driven"` \| `"workflow-orchestrated"` |
| `forbiddenImports` | `array` (optional) | Objects `{ id, scopePrefix, forbidPattern, reason }` |
| `effects` | `array` (`minItems: 1`) | Objects `{ name, protocol, idempotencyKey, timeoutMs, maxRetries, compensationRequiresAbsenceProof, crashRecoveryZeroNewAuth?, earsContractRef? }` |

Allowed `protocol` values (supported by `run-tck-v2`):
- `three-phase-reconcile` (external side effects that can time out with `UNKNOWN` and require explicit absence proof before compensating)
- `idempotent-pin-dispatch` / `idempotent-consumer`
- `transactional-outbox`
- `saga-compensation`
- `read-projection`

### Complete Valid `bindings/<context>-effects.yaml` Example

```yaml
schemaVersion: co-arising.effect-binding/v2
system: wallet-app
context: wallet
architectureStyle: cqrs-es-three-phase-effect

forbiddenImports:
  - id: ARCH_GENERATED_NO_HANDWRITTEN_TS
    scopePrefix: generated-scaffold/ts/
    forbidPattern: "from\\s+[\"']\\.\\./\\.\\./handwritten/"
    reason: generated scaffolds must never import concrete handwritten files

effects:
  - name: WalletTransferEffect
    protocol: idempotent-pin-dispatch
    idempotencyKey: "(actor, clientRequestId)"
    timeoutMs: 3000
    maxRetries: 3
    compensationRequiresAbsenceProof: false
    crashRecoveryZeroNewAuth: true
    earsContractRef: WalletTransfer
```
