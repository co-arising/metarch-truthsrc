# co-arising 2.0 全域覆盖治理策略（问题空间 × 解决方案空间双闭环）

> **文档状态**：Architecture Decision & Governance Specification（v2.1）
> **适用范围**：`co-arising 2.0` 编译器（`metarch-truthsrc`）及所有受治理项目（以 `bank-wealth-demo` 为参考实现）

---

## 1. 核心命题：消除“非 EARS 解决方案空间”的验证黑洞

`co-arising 2.0` 的 EARS-Native 主干已经为**问题空间（业务规则、领域不变式、应用层安全边界）**建立了「`.ears` → Z3/BMC 硬闸门 → `Canonical Model v2` → L1 零 Token 生成 / L2-L3 锁定预言机 `@cloze` TDD」的严密闭环。

但真实生产代码库并不只有问题空间，还包含大量**EARS 不可描述、却同样需要由 AI 或人类持续迭代的解决方案空间代码**（架构风格与 Effect/Saga 副作用绑定、超时重试与崩溃恢复策略、JDBC/Journal/外部协议驱动、DI 装配、Web/UI 展示层）。

如果只对 EARS 域施加强门禁，却让非 EARS 域成为无声明、无验收的灰色地带，AI 在解决方案空间迭代时仍会引入双扣、越权、架构腐化与静默回归。因此本策略确立三条铁律：

1. **MECE 全域二分**：代码库 100% 的文件必须归入「问题空间（`D1`/`D2`）」或「解决方案空间（`S1`/`S2`/`S3`）」，**严禁出现未登记的灰色文件（0 Uncovered Files）**。
2. **各归其真源，不强塞 EARS**：问题空间用结构 YAML + `.ears`；解决方案空间用各自最契合的声明契约（`effect-binding` YAML、依赖拓扑规则、Port/Wire Schema、ADR、E2E 旅程与人工签收清单）。
3. **四级渐进毕业 + 四级诚实证据账本**：允许对复杂应用/外部协作模块先留在隔离区做影子验证（`Stage 1`），论证充分后再收缩进 `@cloze`（`Stage 2`）或完全毕业移出隔离区（`Stage 3`）；所有文件在统一的 `SQLite` 证据账本（`E1`–`E4`）中诚实记录放行依据，包括显式人工签收及其内容哈希防失效校验。

---

## 2. 全域双分支表达与验收矩阵

| 逻辑分支 | 层级 | 典型内容 | 唯一表达真源 | 强制验收机制 | 证据等级 |
| --- | --- | --- | --- | --- | --- |
| **Branch 1：问题空间（EARS 可描述）** | `D1` 领域确定性核心 | 线性状态机守卫、定点加减、Map 门限、事件溯源 `post:` 折叠、纯计算服务 | 结构 YAML + `.ears`（L1 `QF_AUFLIA`） | Z3 五项体检 + BMC 硬闸门 → 零 Token 生成 + `Pure Replay Oracle` + 运行时公理自检 | **`E1`** |
| | `D2` 领域扩展与 `extern` 边界契约 | 非线性算法（`QF_NIA`）、多步时序安全、可信入站、防重扣、跨聚合安全与读模型权限 | 结构 YAML + `.ears`（L2/L3 + Assume-Guarantee）+ `Context Pack` | Z3 临界等式边界证人 → 锁定可执行 BDD 预言机 + 变异击杀 + `PreToolUse`/`Stop` Hooks + 独立盲审 | **`E1`** |
| **Branch 2：解决方案空间（EARS 不可描述）** | `S1` 架构风格与效果绑定层 | `EffectHost` 三段式协议、`SagaHost` 重试/补偿/恢复、幂等存储策略、洋葱依赖边界 | `effect-binding.yaml`（`co-arising.effect-binding/v2`）+ 模块依赖规则 + ADR | ① Binding Schema + **依赖方向 Fitness Function**（禁跨层 import）；<br>② **架构风格故障注入 TCK（`TCK-01..08`）**：超时、半失败、重复投递、乱序回执、崩溃重启 | **`E2`** |
| | `S2` 基建驱动与传输适配层 | JDBC 数据源、Journal 驱动、外部 HTTP/RPC 客户端、Wire JSON/Protobuf 编解码、Bootstrap/DI | Canonical Port 签名 + OpenAPI/JSON Schema/Protobuf/DDL + `runtime-profile` | ① Wire 严格字段白名单与往返校验；<br>② 真实依赖集成测试 / 本地沙箱冒烟 / 资源关闭与断连探针 | **`E3`** |
| | `S3` UI 与主观体验层 | HTML 渲染、前端交互页面、样式、文案、操作流体验 | 强类型 `ReadModelView` 契约 + UX Checklist + 关键用户旅程定义 | ① 自动化底线：XSS/CSRF/链接静态检查 + Playwright E2E / 视觉 Diff；<br>② **显式人工验收签收（绑定文件 SHA-256，改动即失效）** | **`E4`** |

---

## 3. `extern` 外部资源与副作用的分层契约（Assume-Guarantee × Effect Binding）

面对带有独立状态机与网络失败模式的外部资源（例如 TA 系统、支付网关），严禁在 `.ears` 中编写重试循环或 HTTP/Actor 细节，而是通过两层正交解耦：

1. **在 `.ears`（问题空间）只声明 Assume-Guarantee 边界**：
   - 将外部资源抽象为**可观测结果集合**（如 `confirmed` / `rejected` / `unknown_timeout`）与前置证据谓词（如 `extern taReceiptAuthentic`、`extern taAbsenceConfirmed`）；
   - Z3 将 `extern` 视为对抗性黑盒，证明在任意观测结果下业务安全不变量恒成立（例如：`unknown_timeout` 时 `SHALL NOT dispatch` 退款，必须持有 `taAbsenceConfirmed` 才允许触发独立退款）。
2. **在 `effect-binding.yaml`（解决方案空间）声明架构风格与副作用力学**：
   - 声明当前选用的架构风格（如 `cqrs-es-three-phase-effect`、`ts-postgres-outbox`）；
   - 绑定每个抽象效果（`pin`、`dispatch`、`extern`、`expose`）的底层协议（幂等键、超时、重试策略、三段式 `execute/query/reconcile` 协议、崩溃恢复边界）；
   - 声明静态架构红线（`forbiddenImports`，如禁止 `domain` 依赖 `infrastructure` / `web` / `jdbc`）。

---

## 4. 隔离区 4 级渐进毕业梯队（Graduation Ladder）

为了在不破坏稳定系统的前提下持续缩小手写隔离区，所有受治理文件采用四级状态机管理：

```text
stage-0-raw        纯基建/UI/驱动（S2/S3），不强行迁入 EARS；由 E3/E4 门禁守护
    │
stage-1-shadow     【缓冲观察区】代码原样留在 handwritten/，生产行为零变动；
                   通过 sidecar 清单或内联注解绑定 .ears / effect-binding，
                   影子挂载锁定预言机 + TCK + 变异测试，充分暴露边界后再推进
    │  退出条件：影子验证全绿 + 变异击杀达标 + 无架构表达摩擦
    ▼
stage-2-cloze      【受控完形填空区】外围架构壳/Port 升入 generated-scaffold/，
                   仅保留不可简化核心在 @cloze:start..@cloze:end 内，
                   由 PreToolUse/Stop Hooks + 盲审守护
    │  退出条件：确认为 100% 确定性 L1 逻辑且无外部不确定性
    ▼
stage-3-generated  【完全毕业（Channel 4A）】彻底移出 handwritten/，由 EARS-IR 零 Token 生成
```

---

## 5. S1 架构风格标准故障注入 TCK（`TCK-01` .. `TCK-08`）

任何声明遵循三段式可恢复副作用协议（`three-phase-reconcile`）的 S1 适配器，必须通过以下 8 项通用对抗性故障测试，**且 AI 迭代适配器实现时严禁修改或跳过 TCK**：

1. **`TCK-01-HAPPY-ONCE`**：首次提交先 `pin` 原请求，再精确执行外部副作用 1 次并收敛至终态。
2. **`TCK-02-DUPLICATE-REPLAY`**：相同幂等键 + 相同载荷重入时，外部副作用增量必须为 `0`（总次数保持 `1`）并返回 `replayed: true`。
3. **`TCK-03-CONFLICT-PAYLOAD`**：相同幂等键 + 篡改载荷重入时必须拒绝冲突，且外部副作用增量为 `0`。
4. **`TCK-04-TIMEOUT-NO-BLIND-COMPENSATION`**：外部调用超时/返回 `UNKNOWN` 时，**严禁立即触发补偿/退款**（`compensations === 0`），必须转入 `pending_reconcile`。
5. **`TCK-05-RECONCILE-ABSENCE-PROOF`**：仅当外部对账查询返回明确缺席证明 `ABSENT` 时才允许触发补偿，且多次对账最多补偿 `1` 次。
6. **`TCK-06-RECONCILE-CONFIRMED-LATE`**：早期超时但远端实际已成功（对账查询返回 `CONFIRMED`）时，收敛为 `confirmed`，**零重复执行、零误补偿**。
7. **`TCK-07-CRASH-RECOVERY-ZERO-NEW-AUTH`**：模拟进程崩溃重启后，仅依据持久化账本推进既有挂起记录，**严禁对未钉住的未知键签发新授权**。
8. **`TCK-08-OUT-OF-ORDER-DUPLICATE-RECEIPT`**：终态之后再收到重复或乱序回执必须幂等忽略，禁止双计或回退终态。

---

## 6. 统一分层证据账本（Evidence Ledger）与硬不变量

`truthsrc audit-coverage-v2` 与 `truthsrc run-tck-v2` 共同强制以下门禁，结果写入 `knowledge.sqlite` 的 `file_coverage` 表：

- **`V2_UNCOVERED_FILE`**：受治理目录下存在未在 `coverage-manifest.json` 登记的文件 → **直接阻断（`exit 2`）**。
- **`V2_STALE_MANIFEST_ENTRY`**：清单登记了已删除的文件 → **直接阻断（`exit 2`）**。
- **`V2_INVALID_TIER_EVIDENCE`**：`tier` 与 `evidenceTier` / `branch` 不匹配（例如把 `D1` 标成免验证） → **直接阻断（`exit 2`）**。
- **`V2_STALE_HUMAN_SIGNOFF`**：`E4` 人工签收记录的 `fileSha256` 与当前文件实际哈希不一致（文件被改过但未重新人工验收） → **直接阻断（`exit 2`）**。
- **`V2_ARCH_FORBIDDEN_IMPORT`**：源码命中 `effect-binding.yaml` 中声明的跨层禁止 `import` 规则 → **直接阻断（`exit 2`）**。
- **`V2_TCK_FAILED`**：S1 适配器未通过全部 8 项故障注入 TCK → **直接阻断（`exit 2`）**。
