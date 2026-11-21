# 调用/效果宿主两族裁定基线（pipeline-invocation-host ＋ effect-host）— 2026-11-21

> **地位与授权**：本文件是 emitter-unification 计划 §5「调用宿主簇」重聚类的裁定底稿，
> 也是两族门序的**预裁定链**（用户 2026-11-21 指示「先按推荐落地」）。
> §2 的重聚类与 §3 的逐条条款**均待用户逐条裁定**；裁定前不动 classic 模板、
> 不手写金样、不建派生层、不改 bank-wealth 任何产物。
> 裁定方式：对每条批「准／改／否」；有改动即改写本文件再入册。

---

## 1. 审计事实（Phase 2 试点，2026-11-21）

### 1.1 产地核对：计划 §5 原映射「调用宿主簇（#42 族）」不成立

| ledger kind（件数） | classic 产地（`generators/scala-cqrs-application/`） | 知识侧产品 |
|---|---|---|
| invocation-host(2) | `render-pipeline-invocation.mjs`（pipeline start-owner 分支） | `saga-hosts` |
| host-serialization(2) | `render-host-adapters.mjs` | `saga-hosts` |
| technical-port(4) | `render-host-io.mjs`(HostIO×2)＋`render-technical-ports.mjs`(TechnicalPorts×2) | `saga-hosts`＋`artifact-contract` |
| effect-host(2) | `render-effect-hosts.mjs` | `effect-hosts` |
| effect-serialization(2) | `render-effect-support.mjs` | `effect-hosts` |

### 1.2 #42 合同形与 bank-wealth 簇零交集

`truthsrc.composition-invocation-host-input/v1` 的 `validate()` 是语义级钉死的单场景规格：
组合步骤恰 3 步且 await 居中、pid 前缀必须 `-transfer` 结尾、childPlan 必须为
absorb-start-state/mark-processed/fixture-no-op 三段、状态恰 `wafers+processedCount`、
端口恰 3 信号且首信号 RunFinished、trigger 恰 6 槽含 from/to 换向裁定、statusMapping 恰 4、
rSuite/dSuite 测试窗口/时序/打印标签全锁。**bank-wealth 12 件 0 件可表达**；
且 bank-wealth 无 #42 的 classic 对应物（wafer 组合宿主从未是 bank-wealth 产物），
计划 §4 Phase 2.2 的「与 classic 版逐文件 diff」对 #42 没有对象。

### 1.3 缝宽关键事实：该簇的真实派生缝是窄的

- `lib/products/saga-hosts.mjs`（"A full source-derived static host contract"）与
  `lib/products/effect-hosts.mjs`（"Complete authored effect obligations"）已是
  **知识图→类型化合同的完整派生**（hosts 带 id/argsType/entry/association/participants/
  results/technicalPorts，全部对 canonical 指针逐项校验）。
- 参与者业务名在知识侧：`binding.participants[].participantId`＝`source`／`target`
  （bank-wealth 两条 saga 实测），classic 发射时弃用业务名改用序数（`BankPayment0/1/2…`）。
- classic 渲染器＝产品＋options 的确定性函数——族发射器可整体移植，换发射器即换风格，
  知识图零改动。

### 1.4 代码审查（13 件 1,210 行，§3 条款的事实依据）

骨架合格：EventSourcedBehavior＋sealed 事件＋幂等指纹＋两段式交付（authority 等值断言→
delivery）＋round 响应新鲜度关联＋RecoveryCompleted 重查询自愈＋fail-closed require。
不达标与隐患见 §3 各条现状栏。serializer identifier 已核无冲突
（742000/742001/744000/744001）。

---

## 2. 簇重聚类提案（待裁定）

| 项 | 提案 |
|---|---|
| **新族 1** | `pipeline-invocation-host`：invocation-host(2)＋host-serialization(2)＋technical-port(4)＝8 件（HostIO/TechnicalPorts 面随族） |
| **新族 2** | `effect-host`：effect-host(2)＋effect-serialization(2)＝4 件 |
| **#42 处置** | 保持现状，归计划 §4 Phase 3.4（extension 三族按需接入 multi 项目场景）；其派生层等真实组合场景出现再建，不预建 |
| **金样** | 按 §3 风格基线**重新手写**（不是照抄 classic 字节）；classic 现产物保留双用途：语义参照＋替换时的逐文件 diff 基线（F5 呈报件） |
| **合同来源** | 知识图→`saga-hosts`／`effect-hosts` 产品→族输入合同 JSON（F2 派生层首个落地面，缝窄） |
| **门序** | 计划 §4 Phase 3 节拍全走：本文档逐条裁定→手写金样→沙箱三轮→讲解→逐条裁定→emitter 模块→bank-wealth 接入＋classic 摘除→五步门＋diff 呈报→删除 |
| **排期衔接** | 计划 §4 Phase 2 试点目标改写为「两族金样门＋派生层首个落地面」（#42 试点取消）；两族插入 Phase 3.2 之前（monarch 应用面是 34 族里 classic 现成度最高的簇）；每次族替换按 §7.5 指纹节拍执行（动 generators/ 必翻 bank-wealth 指纹→显式 update 重生成→再 verify） |

---

## 3. 风格裁定基线（逐条待裁定）

裁定码沿用仓库惯例（字母组＋序号）。每组一条裁定行：现状（证据 file:line）→ 提案。

### N 组——命名

- **N1 stem 去重＋PascalCase**
  现状：`bank_payment_hostHost`＝stem(`bank_payment_host`)＋`Host` 后缀拼接不去重
  （render-invocation-host.mjs:8）；对象名蛇形带版本后缀（`bank_cash_payment_v1Execution`）。
  提案：发射面一律 PascalCase；stem/suffix 组合强制去重（先例：aggregate-state-controller
  族 R-D consistentBaseName）；类型名不携带 saga id 与版本号。
  缝宽：host 业务名待核（binding 有蛇形 id；display name 可能缺——缺则 truth 侧补，
  作者面动作，登记知识面缺口）。
- **N2 参与者业务名替代序数**
  现状：`BankPayment0Prepare…BankPayment2Commit…`（序数索引）。
  提案：端口面用 `binding.participants[].participantId` 组合（如
  `BankPaymentSourcePrepare`／`BankPaymentTargetCommit`）。
  缝宽：✅ 可派生（source/target 实测在案）。
- **N3 方法名 case 一致**
  现状：`rejected_before_effects`（蛇形方法，Delivery trait）。
  提案：camelCase 方法；kind→方法名映射规则进合同，发射器不即兴。

### T 组——类型化

- **T1 sealed ADT 替代 String 分发**
  现状：result kind／外部观察 status／reconcile decision 全是裸 String
  match（`case "succeeded" =>`），且字符串进持久化事件流。
  提案：Scala 面全部 sealed trait／enum（case 集从 `RESULT_KINDS` 冻结集派生，
  ✅ 可派生）；事件持久化仍走 PB＋manifest，但 kind 槽专用（见 T4）。
- **T2 表驱动端口**
  现状：`required`／`bindingOwnership`／`Bindings`／`Installed`／`declarations`
  五处逐端口展开（TechnicalPorts.scala 全文 240 行约 90% 同形复制）。
  提案：单一类型化绑定表（PortBinding 行对象＋通用 install），行集从产品 ports 派生；
  发射面行数与端口数线性、零逐端口复制。
- **T3 无 null 默认**
  现状：`Implementation(…, operation = null, completion = null)`
  （TechnicalPorts.scala:112）。
  提案：缺省改 `Option` 或显式双构造器（run-only／with-completion），require 校验保留。
- **T4 PB 槽位语义对位**
  现状：serializer 把 result kind 装进 PB `operation` 字段（语义漂移，
  HostSerializer.scala:18-19）。
  提案：host 事件 PB 的 kind 槽专用。
  兼容注记：host 事件 PB 是持久化 schema；bank-wealth demo 日志可重建（无生产数据），
  金样升级时 manifest 一并 bump；不涉及 ledger/anchors 契约。

### L 组——版式

- **L1 排版纪律**
  现状：codec lambda 单行 ~2000 字符、30 项 `Vector` 单行、7 字段 case class 单行
  （v1Execution.scala:25-26 等）。
  提案：≤100/120 列、手平衡断行、每个冻结形逐处记档（同 curated 线
  C2/D-LAYOUT-100 纪律）；禁止单行压缩长 lambda。

### R 组——运行时（工业级）

- **R1 有界轮询**
  现状：Pending 重试 `scheduleOnce(20.millis, …)` 无上限、无退避、无 deadline
  （v1Execution.scala:45）。
  提案：有界指数退避（初值/倍率/上限/deadline 四参数进合同 technical-input 槽，
  裁定值随门序定）。
- **R2 等待者队列持久化或契约化**（二选一，用户裁定）
  现状：`var admissionReplies`／`var waiters` 纯内存队列，crash 恢复即丢、
  排队调用方永久悬挂（hostHost.scala:73-80；effectHost.scala:83-87）。
  提案 (a)：等待者入事件流（PendingRegistered/PendingReleased），重启后可答复；
  提案 (b)：保持内存队列，但合同明确 caller 重试契约（Invoke 幂等＋caller 侧超时重试），
  发射面注释与 Conflict/Waiting 语义文档化。
- **R3 retry 保留证据**
  现状：`RetryAuthorized` 事件清空 `observation`，前次外部证据只存事件流不存状态
  （effectHost.scala:148）。
  提案：状态保留前次证据（如 `previousObservation` 字段），审计面闭合。
- **R4 最小可观测性**
  现状：13 件 0 条日志、无 supervision、coordinator Attach/Start 无 host 侧超时。
  提案：宿主/效果宿主发射结构化 debug 日志点（状态迁移/observe/deliver/admit）；
  coordinator 交互带 host 侧 ask timeout（technical-input 槽）。
- **R5 死代码不发射**
  现状：空 `trait PureStages {}` 无条件发射（v1Execution.scala:28-30）。
  提案：无成员面一律不发射；发射器对空面 fail-closed 记档。

### D 组——生成器纪律（对两族 emitter 模块的门槛）

- **D1 同形不展开**：同一判定逻辑在发射面出现 ≤2 份（表驱动/参数化优先）；
  沙箱门机械检查沿用本次审查的「modulo 改名 diff」法。
- **D2 金样即规格＋电池齐全**：两族金样按本基线手写；emitter 对金样逐字节等值＋
  双跑确定＋负测电池进模块（不重蹈 #11/#13/#25/#26 电池债务）。

---

## 4. 缝宽表（两族合同槽位 × 信息来源）

| 槽位 | 知识侧 | 来源 |
|---|---|---|
| 参与者业务名（N2） | ✅ | `binding.participants[].participantId`（source/target 实测） |
| entry/association/results/technicalPorts 结构 | ✅ | `saga-hosts` 产品（canonical 指针校验） |
| effect 义务（execute/query/reconcile） | ✅ | `effect-hosts` 产品 |
| result kind ADT case 集（T1） | ✅ | `RESULT_KINDS` 冻结集（saga-hosts.mjs） |
| host 业务名（N1） | 待核 | binding 有蛇形 id；display name 可能缺（缺则 truth 侧补，作者面动作） |
| 重试/退避/超时参数（R1/R4） | ❌ 判定面 | 新族 technical-input 槽，裁定值随门序定 |
| 等待者语义（R2） | ❌ 判定面 | 本文件二选一裁定 |
| 排版形（L1） | ❌ 发射面 | 金样手平衡形 |

结论：**缝窄**——结构槽全派生，判定槽集中在 R 组三处，排版在发射器。

---

## 5. 与 emitter-unification 计划的衔接

1. 计划 §5「已定案｜invocation-host(2)＋…（#42 族）」行按本文件裁定结果改写。
2. 计划 §4 Phase 2 试点目标改写为「两族金样门＋派生层首个落地面」；#42 试点取消
   （无 classic 对应物，§1.2）。
3. 计划 §7 风险「族映射误判」的实例登记：本次产地核对即该风险的程序化落地，
   核对有效、映射改判——程序纪律按设计工作。
4. 两族替换提交时按计划 §6.7：发射器接入＋classic 摘除＋登记一次提交；
   bank-wealth 侧按 §7.5 指纹节拍（显式 update 重生成→verify）。

## 6. 状态

- **全部条款待用户逐条裁定**（准／改／否；改动即改写本文件再入册）。
- 裁定通过后门序启动：手写金样（按 §3 基线）→ 沙箱三轮 → 讲解 → 逐条裁定 →
  emitter 模块（字节等值＋双跑确定＋负测电池）→ bank-wealth 接入＋classic 摘除 →
  五步门＋diff 呈报 → 删除。
- 纪律重申（计划 §6）：裁定前不动 classic 模板、不写发射器、不改 bank-wealth 任何产物。
