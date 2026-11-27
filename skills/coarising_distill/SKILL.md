---
name: coarising-distill
description: >-
  Distill an unstructured PRD, RFC, or requirements document into an orthogonal
  co-arising 2.0 truth source covering all 13 EventStorming/DDD stages
  (subdomain + domain-map.yaml + eventFlow/hotspots + structures/*.yaml +
  behaviors/{domain,application}/*.ears + bindings/*-{effects,readside,testing}.yaml),
  converging via Z3/SMT & multi-subdomain SQLite lineage and emitting read-only
  signoff docs + the unified offline Atlas HTML viewer (signoff/atlas.html).
---

# co-arising 2.0 Truth Distillation Skill (`PRD → Verified Truth Source`)

Use this skill whenever the user hands you a PRD, user story doc, meeting notes, or legacy specification and wants to convert it into a mathematically verified `co-arising 2.0` truth source.

## Mandatory Pre-Read (Do This BEFORE Writing Any YAML or `.ears`)

Before authoring a single line of YAML or EARS, **MUST read both bundled reference specs** inside this skill folder:

1. **`references/structures_and_bindings_schema.md`** — exact valid YAML schema for `structures/*.yaml` (`subdomain`, `subdomainType`, `roles`, `compliance`, `nominalTypes`, `exactTypes`, `valueObjects`, `aggregates` with `deadlines`/`relations`, `readModels` with `source:`/`visibleTo`/`sensitivity`, `ports` with `callerKind`/`authz`, `stories`, `useCases`, `pipelines`, `journeys`, `eventFlow` with `timelines`/`hotspots`, `sagas`, `externContracts`, `waiveLineage`), `domain-map.yaml`, and `bindings/*-{effects,readside,testing}.yaml`.
2. **`references/ears_v2_grammar.md`** — exact EARS v2 grammar for `behaviors/domain/*.ears` (`slice`), `behaviors/application/*.{story,integration}.ears` (`story ... layer application`), `WHEN event`, `post:` folds, expressions, and diagnostic error codes.
3. Also inspect any existing starter files already in the workspace under `truth/<context>/` (created by `truthsrc init-v2`) to align naming and paths.

> Do NOT guess YAML keys or invent EARS syntax from memory. Everything accepted by the compiler is documented in `references/structures_and_bindings_schema.md` and `references/ears_v2_grammar.md`.

## Hard Rules (Non-Negotiable)

1. **Orthogonal separation**: Static nouns, narrative topology (`journeys`, `useCases`, `stories`), logical read models, and authz PEP contracts go ONLY in `structures/*.yaml`. NEVER put `@guard`, `guardExpr`, or behavioral rules in YAML. Physical storage/materialization choices (`shared-materialized-view`, `dedicated-table`) and side-effect protocols go ONLY in `bindings/*.yaml`.
2. **Closed vocabularies**: Every status string, currency/unit, role, and external predicate MUST be explicitly declared (`enum:`, `units:`, `roles:`, `externContracts:`) so compiler boundary gates catch typos.
3. **Write Model vs. Read Model discipline**:
   - **Write Model (`aggregates`)**: every numeric/exact event field MUST be consumed by a `post:` fold, an event-triggered story, or a readModel `eventField:` — OR explicitly waived with a typed `waiveLineage` (`routing-id`, `redundant-param:<p>`, `saga-trigger`, `audit-only`). Unwaived unconsumed numeric fields fail compilation (`V2_LINEAGE_UNCONSUMED_NUMERIC_FIELD`).
   - **Read Model (`readModels`)**: logical query views in Problem Space. Every field MUST declare a machine-checkable `source:` (`stateField:<Agg>.<f>`, `eventField:<Ev>.<f>`, `aggregateIdentity`, or `derived:<reason>`) — NEVER free-form prose!
   - **Naming Disambiguation**: CQRS event projections are called **`readModels`** (logical) and **`materializedViews`** (physical, in `bindings/*-readside.yaml`). Human-readable PM signoff documents go under **`signoff/`** (`--out-signoff signoff`), NEVER conflated with CQRS read projections.
4. **Authz PEP boundary (Problem Space) vs. PDP engine (Solution Space)**:
   - Every inbound `Port.operation` MUST declare its `callerKind` (`human | system | scheduler | webhook | anonymous`) and `authz` PEP contract (`mode: auth-core | static-roles | external-pdp | public | internal-only`).
   - Do NOT hardcode dynamic org-tree/Workday multi-rule policies in YAML; use `mode: external-pdp` with `policyRef` and typed `contextParams` so the compiler verifies all required attributes reach the external `AuthorizationPort`.
   - Internal/scheduler/event-driven surfaces (`callerKind: system | scheduler` or `mode: internal-only`) are never exposed as public HTTP routes.
5. **Directory-to-Layer discipline**:
   - `behaviors/domain/*.ears` — `slice <Aggregate>.<Command>` (pure domain invariants, arithmetic, state transitions, `post:` folds).
   - `behaviors/application/*.story.ears` — `story <Name> layer application` (inbound workflows: `pin`, `dispatch`, `respond`, `expose`).
   - `behaviors/application/*.integration.ears` — `story <Name> layer application` (external integration policies & `WHEN event` choreography).
   - `bindings/*-effects.yaml` — solution-space S1 effect protocols & `forbiddenImports`.
   - `bindings/*-readside.yaml` — solution-space physical materialized view bindings (supports N logical `readModels` sharing 1 physical materialized view, with `refreshMode: stream | batch | hybrid`).
   - `bindings/*-testing.yaml` — solution-space layered test harnesses (`pure-unit`, `constructor-di`, `akka-testkit`, `mockito`, `play-test`, `effect-tck`), coverage thresholds, and `parallelTdd.workspaceMode: share`.
6. **Never guess away ambiguity**: Whenever `compile-v2` / `v2_compile` returns Z3 **A/B Clarification Cards** (`gap`, `conflict`, `invariant`, `dead-rule`), ALWAYS present the A/B options in plain business language to the user and wait for their adjudication before editing `.ears`.
7. **Positive-affirmative predicate naming**: In `where:`, name predicates positively (`validAmount`, `withinCap`) and negate at use sites (`not validAmount`).
8. **Speak PM / User Language — NEVER expose DDD/compiler jargon to PMs or business users**:
   - When interviewing a user or PM to clarify missing requirements, NEVER ask *"what is this ReadModel's sourceAggregate?"*, *"do we need stream-batch unification?"*, *"what are your external PDP contextParams?"*, or *"should we split the Aggregate?"*.
   - Translate every architectural question into concrete **user-perspective / business scenarios** (see the **PM-Language PRD Interrogation Radar** below), then silently encode their answers into orthogonal YAML/EARS behind the scenes.

## Mandatory Architecture-Shaping & Industry Compliance Discovery (Run FIRST in Phase 0!)

Before authoring YAML or EARS, proactively identify **the product's industry, operating region(s), and high-impact mandatory drivers** — things that, if missed early, force costly architecture rewrites later. Always ask in **plain PM / business language**, propose concrete industry-standard defaults/options, and explicitly flag statutory items for legal/compliance counsel confirmation:

1. **Industry & Jurisdiction Regulatory Scan (主动识别行业并做合规探索/建议/对齐)**:
   - Detect industry + regions (e.g., China / EU / US / Global × Finance/Wealth, Education/Certification, Media/Short-Drama, Healthcare, HR/Enterprise, E-commerce).
   - Surface the mandatory regulatory duties typical for that industry & region and align with the user/PM:
     - **Personal Data & Privacy (PIPL 个保法 / GDPR / CCPA)**: informed consent & purpose limitation (*告知同意 + 最小必要采集*), sensitive PII handling (ID card, phone, biometrics/face, financial account, minors), encryption & masked display.
     - **CRITICAL for Event Sourcing — Deletion / Account Cancellation vs. Immutable Audit Log**: Ask plainly: *「如果用户以后注销账号、撤回同意、或者超过法定留存年限，系统要不要支持把个人敏感信息彻底删除或匿名化？」* If YES, **NEVER store raw PII directly inside immutable domain events** — record `compliance.erasureRequired: true` + `piiStrategy: pii-vault` (or `crypto-shredding`) in `structures/*.yaml` and store `sensitivity: tokenized-pii` references (`piiTokenRef`) instead of raw `sensitivity: pii` (enforced by compiler gate `V2_COMPLIANCE_RAW_PII_IN_IMMUTABLE_EVENT`)!
     - **Persist every agreed regulatory alignment** in `structures/*.yaml` → top-level `compliance:` (`industry`, `jurisdictions`, `dataResidency`, `erasureRequired`, `piiStrategy`, `retentionPolicy`, `obligations` with `legalSignoff: pending-counsel | approved`) so it flows into `canonical-v2.json` and `signoff/lineage.md` for legal/counsel review!
     - **Data Residency & Cross-Border Transfer (数据本地化/出境)**: If overseas and domestic users coexist, ask: *「海外用户和国内用户的个人数据能不能存在同一套库里，还是必须按地区物理隔离？」*
     - **Industry Statutory Rules**:
       - *Media / Certification / Licensing*: real-name KYC, version-pinned regulation/exam archives, tamper-proof audit trail, revocation & downstream platform admission sync.
       - *Finance / Payments / Wealth*: exact fixed-point conservation, anti-money laundering / maker-checker, statutory 5–10 yr retention, never blindly compensate on `UNKNOWN`.
       - *Healthcare*: clinical audit trail, patient consent revocation, break-glass access logs.
       - *HR / Enterprise*: org-hierarchy dynamic RBAC (`external-pdp`), separation of duties, statutory retention.
2. **High-Impact Architectural Drivers (问错就要推倒重来的强制因素)**:
   - **Data Sovereignty & PII Lifecycle** (audit retention vs right-to-erasure → PII tokenization vs raw fields).
   - **Irreversible Money / External Side Effects** (`three-phase-reconcile`, never auto-retry/refund on `UNKNOWN`).
   - **Concurrency & Scale Bottlenecks** (hot-aggregate 1-vs-N split, seat/inventory oversell guard, bounded chunked batch fan-out).
   - **Multi-Tenant / Org Hierarchy Isolation** (`rowScope`, `external-pdp` org-unit scoping).
   - **Legal Evidence & Non-Repudiation** (version pinning of policies/contracts/exam papers, append-only audit events).

## PM-Language PRD Interrogation Radar (What PRDs Almost Always Omit!)

Before locking Phase 1, silently scan the PRD against these **8 blind-spot & universal compliance dimensions**. For any item missing from the PRD that applies to the product, ask the user/PM in **plain business language** (group into a concise numbered checklist, never spam jargon):

| Blind Spot / Compliance Dimension | Ask the PM / User in Plain Language | Where You Encode the Answer |
| :--- | :--- | :--- |
| **1. Batch vs. Individual & Partial Failure** | 「一个批次里涉及多个人/多笔单时，他们是各自独立推进和重试，还是整批绑定？如果群发/批量处理时 500 条里有 2 条失败、1 条超时未知，要不要能只单独补发那几条？」 | Split `ExamBatch` vs `ExamAttempt` aggregates; `pipelines.admission`; `failed`/`unknown` events |
| **2. Deadlines, Timezones & Auto-Triggers** | 「有哪些事不是人点按钮，而是到点自动发生（如截止自动关闭、考前 1 小时提醒、过期自动释放名额）？提前撤回或改期时，待发提醒要不要取消？海外/跨时区怎么统一口径？」 | `roles` (`kind: scheduler`); `aggregates.deadlines`; UTC epoch ms; version-bumped idempotency keys |
| **3. Policy / Version Snapshot Freeze** | 「规则、费率、考卷或及格线以后改版时，已经发布/成交的旧批次是按『当时发布那一刻的老标准』留档，还是跟着新标准变？」 | Immutable version/snapshot fields on aggregate/event (`regulationVersion`, `passingScore`) |
| **4. Screen Data Provenance** | 「页面/列表/报表上展示的每一列数字和状态，分别是系统里哪一步操作或哪张回执产生的？（若某个数字找不到源头，说明上游漏采集了）」 | `readModels[*].fields[*].source` (`stateField:` / `eventField:` / `aggregateIdentity` / `derived:`) |
| **5. Real-Time vs. Cut-off Batch Cadence** | 「哪些结果需要用户操作完秒级立刻看到，哪些是集中批量跑的（如批量导入、关窗统一出分、T+1 对账上报）？」 | `bindings/*-readside.yaml` (`refreshMode: stream \| batch \| hybrid`); `pipelines` |
| **6. Privacy, Anti-Leak & Role Visibility (Compliance)** | 「哪些信息属于个人隐私（身份证号/手机号/邮箱）或机密（标准答案/评委评语/底价）？哪些页面在特定时间点（如出分公示前）或公开查询口绝不能透出这些字段？」 | `readModels.visibleTo`, `rowScope`, `fields[*].sensitivity` (`public \| internal \| pii \| secret`) |
| **7. Authorization, Conflict of Interest & Org Isolation (Compliance)** | 「按钮是固定角色就能点，还是按机构/部门归属或动态规则判断（如 MCN 管理员只能看本机构人员）？有没有『自己不能审自己的单 / 双盲评审 / 超额需复核』的硬规矩？」 | `ports.operations.authz` (`auth-core` / `external-pdp` + `contextParams`); maker-checker rules in `.ears` |
| **8. Audit Trail, External `UNKNOWN` & Post-Facto Revocation (Compliance)** | 「监管抽查时需要追溯哪些操作留痕？外部系统超时没返回结果时是先标『待核实』还是直接重试？事后查出作弊/误发时，证书或结果能不能吊销/冲正（保留痕迹不物理删除）？」 | Append-only audit events (`waiveLineage: audit-only`); `three-phase-reconcile`; `Revoke*` commands |

## Procedure (5-Phase 13/13 Event-Modeling Distillation Funnel: Diverge First, Then Converge)

### Phase 0 — Big-Picture Divergence: Subdomains, EventFlow + Hotspots, Journeys & Compliance (Stages #01, #04, #05, #11, #12)
1. **Do NOT jump straight into single-aggregate fields/EARS!** First map the whole problem space from the PRD:
   - **Subdomains & Context Mapping (#04, #05)**: Identify stable Problem-Space `subdomain`s (`subdomainType: core | supporting | generic`). If the PRD spans multiple subdomains (e.g., `exam` + `certification` + `filing`), sketch `domain-map.yaml` (`co-arising.domain-map/v2`) with cross-subdomain ACL `integrations` and Solution-Space `boundedContexts` (can start as 1 monolith BC and split later with zero subdomain truth edits).
   - **Big-Picture EventFlow & Hotspots (#01)**: Sketch `eventFlow.timelines` (chronological stages + `(sequence, step)` + `pivotal: true` milestones). **CRITICAL — Never silently assume away PRD contradictions or gray areas**: record every unresolved product/legal/business question as an explicit entry in `eventFlow.hotspots` (`status: open`, `blocking: true` for architecture-shaping questions so the compiler blocks until the PM arbitrates and records `status: resolved` + `resolution`!).
   - **Actors, Stories, Use Cases & Journeys (#02, #11, #12)**:
     - `roles:` (human + `system | scheduler | webhook | ai-agent`)
     - `stories:` (`role`, `goal`, `soThat`, `release`, `coversUseCases`)
     - `useCases:` (ordered causal `steps`, `prdRefs`, `readEvidence`, `extensions`)
     - `journeys:` (backbone `stages` with `channel`, `emotionScore` 1–5, `painPoints`, `stories`, `useCases`, `screens`)
   - **Compliance Contract**: Persist agreed regulatory obligations in top-level `compliance:`.
2. Present any blocking `hotspots` and Phase 0 PM-language radar questions to the user/PM in plain business language before locking Phase 1.

### Phase 1 — Orthogonal Write Model, Aggregate Relations, Read Model & Authz PEP Contracts (Stages #02, #03, #06, #07, #08, #09, #13)
1. **Write Model (`exactTypes`, `nominalTypes`, `aggregates`, `sagas`, `pipelines`)**:
   - Declare fixed-point `exactTypes` (never float), aggregates with `stateFields` (using `waiveLineage: immutable-config` for seed-only config fields), `commands` (`parameters`, `produces`), `events` (explicit `fields`, `sensitivity`, optional `source: cmd.<p> | state.<s> | const:<v>`, and typed `waiveLineage`), `deadlines`, **explicit `relations:` (`target`, `cardinality: 1:1|1:N|N:1|N:M`, `meaning` — Stage #07)**, and `ruleRefs`.
   - Ensure every aggregate event is placed in `eventFlow.timelines` (zero `V2_EVENTFLOW_UNPLACED_EVENT` warnings).
2. **Read Model (`readModels` — Logical Problem Space, Stage #13)**:
   - For every view referenced in `useCases.readEvidence`, `steps.readsView`, `steps.updatesViews`, or `expose`: declare `sourceAggregate`, `sourceEvents`, `visibleTo`, `rowScope`, and per-field machine-checkable `source:` + `sensitivity`.
   - Prefer `stateField:` when the aggregate already folds that field into state (avoid write-only dead state fields!).
3. **Inbound Surfaces & Authz PEP (`ports`, `valueObjects`, `externContracts`)**:
   - Declare every inbound `Port.operation` with `callerKind` and `authz` (`auth-core` / `static-roles` / `external-pdp` / `public` / `internal-only`).
   - Declare every external predicate in `externContracts` with exact `params` and `ownerPort`.
4. Write `truth/<subdomain>/structures/<subdomain>.yaml` (or split into `structures/*.yaml` + `structures/use-cases.yaml`).

### Phase 2 — Layered Behavior Authoring & Solution-Space Bindings
1. For each domain command in `useCases`, author `behaviors/domain/<agg>-<cmd>.ears` (invariants, DMN First-Hit rules, `SHALL emit`, and `post:` event folds covering all state mutations).
2. For each inbound user workflow, author `behaviors/application/<name>.story.ears` (`auth`, idempotency `pin`, `dispatch`, `respond`/`expose`, `ALWAYS ... SHALL NOT supply`).
3. For external callbacks/settlement/async choreography, author `behaviors/application/<name>.integration.ears` and declare S1 effect protocols in `bindings/<context>-effects.yaml`.
4. If multiple logical `readModels` share a physical materialized view, require SQL indexes, or mix real-time (`stream`) and cut-off (`batch`/`hybrid`) refresh cadences, declare `bindings/<context>-readside.yaml` (`co-arising.readside-binding/v2`).
5. Declare layered test harnesses (Pure DI / Mockito / Akka TestKit / Play Test / Effect TCK), behavioral coverage thresholds, and parallel TDD worktree isolation (`workspaceMode: share`) in `bindings/<context>-testing.yaml` (`co-arising.testing-binding/v2`).

### Phase 3 — Full-Chain Compiler & Z3 Hard-Gate Convergence Loop
1. Run `v2_compile` (via `truthsrc mcp`) or CLI with `--strict-lineage` and `--out-signoff`:
   ```bash
   truthsrc compile-v2 \
     --structures truth/<context>/structures \
     --behaviors truth/<context>/behaviors \
     --bindings truth/<context>/bindings \
     --out .truthsrc/canonical-v2.json \
     --db .truthsrc/knowledge.sqlite \
     --out-signoff signoff \
     --strict-lineage \
     --lang zh \
     --format human
   ```
2. Fix deterministic syntax/binding/lineage/authz/readside errors (`EARS_*`, `V2_*`) directly using the reported `file:line:col` caret snippet.
3. For any **Z3 Clarification Card** (`V2_SMT_GATE_FAILED`):
   - Translate the Z3 counterexample and Option A / Option B into plain domain language.
   - Ask the user to pick Option A, Option B, or a custom business rule.
   - Apply their decision to `.ears` and re-run `compile-v2` until `[PASS]`.
4. For **multi-subdomain systems** (`domain-map.yaml`), also run the recursive SQLite cross-subdomain lineage & PII taint gate and export the system-wide Atlas:
   ```bash
   truthsrc audit-system-lineage-v2 --canonicals a.json,b.json --domain-map truth/domain-map.yaml --out-md signoff/system-lineage.md --strict-lineage
   truthsrc atlas-v2 --canonicals a.json,b.json --domain-map truth/domain-map.yaml --out signoff/system-atlas.html --out-dir signoff
   ```

### Phase 3.5 — Context Mapping & Bounded Context Packaging Decision Gate (Mandatory BEFORE Code Generation!)
> **NEVER jump straight from Subdomain truth to `truthsrc generate-v2` without confirming how Subdomains map to deployable Bounded Contexts (services) and cross-BC integration patterns!**

1. **Always present a plain-language Deployment & Integration Proposal to the user/architect** (do NOT expose raw DDD jargon — translate into team ownership, deployment cadence, and failure-isolation trade-offs):
   - **Packaging Choice (`boundedContexts`)**: Given the distilled subdomains (e.g. `exam`, `certification`, `filing`), propose concrete options:
     - **Option A (Fastest / Default for MVP, Pilot & Small Teams — All-in-One Monolith / 「大泥球」单服务合包策略)**: Package ALL subdomains into **1 single deployable Play/sbt service** (`--packaging monolith --bc <app-name> --canonicals a.json,b.json,...`), sharing one `ApplicationBootstrap` / `BootstrapModule` / `conf/routes` / `build.sbt` with zero cross-service RPC/ACL overhead. Because problem-space subdomain truth stays cleanly separated in `truth/<subdomain>/`, you can split into multiple BCs later with ZERO business-truth rewrites!
     - **Option B (Modular Multi-BC Split — For Multi-Team / Independent Scaling)**: Split high-churn or independently scaled subdomains into separate Bounded Context services in `truth/domain-map.yaml` (each gets its own `ApplicationBootstrap`, `conf/routes`, `build.sbt`, and database schema, with automatic `#46 ExternalEventBridge` across BC boundaries).
   - **Cross-BC Context Mapping Pattern (`integrations[*].pattern`, only needed for Option B)**: For every event/API crossing two different Bounded Contexts, confirm the integration contract (`ACL` default, `OHS/PL`, `Conformist`, or `Shared Kernel`).
2. **Persist the approved decision into `truth/domain-map.yaml`** (for Option B) or proceed directly with `--packaging monolith` (for Option A).
3. **Generate per Bounded Context** (never blindly 1-service-per-subdomain without asking!):
   - **Option A — All-in-One Monolith / 大泥球合包（无需写复杂跨服务 ACL，自动导出合并后的 `.truthsrc/bc-<app>-canonical-v2.json` 供 `emit-tests-v2` 与 `verify-v2` 直接使用）**:
     ```bash
     truthsrc generate-v2 --generator scala-cqrs-play-service-v2 --packaging monolith --bc <appName> --canonicals a.json,b.json,... --out . --package <pkg>
     truthsrc emit-tests-v2 --target scala-cqrs-play-service-v2 --in .truthsrc/bc-<appName>-canonical-v2.json --out . --package <pkg>
     ```
   - **Option B — Multi-BC Split via `domain-map.yaml`**:
     ```bash
     truthsrc generate-v2 --generator scala-cqrs-play-service-v2 --domain-map truth/domain-map.yaml --bc <bcName> --canonicals a.json,b.json --out services/<bcName> --package <pkg>
     ```
   - **Single-subdomain project**:
     ```bash
     truthsrc generate-v2 --generator scala-cqrs-play-service-v2 --in .truthsrc/canonical-v2.json --out . --package <pkg>
     ```

### Phase 4 — Business Signoff & Handoff to Implementation
1. Present the generated read-only signoff pack for PM / Architecture / Legal approval:
   - `signoff/atlas.html` (Unified offline interactive Atlas viewer: 6 Problem-Space diagrams incl. Brandolini Event Matrix, 2D Story Map + CSV, Sequence SVG, Domain Model + Relations, Field Lineage + PII, ContextMapper `.cml` + 5 Solution-Space diagrams)
   - `signoff/event-matrix.md`, `signoff/use-cases.md`, `signoff/lineage.md` (incl. Compliance & Legal Signoff), `signoff/story-map.csv`, `signoff/domain-map.cml`
   - `signoff/ac/*.md` (PM-friendly Style E AC) & `signoff/tables/*.md` (DMN decision tables)
2. Emit Onion 5-layer code (`domain / application / interfaces / infrastructure / modules`) + `@cloze` skeletons, locked BDD/HTTP oracles, and the derived task queue:
   ```bash
   truthsrc generate-v2 --in .truthsrc/canonical-v2.json --out . --target typescript,scala --package <pkg> --with-scaffold
   truthsrc emit-tests-v2 --in .truthsrc/canonical-v2.json --out . --target typescript,scala --package <pkg>
   truthsrc tasks-v2 --root . --format human
   ```
3. Hand off derived Channel 4B `@cloze` slots to `coarising-cloze-worker` (or `workflows/coarising_cloze_pipeline.py`).
4. Once verified, export the offline visual workbench:
   ```bash
   truthsrc view-v2 --root . --out workshop.html
   ```
