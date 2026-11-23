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
- **R2 等待者队列契约化**——已裁定 (b)，依据记档
  现状：`var admissionReplies`／`var waiters` 纯内存队列，crash 恢复即丢、
  排队调用方永久悬挂（hostHost.scala:73-80；effectHost.scala:83-87）。
  备选 (a) 等待者入事件流：**否决**——ActorRef 跨 actor 系统重启无效，把 reply-to
  持久化进事件流是 Akka 反模式；持久态只存业务事实。
  裁定 (b)：保持内存合并队列；宿主对重复 Invoke 的答复必须**纯由持久状态推导**
  （Completed/Conflict/Pending 语义幂等，重新 Invoke 即自愈）；合同固化 caller 契约
  （幂等 Invoke＋caller 侧 ask 超时重试），发射面注释声明。
- **R3 retry 证据语义（原提案修正）**
  现状：`RetryAuthorized` 事件清空 `observation`（effectHost.scala:148）。
  修正裁定：**清空在功能上正确**（防陈旧证据在 retry 窗口期作答），事件流本身即
  审计面（ObservationStored 全历史留存，journal 可查）——撤回「状态复制前次证据」
  原案；补 R4 的 retry 结构化日志钩子即闭合审计语义。
- **R4 最小可观测性**
  现状：13 件 0 条日志、无 supervision、coordinator Attach/Start 无 host 侧超时。
  提案：宿主/效果宿主发射结构化 debug 日志点（状态迁移/observe/deliver/admit/retry）；
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

- **裁定授权（2026-11-21，用户）**：不再逐条裁定——单一验收标准
  「正确／工业生产级／优雅／Plain FP＋OO」，条款裁决权下放至门序执行侧，
  每条裁决与依据在本文件记档（R2/R3 已记，见 §3）。
- **编译闭包改判（§2 修正，门序执行侧依据引用图实测裁定）**：18 件 monarch 应用面
  构成封闭引用簇（Execution↔Host 互引、Definition→TechnicalPorts、EffectHost↔Execution；
  簇外零引用；手写区仅 7 行 import 别名）。族模块保持两个（合同来源不同），但
  **替换以业务案为单位联动翻转**（payment→refund→dispatch→ta 各一提交，
  每次翻转应用整体可编译，F4 渐进语义保持）；classic 模板在末案翻转后整体摘除。
  §2 表的「8 件/4 件」改为按编译闭包计数：pipeline-invocation-face
  （payment/refund 各 6 件：Execution＋Definition＋Host＋HostIO＋TechnicalPorts＋
  HostSerializer）＋effect-face（dispatch/ta 各 3 件：Execution＋EffectHost＋
  EffectHostSerializer）。
- **N1 缝宽更新**：host 类名由 host id kebab→Pascal＋suffix 去重派生
  （`bank-payment-host`→`BankPaymentHost`），无需 truth 侧补名——✅ 可派生。
- **N2 落地（2026-11-21 用户指令执行）**：领域语言改名已入 truth——payment/refund 两个
  protocol structure 的参与者记录与端口身份全部去序数（`BankPayment0Prepare*` →
  `ReserveInvestorFundsPrepare*`，`BankPayment1*` → `CreditFundCollection*`，
  `BankPayment2*` → `ReserveCashFundOrder*`；`BankRefund0*` → `DebitFundCollection*`，
  `BankRefund1*` → `CreditOriginalInvestor*`；kebab 物化文件身份同步）。手写绑定记录、
  发射器金样同步。门全绿：validate hard 0／roundtrip ok／compile exit 0／显式更新流
  再生 233 件（45 个改名值对象退休）／verify 12/12。
  **F7 修正记档**：truth 冻结因用户显式领域语言指令解除一次（作者面正当编辑，
  本文件与计划 §7.5 同步记档）。金样与 classic 再生产物现在引用同一套领域名。
- **金样完整性裁定（2026-11-21，用户打回后确立）**：金样内**禁止出现任何 classic
  风格类型名**（如 `bank_cash_payment_v1Execution.pay_cash_purchaseResult`）——
  编译闭包内的类型名一步到位；「wave 2 再改名」不成立。同时 TechnicalPorts 单文件
  过杂打回，拆为**端口面**（`BankPaymentPorts` trait——消费者视角）与
  **绑定装配**（`BankPaymentPortBindings`——知识侧绑定义务的可执行形，非通用 DI
  容器）两文件；classic Implementation 的 run/operation/completion 三面合一 null
  缺省改为**按角色的三种 record**（RunBinding/OperationBinding/CompletionBinding），
  Option 与 `.get` 全部消失；Definition 的 9×4 同形复制（codec/check/command/bind）
  收敛为四个泛型 helper（`payloadCodec`／`requireReceiptIdentity`／`safeOutcome`／
  `checkedPhasePort`）。
- **金样分波**：第一波＝Host／HostIO／TechnicalPorts／Serializer 四面（审查已吃透）；
  第二波＝Execution／Definition（需先专注核 monarch strict 运行时的
  OperationRequest/PhaseOutcome 契约）；两波齐后才进沙箱三轮。
- **金样分波完成（2026-11-22）**：pipeline-invocation-face（payment 案 7 件）＋
  effect-face（dispatch／ta 两案各 3 件：Execution＋EffectHost＋Serializer）全部入册
  （`test/reference/curated/effect-face/v1/`，合同 `technical-input.json` 两案一档）。
  effect 面新增裁定记档：ObservationStatus ADT（confirmed/rejected/failed/absent/unknown
  wire，fail-closed 拒未知 wire）＋ReconcileDecision ADT（query/retry）替代 String 分发；
  EffectBinding 按 run 单面构造期校验（无 Option/无 null）；N1 去重裁定：
  `bank-ta-effect`＋EffectHost → `BankTaEffectHost`（BankTaEffectEffectHost 结巴）；
  R1 退避桥入两案 Execution；R4 日志点四类；R3 修正语义落地（清 observation＋
  journal 全历史＋日志钩子）。13 文件括号平衡自检过；金样仍为规格件，
  编译验证在沙箱轮。
- 纪律重申（计划 §6）：classic 模板未摘除前不动 bank-wealth 任何产物；
  金样在 curated 目录为新规格，不触碰 classic 产物字节。
- **质量轮裁定与记档（2026-11-22，门序执行侧按单一验收标准裁定）**：
  「沙箱三轮」完整门闭合——compile 门之上加 metrics 门与 properties 门，官方证据
  `.rounds/host-faces-quality-20261122-02/attempt-0{1,2,3}/completion.json`
  （`HOST_FACES_QUALITY_GATE_COMPLETE`：seatbelt 断网内 pb 293 生成 → 联合编译
  202 供给＋13 金样 → 套件编译 10 件 → 结构度量 1,819 scopes 零违例零超额 →
  ScalaCheck 83 性质（27 directed negatives）× 3 种子 740001-3 全绿）。
  记档如下：
  - **验证单元＝编译闭包**：质量合同（`quality-policy.json`／`scope-exceptions.tsv`／
    `expected-properties.txt`／`quality/` 四件引擎）锚在 pipeline-invocation-face
    候选；effect-face 携带自己的 `test/` 套件并引用共享引擎。族模块仍为两个，
    质量门以闭包为单元（§6 编译闭包改判的质量轮延伸）。
  - **引擎裁定（host-face 层增量）**：var 字段禁、**局部 var/赋值宿**（R2(b)
    内存合并面，逐文件 pinned）；throw＝失闭值域拒绝面（宿主＋序列化层，逐文件
    pinned）；try 只住效果宿 safe 缝（序列化层禁）；`Array` 类型仅 `Array[Byte]`
    形（字节指纹＋akka wire 面，结构性质钉其余形态为零）；`AnyRef` 仅序列化层
    （akka SerializerWithStringManifest 固定签名）；`Term.NewAnonymous` 宿（匿名
    端口实现面）。层上限：host 45/5（44→45 的修订随 R3 guard 落地冻结期记档）、
    serializer 11/2、support 5/2＋35 行逐 scope 精确例外表。
  - **L1 版式定案：闭包硬界 ≤120 列（import 行豁免）**，两套件各一条结构性质
    机械执行；392 行超界全部手工断行（空白断行，编译等价）；effect-face
    technical-input 的 columnLimit 由误记的 100 改为 120（规格件修正记档）。
  - **质量轮揪出并修复的金样语义缺陷（四件，全部经真实协调器/持久化轮验证）**：
    ① `validStatus` 的 argsDigest 误用带前缀摘要——协调器口径是裸十六进制
    （定义摘要带前缀、逐 args 摘要不带）；② Reconcile 的 Query 决策不可达死分支
    ——门放宽为 Retry 需 durable Absent 证据、Query 需 durable Unknown 证据，
    ADT 两决策皆活；③ **无答案观测擦除既有证据**——查询返回 None 曾持久化空
    观测，抹掉 durable Absent 证据链，违反 R3；改为 None 永不覆写，证据链只由
    授权重试（RetryAuthorized）清除；④ R1 退避公式提升为命名纯函数
    `backoffMillis`（有界性质可测）。
  - **装置裁定**：persistence-testkit journal（`serialize=false`——序列化正确性
    由 serializer 性质独立证明，journal 断言只看事件事实）；宿主单次 ask 可答
    瞬态「awaiting authoritative result」（协调器以 Start 态即时作答），故装置
    以**有界轮询 ask** 收敛——这正是 R1/R2 的 caller 契约本身；权威状态正例基座
    由**真实协调器亲授**（Start 回答的 Preparing 态），逐槽漂移以 copy 注入。
  - **固件口径**：协调器权威身份的 TransactionIdentity 七元组序为
    (transactionId, definitionName, definitionVersion, argsDigest, definitionDigest,
    argsCodec, planDigest)，argsDigest 裸十六进制、definition/plan 摘要带
    `sha256:` 前缀——金样、套件判例、裁定文档三处对齐。
