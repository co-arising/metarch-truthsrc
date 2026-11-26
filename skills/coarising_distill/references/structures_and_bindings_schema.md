# co-arising 2.0 YAML Schema Reference (`structures/*.yaml` & `bindings/*.yaml`)

> Self-contained schema reference bundled with `coarising-distill` (derived directly from `lib/v2/structure-loader.mjs`, `lib/v2/lineage.mjs`, `lib/v2/readside-binding.mjs`, `lib/v2/coverage-audit.mjs`, and `schema/effect-binding-v2.schema.json`). Read this completely BEFORE authoring any YAML file.

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
| `subdomain` | `string` | recommended | Problem-Space Subdomain identifier (stable across service splits/merges; preferred over `context`) |
| `subdomainType` | `string` | optional | Problem-Space Subdomain classification: `core` \| `supporting` \| `generic` |
| `context` | `string` | alias | Backward-compatible alias for `subdomain` (defaults to `subdomain` when omitted) |
| `nominalTypes` | `array` | optional | Closed list of nominal ID types; when present, unregistered PascalCase IDs fail with `V2_UNKNOWN_TYPE` |
| `roles` | `array` | optional | Declared human and non-human actors/callers (`kind: human \| system \| scheduler \| webhook \| ai-agent`) |
| `compliance` | `object` | optional | Industry/jurisdiction privacy & regulatory contract (`industry`, `jurisdictions`, `dataResidency`, `erasureRequired`, `piiStrategy`, `retentionPolicy`, `obligations`) |
| `exactTypes` | `array` | optional | Fixed-point decimal and unit-decimal (money) types (no floating point) |
| `valueObjects` | `array` | optional | Structured DTOs / responses (`respond <VO>`) |
| `aggregates` | `array` | yes | Write-model domain aggregates with `stateFields`, `commands`, `events`, `ruleRefs` |
| `sagas` | `array` | optional | Multi-aggregate sagas (`triggers`, `invokes`/`dispatches`, `stateFields`) |
| `pipelines` | `array` | optional | Durable execution pipelines orchestrating sagas/commands (`kind: pipeline` also supported as standalone file) |
| `readModels` | `array` | optional | **Logical** query views (CQRS Read Model) with `sourceAggregate`, `sourceEvents`, and per-field `source:` |
| `ports` | `array` | optional | Inbound application ports (`WHEN <Port>.<op>`) with `callerKind` and `authz` PEP contracts |
| `externContracts` | `array` | optional | Declared external host predicates (`extern fn(a, b)`) with exact `params` and `ownerPort` |
| `stories` | `array` | optional | Application stories + User Story narrative (`role`, `goal`, `soThat`, `release`, `coversUseCases`, `pins`, `responses`, `views`, `callerContract`) |
| `useCases` | `array` | optional | End-to-end causal business flows (`actor`, `beneficiary`, `intent`, `prdRefs`, `readEvidence`, `steps`, `extensions`; `kind: use-cases` also supported) |
| `journeys` | `array` | optional | Story-Mapping journeys (`persona`, `goal`, `release`, `stages: [{ name, stories, useCases, screens }]`) |

### 2.2 Supported Type Expressions (`parseTypeExpr`)

| Syntax | Meaning |
| :--- | :--- |
| `Int` / `Integer` / `Long` | 64-bit integer (never use `int`, `long`, `Lng`, `Float`, `Double`) |
| `Bool` / `Boolean` | Boolean |
| `String` | Unbounded string (or closed string when `enum: [...]` is specified) |
| `Decimal` / `Decimal(N)` | Fixed-point decimal with scale `2` or `N` |
| `<ExactTypeName>` | Reference to an entry in `exactTypes` (e.g. `AmountDecimal`, `Money`) |
| `<ValueObjectName>` | Reference to an entry in `valueObjects` |
| `Map[KeyType, ValueType]` | Total map / ledger (e.g. `Map[AccountId, AmountDecimal]`) |
| `Optional[ElemType]` | Nullable / optional value (`x is some`, `x is none`; never use `Option[T]`) |
| `Seq[ElemType]` | Ordered sequence (`forall`, `exists`, `count`, `len`, `sum`; never use `List[T]`/`Array[T]`) |
| `<NominalId>` (e.g. `AccountId`, `OrderId`) | Nominal PascalCase string identifier |

### 2.3 Field Declaration Forms & Lineage Attributes

Three forms are accepted by `parseFieldSpec`:

1. **Concise mapping shorthand**: `- qty: QtyDecimal`, `- usedQty: QtyDecimal = "0.00"`, `- reservedByTx: Map[TxId, AmountDecimal] = []`
2. **String shorthand**: `- "maxSingleLimit: AmountDecimal = \"50000.00\""`
3. **Explicit object form** (REQUIRED when declaring `enum:`, `source:`, or `waiveLineage:`):
   ```yaml
   - name: paymentOutcome
     type: String
     default: "pending"
     enum: ["pending", "succeeded", "failed"]
     source: cmd.outcome              # Event field only: cmd.<p> | state.<s> | const:<v> | derived | context
     waiveLineage: audit-only         # Optional typed lineage waiver
   ```

#### Machine-Checkable `source:` Formats
- **On `events[*].fields[*]`**: `cmd.<paramName>`, `state.<stateField>`, `const:<literal>`, `derived`, `context`
- **On `readModels[*].fields[*]`**:
  - `stateField:<Agg>.<field>` (or `stateField:<field>` when `sourceAggregate` is set on the readModel)
  - `eventField:<Agg>.<Event>.<field>` (or `eventField:<Event>.<field>` when `sourceAggregate` is set)
  - `aggregateIdentity`
  - `derived` or `derived:<reason>`
  - NEVER write free prose like `"Documentation only: ..."`; the compiler fails with `V2_READMODEL_INVALID_SOURCE`.

#### ReadModel Visibility, Sensitivity & Deadlines (Compliance & Temporal Guards)
- **On `readModels[*]`**:
  - `visibleTo: [Role1, Role2]` — restricts which roles may query this view (compiler checks membership against `roles` and blocks ports whose `allowedRoles` exceed `visibleTo` with `V2_READMODEL_VISIBILITY_MISMATCH`).
  - `rowScope: "self" | "org" | "tenant" | "global"` — documents row-level isolation scope.
  - `fields[*].sensitivity`: `public` | `internal` | `pii` | `secret` — any `public`/`anonymous` port returning a ReadModel containing `pii` or `secret` fields fails compilation with **`V2_READMODEL_SENSITIVE_PUBLIC_EXPOSURE`**!
- **On `aggregates[*].deadlines`** (links state deadline fields to scheduled commands):
  ```yaml
  deadlines:
    - name: autoCloseExam
      stateField: examEndAtMs
      triggerCommand: AutoCloseBatch
      graceWindow: "30s"
  ```
- **On `pipelines[*].admission`** (bounded batch fan-out): `admission: { maxItemsPerChunk: 50, maxInFlightChunks: 4 }`.
- **Top-level `compliance:`** (persists Phase 0 regulatory alignment & enforces `V2_COMPLIANCE_RAW_PII_IN_IMMUTABLE_EVENT` when `erasureRequired: true` and `piiStrategy != statutory-retention`):
  ```yaml
  compliance:
    industry: media-certification
    jurisdictions: [CN-PIPL, CN-NRTA]
    dataResidency: cn-mainland            # cn-mainland | eu-only | us-only | region-isolated | global
    erasureRequired: true
    piiStrategy: pii-vault                # pii-vault | crypto-shredding | statutory-retention
    retentionPolicy: "5y-statutory"
    obligations:
      - id: COMP-01
        regulation: "CN-PIPL §47"
        summary: "Personal identifiers must be erasable via PiiVault token without mutating event log"
        mappedTo: [ExamCert.Revoke, public-cert-view]
        legalSignoff: pending-counsel     # pending-counsel | approved | waived
  ```
  - Event/state fields may carry `sensitivity: public | internal | pii | secret | tokenized-pii`. Raw `sensitivity: pii` on immutable domain events is blocked when `erasureRequired: true` unless `piiStrategy: statutory-retention`.

#### Machine-Checkable `waiveLineage:` Reasons
- **On `events[*]` or `events[*].fields[*]`** (unconsumed numeric event fields FAIL compilation by default unless consumed or waived!):
  - `routing-id` | `redundant-param` | `redundant-param:<cmdParam>` | `saga-trigger` | `audit-only` | `notification-only`
- **On `aggregates[*].stateFields[*]`**:
  - `immutable-config` | `seed-only` (waives `V2_LINEAGE_UNWRITTEN_STATE_FIELD`, e.g. `singleCap`)
  - `audit-log` | `external-read` (waives `V2_LINEAGE_WRITE_ONLY_STATE_FIELD`)
- **On `readModels[*].fields[*]`**:
  - `derived` | `computed-at-query` | `external-enrichment`

### 2.4 Authz PEP Contracts (`roles` & `ports[*].operations[*].authz`)

Truth declares the **PEP (Policy Enforcement Point) contract** — leaving dynamic policy evaluation to `auth-core` or an external PDP (`AuthorizationPort`) in Solution Space:

```yaml
roles:
  - name: Customer
    kind: human            # human | system | scheduler | webhook | ai-agent
    scope: tenant
  - name: SettlementCron
    kind: scheduler
  - name: TaWebhook
    kind: webhook

ports:
  - name: TransferSubmitPort
    operations:
      - name: submit
        callerKind: human  # human | system | scheduler | webhook | anonymous
        authz:
          mode: auth-core  # auth-core | static-roles | external-pdp | public | internal-only
          scope: tenant    # global | tenant | workgroup | project | workshop | org | custom
          action: "wallet:transfer:submit"
          allowedRoles: [Customer]
        parameters:
          - actor: ActorId
          - clientRequestId: RequestId
          - amount: Money
        returns: TransferAck

  - name: ExpenseApprovalPort
    operations:
      - name: approve
        callerKind: human
        authz:
          mode: external-pdp                 # Workday Org-Role / OPA / OpenFGA dynamic PDP
          policyRef: "org-rbac.approve-expense"
          action: "expense:approve"
          contextParams:                     # param.<p> checked against operation parameters!
            - orgUnitId: param.orgUnitId
            - amount: param.amount
            - tenantId: token.tenantId
        parameters:
          - actor: ActorId
          - orgUnitId: OrgUnitId
          - amount: Money
        returns: ApprovalAck
```

> Operations with `callerKind: system | scheduler` or `authz.mode: internal-only` (and pure `WHEN event` integration stories) are **never exposed as public HTTP routes**.

### 2.5 Complete Valid `structures/<context>.yaml` Example

```yaml
system: wallet-app
context: wallet

roles:
  - name: Customer
    kind: human
    scope: tenant

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

aggregates:
  - name: WalletLedger
    aliases: [ledger, state, walletledger]
    stateFields:
      - availableAmount: AmountDecimal = "0.00"
      - reservedTotal: AmountDecimal = "0.00"
      - name: singleCap
        type: AmountDecimal
        default: "50000.00"
        waiveLineage: immutable-config
      - reservedByTx: Map[TxId, AmountDecimal] = []
      - name: status
        type: String
        default: "active"
        enum: ["active", "frozen"]
        waiveLineage: immutable-config
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

readModels:
  - name: wallet-order-view
    sourceAggregate: WalletLedger
    sourceEvents: [FundsReserved]
    fields:
      - name: availableAmount
        type: AmountDecimal
        source: stateField:availableAmount
      - name: reservedTotal
        type: AmountDecimal
        source: stateField:reservedTotal
      - name: status
        type: String
        enum: ["active", "frozen"]
        source: stateField:status

ports:
  - name: TransferSubmitPort
    operations:
      - name: submit
        callerKind: human
        authz:
          mode: auth-core
          scope: tenant
          action: "wallet:transfer:submit"
          allowedRoles: [Customer]
        parameters:
          - actor: ActorId
          - clientRequestId: RequestId
          - amount: Money
        returns: TransferAck

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

stories:
  - name: WalletTransfer
    role: Customer
    goal: "Reserve funds safely with idempotent replay"
    soThat: "Retries never double-debit my wallet"
    coversUseCases: [ReserveWalletFunds]
    pins: [TransferOriginal]
    responses: [TransferAck]
    views: [wallet-order-view]
    callerContract:
      idempotencyKey: "(actor, clientRequestId)"
      retryPolicy: "at-least-once safe; identical replay must never re-dispatch"
      forbiddenUntrustedFields: ["internalAccountId", "operationId"]

useCases:
  - id: reserve-wallet-funds
    name: ReserveWalletFunds
    actor: Customer
    intent: "Submit a transfer reservation and observe updated wallet balance"
    prdRefs: ["PRD-1.1"]
    readEvidence: [wallet-order-view]
    steps:
      - id: submit-reserve
        actor: Customer
        port: TransferSubmitPort.submit
        aggregate: WalletLedger
        command: ReserveFunds
        emissions: [FundsReserved]
        updatesViews: [wallet-order-view]

journeys:
  - id: wallet-core-journey
    name: WalletCoreJourney
    persona: Customer
    goal: "Safely reserve and monitor wallet funds"
    release: R1
    stages:
      - name: SubmitTransfer
        stories: [WalletTransfer]
        useCases: [ReserveWalletFunds]
```

---

## 3. Solution-Space Bindings (`truth/<context>/bindings/*.yaml`)

### 3.1 `bindings/<context>-effects.yaml` (`co-arising.effect-binding/v2`)

Required top-level fields (`schema/effect-binding-v2.schema.json`):
`schemaVersion: co-arising.effect-binding/v2`, `system`, `context`, `architectureStyle` (`cqrs-es-three-phase-effect` | `outbox-event-driven` | `workflow-orchestrated`), `forbiddenImports` (optional), `effects` (`minItems: 1`, `protocol`: `three-phase-reconcile` | `idempotent-pin-dispatch` | `idempotent-consumer` | `transactional-outbox` | `saga-compensation` | `read-projection`).

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

### 3.2 `bindings/<context>-readside.yaml` (`co-arising.readside-binding/v2` — Physical Materialized Views)

Maps N logical `readModels` (Problem Space) onto M physical materialized views (Solution Space), allowing multiple logical read models to share a single physical table/view while the compiler verifies column-type consistency and index key coverage:

```yaml
schemaVersion: co-arising.readside-binding/v2
system: wallet-app
context: wallet

materializedViews:
  - name: mv_wallet_unified
    strategy: shared-materialized-view   # shared-materialized-view | dedicated-table | live-state-snapshot | external-search-index
    refreshMode: hybrid                  # stream (default) | batch | hybrid
    storage: jdbc-postgres
    servesReadModels:
      - wallet-order-view
      - wallet-audit-view
    indexes:
      - name: idx_wallet_status
        keys: [status]
```

### 3.3 `bindings/<context>-testing.yaml` (`co-arising.testing-binding/v2` — Layered Test Strategy & Parallel TDD Isolation)

Declares per-Onion-layer test harnesses (`pure-unit`, `constructor-di`, `akka-testkit`, `mockito`, `play-test`, `effect-tck`, `testcontainers`), behavioral coverage gates, and git-worktree isolation for parallel `@cloze` TDD workers:

```yaml
schemaVersion: co-arising.testing-binding/v2
system: wallet-app
context: wallet

layers:
  domain:
    harness: pure-unit          # pure-unit | property-based (mockito/akka-testkit FORBIDDEN in pure domain)
    minLineCoverage: 85
    minBranchCoverage: 80
    requireAllRuleHits: true
    mutationGate: true
  application:
    harness: hybrid             # constructor-di | akka-testkit | akka-persistence-testkit | mockito | hybrid
    minLineCoverage: 80
    doubles:
      - port: TransferSubmitPort
        strategy: fake-stub     # fake-stub | mockito | akka-probe | wiremock | in-memory
  interfaces:
    harness: in-process-router  # in-process-router | play-test | supertest | http-smoke
    verifyAuthzMatrix: true
  infrastructure:
    harness: effect-tck         # effect-tck | h2-in-memory | testcontainers | wiremock | real-dependency-smoke | hybrid
    requireTck: true

parallelTdd:
  workspaceMode: share          # share (git worktree isolation) | branch | inherit
  mergeStrategy: slot-patch     # slot-patch | git-merge
```

### 3.4 System-Level Multi-Subdomain Map (`domain-map.yaml`, `co-arising.domain-map/v2`)

Links stable **Problem-Space Subdomains** (`integrations`) independently of evolvable **Solution-Space Bounded Contexts** (`boundedContexts`). Audited via `truthsrc audit-system-lineage-v2`:

```yaml
schemaVersion: co-arising.domain-map/v2
system: short-drama-exam

# Solution Space: freely split/merge Bounded Contexts without touching Subdomain truth!
boundedContexts:
  - name: exam-monolith-bc
    subdomains: [exam, certification]
  - name: filing-service-bc
    subdomains: [filing]

# Problem Space: stable Subdomain -> Subdomain ACL field contracts
integrations:
  - id: exam-to-cert
    upstreamSubdomain: exam
    upstreamEvent: ExamAttempt.ExamPassed
    downstreamSubdomain: certification
    downstreamTarget: Certificate.Issue     # Command, Port.op, or ReadModel
    fieldMappings:
      - from: candidateId
        to: holderId
      - from: score
        to: examScore
```
