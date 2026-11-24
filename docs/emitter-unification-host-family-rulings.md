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
- **发射器模块两族入册（2026-11-23，门序执行侧按单一验收标准裁定）**：
  「金样发射器模块（字节等值＋双跑确定＋负测电池）」节拍闭合——
  `emitter/families/pipeline-invocation-face.mjs`（#43，7 件）＋
  `emitter/families/effect-face.mjs`（#44，6 件，双案循环）注册进统一发射器
  （index 8→10）；parity 官方 harness 全绿（13/13 逐字节等值＋双跑确定＋
  36＋33 条负测电池全拒，零电池债）。记档如下：
  - **出处裁定＝handwritten-golden**：两族金样先于发射器手写而成（无 classic
    tools/gen-*.mjs 参考件）；再造一份字节等值参考生成器违背「metarch-truthsrc
    只留一个代码生成器」的程序本体。registry 契约扩展：`toolsRef: null` 必须携
    `provenance: 'handwritten-golden'`（缺出处声明拒注册）；parity 报告以
    `toolsParity: null`/`toolsDeterministic: null` 表达「结构性不适用」，验收
    由 golden parity＋双跑确定＋电池三腿承载——显式 null，绝非静默绿。
  - **契约补全（F2 发射完备）**：两 face 的 `technical-input.json` 扩为唯一发射
    输入——supply 坐标、execution 计划（inputs/requestInputs/output/codecSlots/
    executionStatePb/originalFields）、participants 逐参与者 protocol/argsField/
    commands、admission 门、portBindings.codecPinPrefix/codecPinVersion、
    saga.argsFields/argsPinVersion、results.kinds.executionCase/stageError、
    faceShape.reconcileDecisions/serializerManifest/messages（21 条）＋
    executionMessages（8 条）、effect.identityKeyNoun、逐工件文件头 doc 行逐字
    入合同（docs/）。发射器零金样字节内嵌：名字/字段/消息/布局数据全部出自合同
    （计划「不硬编码」纪律的发射轮落实）。fixture 新增
    `test/fixtures/{pipeline-invocation-face-v1,effect-face-v1}/input.json`
    ＝technical-input.json 逐字节副本（F2 唯一输入）。
  - **金样后冻结整理（三件，编译等价，逐件记档）**：① BankPaymentPorts 重复
    import 去重（`OperationIdentity` 单行与打包行并存→只留打包行）；②
    BankSipDispatchEffectHost 未用匹配绑定 `(declaredId, role, bound)`→
    `(_, role, bound)`（对齐 ta 侧同形）；③ pipeline-face technical-input
    columnLimit 100→120（质量轮 L1 定案的规格件补记，effect-face 已改）。
    整理后本地重基线：联合编译＋结构度量（1,819 scopes 零违例零超额）＋
    83 性质×3 种子全绿；官方三轮证据（c91f490）仍为语义闭合记录，本轮为
    字节级重基线。
  - **布局形状裁定（发射器冻结形，packer 机械复现）**：段头右填 `-` 至
    81/80 列；声明行仅在超 120 时断（尾词续行 +2/+4/+6/+8）；ResultKind
    all/terminal 首项断行＋+8 贪心续行；StageError 尾参单行装不进时 12 列
    贪心重排（支付 RecoveryRequired 三行形）；效果宿 encode 装不进时前两段
    包名独行的两行梯；义务表 id 裸形（`bankwealth.` 前缀在 install 检查处
    拼接）；import 行豁免 120 列界（与质量引擎同口径）。金样里所有长度敏感
    断点（dispatch 124 断／ta 恰 120 单行的 Pending 行等）由「>120 才断」
    规则机械复现——版式不再逐案手记。
- **F2 派生层落位＋payment 翻转接线（2026-11-23，门序执行侧按单一验收标准裁定）**：
  「bank-wealth 接入」节拍的工具侧闭合——知识图→族输入合同的派生层首次落地，
  翻转开关与 producer 接线入 play-service registry。记档如下：
  - **派生层落位 `lib/derivation/pipeline-invocation-face.mjs`**（知识机侧，非生成器
    侧）：案变槽位全部从产品载荷派生——names（N1：面基名来自 technical 工件
    `BankPaymentTechnical`→`BankPayment`，与 host id kebab→Pascal 交叉校验；execution
    类名来自 saga id 去 `-vN` 后缀）、saga（digest/definitionVersion=runtimeIdentity
    .version/argsPinVersion=args.runtimeCodec.version/argsFields=args.slots）、invocation
    （markers 来自 transactionIdentity 的 iteration/chunk 缺省，present 形 fail-closed
    拒绝——v1 合同不带 token）、results（Pascal kind 来自冻结五集；executionCase=
    pascal(step)+outcome.code；terminal=action≠manual-recovery；stageError=
    {label=code, category=kind, discipline=action}——全部载荷直推）、participants
    （commands=phases[].command.id 有序三元、argsField=resourceInput.id、
    resourceType=layout event-slot valueType、protocol=aggregate+Protocol）、
    portBindings（工件=逐端口「选中工件×实现身份」唯一归属；declaredIdStem=context+
    面基名，与 entry/association 实现身份前缀交叉校验；codecPinPrefix=工件 id 去
    `-technical`）、serializer（identifier=742000+hosts 序位，eventPb=host id 去
    连字符+HostEventPB）、execution（inputs/requestInputs=名类型入子集/output 恰一/
    codecSlots=输入序槽+唯一 write 落 output0/executionStatePb=saga id 去连字符+
    ExecutionStatePB/originalFields=原值成员映射执行输入，`operationId`→`operation`
    去尾 Id 规则，成员不落输入即拒）、supply（options.packages 派生包坐标）、类型
    解析（layout 名声明→runtime 标量描述符→拒，与 execution 面同构）。族面恒定槽位
    （messages 44 条、docs prose 模板、R 组运行时槽、排版纪律、出处注记）作为已裁定
    族面知识随模块记档——classic 模板语义的迁移件；发射器零金样字节约束不受影响
    （这些字节只经由派生合同进入发射器）。
  - **验收即等值**：派生合同对 curated 技术合同 JSON 深等值（含全部出处注记，
    payment 案实测）；经 renderFamily 后 7/7 金样字节等值。知识夹层 fixture
    `test/fixtures/pipeline-invocation-face-v1/knowledge-products.json`（派生所需
    载荷切片：host＋execution pipeline＋双 saga 运行时描述符〔Text 标量解析跨 saga〕
    ＋五选中工件〔归属唯一性〕＋九条 layout 声明）＋`test/derivation-pipeline-
    invocation-face.test.mjs` 4 测试（等值/字节/fail-closed 负测/清单不变量）。
    派生读取超出切片即以「exactly one layout declaration required」显式失败，
    不以陈旧知识静默绿。
  - **F4 翻转开关＝`PIPELINE_INVOCATION_FLIPS` 单一清单**（每业务案一条，携
    docShort/docLong 业务短语槽；每翻转一提交增一条）。`lib/derivation/
    pipeline-invocation-emission.mjs` 三个 producer 包装接入 play-service registry：
    finite-host-dsl（classic 五件移除＋金样形六件加入）、finite-execution-dsl
    （classic Execution 移除＋金样形加入）、conf/serialization.conf（host 序列化器
    与 Event 绑定两行类名翻转——render-build 模板产 `bank_payment_hostHostSerializer`
    /`bank_payment_hostHost$Event`，翻转后拼 `BankPaymentHostSerializer`/
    `BankPaymentHost$Event`）。全部精确匹配 fail-closed：classic 面不恰为五文件、
    Execution 不恰为一文件、conf 行不恰为一次出现，即拒翻转。kinds/knowledgeIds/
    productFootprint 沿用 classic 约定（host 件 source:bank-v1#/sagaHosts/0、
    execution 件 #/pipelines/0）；deps 沿金样内实引（参与者共享 aggregate 时
    Protocol 路径去重——PRODUCT_ENTRY duplicate identity 教训记档）。
  - **金样字节无生成头（呈报项，F5）**：翻转件按金样逐字节落盘（无
    `// @generated` 头）——「金样即规格」优先于树内样式一致性；头部属装饬性
    溯源，所有权/锚点机器以路径＋knowledgeIds 为准，不受影响。
  - **generate --plan 实测（翻转后工具链）**：234 件（net +1：−6 classic＋7 金样）
    全部通过双跑确定性、kinds 声明、footprint 全集、依赖闭合、无占位符五道入口
    校验；七件翻转件与金样逐字节等值；conf 两行翻转到位；refund/dispatch/ta
    classic 件不受影响。classic 模板（render-host*.mjs 面函数）仍为其余三案服务，
    payment classic 路径自翻转起不再产出——模板摘除待用户过目逐文件 diff 后进行
    （F5/F6.6）。
- **翻转节拍两件机器裁定＋payment 案翻转完成（2026-11-23，门序执行侧按单一验收标准裁定）**：
  payment 案按 F4 翻转计划全绿收官，途中揪出并修复 apply/verify 机器两处退役语义缺口。记档：
  - **退役裁定（所有权台账＋锚点索引，翻转流程首次触发）**：plan 丢弃的产物路径、
    其文件又已从盘上删除的 prior 行，此前被 apply 原样保留（ledger 240 行／anchors
    遗留 stale location），verify 的集合恒等检查永远红且无任何恢复路径——翻转流程
    是第一个「产物退役」场景，暴露了机器只有「保留」没有「退役」的缺口。裁定：
    ① `ownershipRows` 丢弃「plan 已弃该路径 ＋ 盘上无文件（captured 显式 null）」
    的本 owner＋generator 行；盘上仍在的 unplanned 文件一律保留（绝不静默抛弃
    可能含手工编辑的文件）；② anchors reconcile 对同形（文件缺失＋无声明＋无
    MISSING/FAILED outcome）的 prior location 直接丢弃（indexFrom 本就剔除空键）；
    ③ 结果回执新增 `retired: [{path, kind, outcome: 'RETIRED', exists: false}]`
    ——退役是显式报告事件，绝不静默。 Retirement 是两步流：文件离盘 → 显式
    update → verify；与 DDD 改名轮「45 值对象退休、clean 233、verify 12/12」的
    记录自洽。
  - **payment 翻转实测（bank-wealth 提交 980708f）**：六件 classic 面文件退役
    （execution/definition/host/hostIO/serializer/technicalPorts），七件金样形
    产物落盘（Ports＋PortBindings 两文件拆分＝金样质量裁定「端口面/绑定装配」
    分离的落地），conf 序列化注册表两行类名翻转；六件手写文件改名同步
    （BankPaymentBindings 按金样 ABI 重写为 RunBinding/OperationBinding/
    CompletionBinding 记录构造、N2 camel 绑定成员、install 返回
    `BankPaymentPorts`；BankRuntimeDirectory/BankRuntime/BankCashRequests/
    BankSipDispatchBindings/BankSipTerminalBridge 跟随改 import 别名；
    `Cash.install(host.ref)` 去掉 PureStages——payment 管线无纯段）。五步门
    全绿：doctor／validate hard 0／compile exit 0／显式 update 干净 234 件
    （6 RETIRED 显式回执）／generate written=0 identical 234/234／verify
    12/12。翻转速记：金样字节无生成头落盘（金样即规格优先）；翻转件
    knowledgeIds 沿 classic 约定（host 件 #/sagaHosts/0、execution 件
    #/pipelines/0），anchors 全部 source-verified。
- **效果面派生层＋双案翻转完成（2026-11-23，门序执行侧按单一验收标准裁定）**：
  「dispatch／ta」节拍闭合——`lib/derivation/effect-face.mjs` 从 effect-host／
  execution／reference-layout 载荷＋options.packages 派生
  `truthsrc.effect-face-input/v1`（identity 键、四 outcome 的 resultCases、codec
  槽、execute/query/reconcile 义务身份、744xxx 序列化器带、效果 proto 面——全部
  载荷直推；单形面常量与逐案 doc 散文〔两案皆金样背书〕为记档族面知识）。
  **派生合同深等值 curated 效果合同＋6/6 金样字节等值**（知识夹层 fixture＋4
  测试）。**双案即发射单元（裁定）**：族合同本身承载两案（validate 要求恰两
  case；单形宿主服务两案、逐案知识），故 dispatch＋ta 一次提交同翻——F4 的
  「每业务案一提交」在合同单元处适配为「每发射单元一提交」。效果输入按构造
  皆为领域值——派生不落 saga-runtime 回退（durable-effect-host producer 视图
  不声明该产品；fail-closed 落在『complete nominal type declaration
  required』）。实测（bank-wealth 提交 a0d958c）：六件 classic 效果文件退役、
  六件金样形产物落盘、akka effect 序列化注册表四行类名翻转（effect0/effect1
  序列化器＋Event 绑定）、手写 BankSipDispatchBindings/BankTaEffectBindings
  按金样 ABI 重写（逐角色命名 EffectBinding、义务表 install）、BankRuntime
  ensureTa/ensureSip 去 PureStages（Ta.install/Dispatch.install 只收效果宿主
  actor）、SipApplication/ta 退款应用跟随改名。五步门全绿：validate hard 0／
  compile exit 0／显式 update 干净 235 件（6 RETIRED）／generate written=0
  identical 235/235／verify 12/12。
  **四个 monarch 闭包业务案自此全部出自统一发射器**；classic 面模板成死路，
  摘除待用户过目逐文件 diff（F5/F6.6，材料齐 /private/tmp/bw-flip-diff/：
  17 份逐文件 diff＋conf diff，classic 侧以 c91f490 工具提交的 worktree 全树
  重现，行数与翻转前磁盘文件逐一致）。
- **classic 面模板摘除（2026-11-23，用户裁定「摘除吧」后执行）**：
  四个 monarch 闭包业务案（payment／refund／dispatch／ta）的 classic 模板路径
  自服务 profile（scala-cqrs-play-service，bank-wealth 的注册生成器）正式退役。
  **摘除语义＝翻转清单即退役登记（裁定）**：renderers 对已翻转 id 直接跳过
  （renderDefinitions／renderInvocationHosts／renderHostIO／
  renderTechnicalPorts／renderHostAdapters／renderInvocationExecution／
  renderEffectHosts／renderEffectSupport），wrapper 守卫从「期望删 5 件」翻为
  「classic 翻转件残留 plan 即拒」；render-pipeline-invocation.mjs 自此仅存于
  application profile（其 inventory-* 夹具仍钉住未翻转 pipeline 归属宿主与
  直有宿主的 classic 行为——该 profile 的未化族已按门序排入 Phase 3 计划，
  物理文件删除随该族执行）。**staying proto 保全裁定**：翻转管线／宿主的
  staying proto（四份 execution proto＋两份 host proto＋两份 effect proto）
  是金样 codec 的 PB 面，retirement 只退役 serializer/plan 件——
  render-invocation-execution／render-host-adapters／renderEffectSupport
  对翻转 id 保留 proto-only 发射；effectConfig 保留全宿主索引
  （effect0/effect1 序号与 conf 类名翻转补丁依赖）。wrapper 的 producer
  footprint 改为按 play-service 清单硬声明（classic 首件借不再可得；
  finite-execution-dsl／durable-effect-host-dsl 按历史形态不含
  artifact-contract——服务包装层的无保护推钉恰补一次）。实测：摘除后的
  工具链显式 update 重生成**字节完全一致**（written=1 仅 inputs.json 指纹
  COVER，identical 234，total 235，retired 0），五步门全绿（validate hard 0／
  compile exit 0／verify 12/12／generate written=0 identical 235/235）；
  inventory 夹具套件（未翻转 classic 行为的兼容性证明）全绿。
- **#11 rules 簇接入（2026-11-23，单一验收标准裁定执行）**：计划 Phase 3 第 1 项
  「已定案簇余量：#11 rules 簇（bank 9 件）接入（金样已有，无新门）」闭合。
  逐条裁定记档（族内部裁定，程序授权外按域内标准裁定）：
  - **R1 复刻语义（本簇接入的核心裁定）**：rules(9)＝`renderInvariant` 对三个聚合
    （CreditBalance／FundOrder／SipPlan）各发的三件——核心 guard-chain 规则
    （`domain/invariant/XxxRules.scala`）、params 记录（`domain/invariant/params/
    XxxRuleParams.scala`）、域门面转发（`domain/XxxRules.scala`）。这些文件**就是**
    bank 已验证的业务逻辑本身，其 ABI（门面、guard 链、Either[String, Vector[Event]]、
    params 形）被尚未翻转的生成消费者（aggregate behaviors 等，Phase 3 后段各族）
    引用——此刻改形会破坏逐案翻转隔离与「任何时刻可编译」保证（F4）。故本簇翻转＝
    **字节复刻翻转**：统一发射器逐字节重产 classic 现产九件，应用侧零可见 diff
    （F5 呈报＝零 diff，最强替换结论）；形态演化（stockreservation formal 机形是否
    适用 bank 规则）属 Phase 4 all31Closed 评估，由用户裁定。
  - **R2 §5 映射勘误（沿 Phase 2 试点审计判例）**：审计曾裁「调用宿主簇→#42 映射
    不成立」，本簇同理：bank rules 9 件的产地是 `scala-cqrs-domain/render-domain.mjs
    renderInvariant`（play-service 注册表 invariant-dsl 行，layered=true），
    curated stockreservation 金样（#11 aggregate-rules-formal，v1/v2/v3 三代）是
    独立参考件——其 contract 无法表达 bank 规则（双命令硬形＋四种守卫谓词 vs
    bank 46 命令 301 守卫 23 种谓词算子）， emitter 模块按其形改造即「有新门」，
    与计划登记矛盾。统一发射器侧新设 **#45 aggregate-invariant-rules 家族**，
    #11 保留其 curated 参考件位不动（电池债务照旧登记）。
  - **R3 出处＝classic-reproduction（registry 契约扩展）**：金样树
    `test/reference/curated/aggregate-invariant-rules/v1/` 钉存 bank 现产九件字节
    作**复刻回执**（非风格规格件）。registry 的 toolsRef-null 出语从
    'handwritten-golden' 单值扩为 {'handwritten-golden','classic-reproduction'}
    双值（单发射器程序禁止复制一份参照生成器；金样出处显式声明）。
    parity 报告 provenance 字段随 family.provenance 显式化。
  - **R4 生成头保全**：翻转件保留 `// @generated by truthsrc scala-cqrs-domain:1`
    头行——与金样无头裁定（face 两族）相反的记档项：复刻簇的验收目标就是 classic
    字节本身，头部属树内生成件样式约定，去头是全树统一的美学决定（留待用户），
    不属本翻转。
  - **R5 簇＝发射单元**：三聚合同进退（wrapper 对部分在场的簇 fail-closed 拒绝），
    沿 effect-face 双案发射单元判例；无清单聚合的项目（一切 fixture/inventory）
    原样透传。
  - **实现落位**：派生层 `lib/derivation/aggregate-invariant-rules.mjs`（决策谓词
    解释器 decision() 自 classic 知识解释器逐字移植——谓词 AST 是知识、渲染为合同
    文本属派生工作非发射器布局；发射器零业务字节内嵌）＋翻转清单
    RULES_FLIP_AGGREGATES＋isRulesFlipped；emission 桥
    `aggregate-invariant-rules-emission.mjs`（withFlippedInvariantRules：classic
    残留即拒＋簇单元＋路径碰撞守卫；footprint 按 play-service 清单硬声明
    reference-layout@1/domain-decision@4/domain-folds@6/exact-value-types@1）；
    家族模块含 codeMappings 全出处面复刻（命令 scope＋守卫 span 字节跨距）。
  - **验收实证**：九件字节逐字节等值 bank 现产物；393/393 codeMappings 跨距与
    classic 时代锚点（bank generated/current/anchors.json，spanVerified=true 的
    guard/命令级实测跨距）逐一吻合（独立回执 fixture
    anchor-span-receipt.json 恒钉此对账）；派生合同深等值 curated 合同；
    端到端 plan 231 件（rules 9 件自家族、event-handler 6 件仍 classic）、双跑
    确定绿；家族 parity：deterministic／goldenParity／电池 12/12／allGreen；
    emitter 套件 FAMILY_COUNT 11、batteriesDebt 恒 4。五步门随后执行。

---

# value-object 族（#1，bank 118 件）预裁定链（2026-11-23，待裁定）

Phase 3 第 2 项开工呈报。门序不豁免：以下逐条经用户裁定后方可手写金样。

## 1. 产地核对（审计事实）

- 活链（bank 实际产地）：`scala-cqrs-play-service/generate.mjs` 继承
  `createEffectRegistry('2')` → `scala-cqrs-application/produce.mjs:25`
  `'valueobject-dsl': producer(['reference-layout','exact-value-types'], renderValues)`
  → `scala-cqrs-domain/render-values.mjs`（38 行表驱动渲染）。
- bank 台账实测：kind `value-object` 118 件，全部
  `app/example/bankwealth/domain/values/<Name>.scala`；每件单知识源
  `source:bank-v1#/valueObjects/<i>`；`deps: []`；无 codeMappings（classic 渲染
  即不产出）。plan §5 映射 value-object(118)→#1 **成立**，无勘误。
- **非**活产地（不在本节拍 registry 摘除范围）：`generators/valueobject-dsl/`
  独立 DSL CLI（191 行渲染，带 jsonFormat 伴生对象——与活产件形状完全不同）与
  `scala-cqrs-classic-v2` 的 ValueObjectTemplate 链（templates/builders/models，
  依赖 `models/domain-entity.mjs`，属 #2 entity 族共享件）。它们属各自 classic
  生成器包，随 Phase 4 物理删除；`lib/artifact-docs/classify.mjs:65` 的
  render-values.mjs 映射行随活摘除同步改。
- 受影响套件（须随节拍同改）：`test/service-composition-layers.test.mjs`
  values 腿——现钉 play-service plan 与 legacy `applicationRegistry('2')`
  逐字节等值；翻转后该腿改为家族等值断言（沿 effect-face 判例）。

## 2. 变体矩阵（118 件实测，参照 1,242 声明全布局）

- 形状三分：exact 精确值 2（Money＝unit-decimal CNY 38/2、AmountDecimal＝
  decimal 38/2 无单位成员→`value` 兜底）；primitive 包裹 12（11 string＋
  AmountDecimal 被 exact 覆写）；record 记录 106（磁盘 22 包裹件＝12 primitive
  ＋11 单成员 record＋AmountDecimal；磁盘 exact 2＝AmountDecimal＋Money，
  对账吻合）。
- record 成员数直方图：1:11, 2:19, 3:25, 4:5, 5:6, 6:4, 7:17, 8:1, 10:9,
  12:6, 13:1, 15:2（最宽 BankOrderView 15 字段）。
- 成员类型形态（530 成员声明）：primitive 249（string 226／integer 27／
  boolean 5／decimal 1）、nominal 250（36 个不同目标，**全部落在 values 集内**）、
  optional 24、sequence 7、map 0；跨 context 引用 **0**。
- 知识面：全部 `context: bankwealth`、owner `[]`、`dependencies` 字段 106 件
  非空但 classic 渲染不消费（entry deps 恒 []，维持）。

## 3. 派生缝宽

窄。合同全部数据在产品载荷里：layout kind='type' 声明（118）＋其成员声明
（530，成员引用按 ref 解析到 valueType 树）＋exact-value-types 描写（2）＋
`options.packages`。零推断、零缺槽。派生层 fail-closed 拒：重复类型名、成员
引用无声明、不支持形态（含 nominal 指向非 type 声明）、exact 描写指向不存在
类型、单位成员无单位集等。

## 4. 金样语义提案（核心裁定）

**手写 curated 金样**（沿计划 §Phase3 完整门序），**不**延用 #45 的 R1 复刻
语义。理由：

1. R1 复刻的成立前提是「规则件即业务逻辑本体、ABI 被未翻转件消费」；value
   object 是纯数据件，重排文本后 JVM 签名不变（同类名/同包/同字段类型），
   未翻转消费方（state/protocol/rules 的 `domain.values.X` FQN 引用）照常
   编译——重排是 ABI 透明的，F4 无损。
2. classic 渲染本身已 95% curated：表驱动、知识纯（发射字节零业务内嵌）。
   classic 风格残留恰是两处：nominal 一律 FQN 全称、生成头行。curated 化的
   delta 小而外科：**同包短名＋去头**，其余逐字节保持。
3. golden 质量栏（零 classic 式名）对手写金样是红线；若走复刻则 118 件 FQN
   式样永久化到 Phase 4 之后，与质量栏相悖。
4. 计划 §Phase3 门序对「限定 raw 簇」明文预设手写金样；R1 属已定案簇特例，
   不外溢。

## 5. 风格裁定基线（逐条待裁定）

### N 组——命名
- **N1** nominal 类型引用：同 context → 包内短名（`FundOrderId`）；跨
  context → `<目标包>.domain.values.<Name>` FQN。银行 36 个引用全同包，
  规则为一般性而设；合同仍携带 context，发射器按规则选择。
- **N2** primitive 包裹字段名恒 `value`（classic 冻结排版形，记档；派生层
  显式产出 member:'value'，发射器零硬编码名）。
- **N3** 类型名不变（AccountId/Money/BankOrderView 均业务知识，非 classic
  架构名；质量栏所禁是 FQN 式渲染，非业务名）。

### T 组——类型化
- **T1** primitive 映射 string→String／integer→Long／boolean→Boolean／
  decimal→BigDecimal；optional→`Option[..]`、sequence→`Vector[..]`、
  map→`Map[k,v]`（银行无 map，合同支持、电池覆盖）。
- **T2** exact 精确值语义逐字节保持：构造体校验行、单位集 require、
  isPositive／compareSameUnit／plus／minus、checkedAmount 的
  setScale(scale, UNNECESSARY)＋precision 上限＋MathContext.UNLIMITED。
  这是 exact-value-types 产品的架构语义（已被应用行为验证），不属重排范围。

### L 组——版式
- **L1** 生成头：**去头**（face 两族手写金样判例；golden 树即无头，翻转后
  bank 生产件随行去头——与 #45 R4 保留头相反，此处是新风格件非复刻件）。
- **L2** 案类声明保持单行（含 15 字段最宽件）：一行一类的版式利于台账
  diff 稳定性与确定性；字段列表是数据驱动，包内短名化后长度已大幅收敛，
  不引入断行规则。

### D 组——发射器纪律
- **D1** 表驱动：发射器零业务字节；名字/字段/单位集/精度标度全部出自合同。
- **D2** checkInput fail-closed（RULES 式错误码 `VO_INPUT`）＋内嵌负测电池
  ≥12 例（含 bank 未触发的 map/跨包 FQN/单成员 record 形态）；本族**不进**
  电池债务清单（batteriesDebt 恒 4 不变）。
- **D3** 双跑确定＋金样逐字节等值（parity harness 常规）。

## 6. 翻转单元与检出

- **翻转单元＝全族一次提交**：values 是全案共享基建（AccountId 等跨案引用），
  非案域件；F4 的「逐族替换」在此族的自然粒度即整族，编译在翻转前后两态均
  完整。不同于 effect-face 的按案翻转（案域件）与 rules 的按聚合簇（三件互锁）。
- **检出＝context 清单**：`VALUE_OBJECT_FLIP_CONTEXTS = ['bankwealth']`；
  wrapper 对清单 context 的 type 声明走家族发射，其余 context 原样透传
  classic（inventory/fixture 项目不受扰，套件基线不动）。
- **接线**：play-service generate.mjs 的 valueobject-dsl 分支包
  `withFlippedValueObjects`（沿 rules 判例：classic 残留即拒、路径碰撞守卫、
  footprint 硬声明 reference-layout@1/exact-value-types@1）；registry 摘除后
  classic 行仅在非清单 context 生效。

## 7. 代表金样集（手写 8 件＋变体矩阵性质覆盖）

金样树 `test/reference/curated/value-object/v1/`：technical-input.json（派生
合同切片）＋README＋8 件代表 profile，覆盖矩阵全部形状：

| 金样件 | 覆盖形 |
|---|---|
| AccountId | primitive string 包裹 |
| AmountDecimal | exact decimal（无单位） |
| Money | exact unit-decimal（CNY 单位集） |
| BankAccountKey | 单成员 record（primitive 成员） |
| BankPaymentResult | 单成员 record（nominal 成员） |
| BankAccountResponse | 小 record＋Option[nominal] 混合（BankCashSubmit 无 Option，开工时替换） |
| BankPendingResponse | sequence 成员（Vector） |
| BankOrderView | 最宽 15 字段 record（nominal/Option 密集） |

电池另覆盖 map 形态与跨包 FQN 形态（银行未触发、合同支持）。
fixture `test/fixtures/value-object-v1/`：input.json＝8 件派生合同＋
knowledge-products.json（对应布局/精确值切片＋options）＋（无锚跨距件——
classic 无 codeMappings，凭据即台账本身）。

## 8. 实现落位（裁定后执行）

派生层 `lib/derivation/value-object.mjs`（fail 前缀 VO_DERIVATION；类型树
解析＋exact 绑定＋包解析）＋ `lib/derivation/value-object-emission.mjs`
（withFlippedValueObjects）＋家族 `emitter/families/value-object.mjs`
（familyNumber 1，inputSchema `truthsrc.value-object-input/v1`，
provenance handwritten-golden，toolsRef null）＋ registry index 第 12 注册
＋ emitter-unification 套件 FAMILY_COUNT 12、HANDWRITTEN_GOLDEN_FAMILIES
追加＋composition-layers values 腿改家族等值。bank-wealth：一提交翻转 118
件（预期 diff＝每件去头＋FQN→短名，其余逐字节同）＋五步门＋F5 逐文件
diff 呈报。

## 9. 待裁定问题清单

| # | 问题 | 建议 |
|---|---|---|
| Q1 | 金样语义：手写 curated（提案）vs 沿 R1 复刻 | 手写 curated（§4 理由） |
| Q2 | N1 同包短名／跨包 FQN 规则 | 如提案 |
| Q3 | L1 去生成头（bank 生产件随行去头） | 去头（face 判例） |
| Q4 | L2 案类声明保持单行（不引入断行） | 保持单行 |
| Q5 | 翻转单元＝整族一提交（非按案/按聚合） | 整族 |
| Q6 | 检出＝context 清单透传其余项目 | bankwealth 清单 |
| Q7 | exact 语义逐字节保持（T2 不重排） | 保持 |
| Q8 | 受影响套件 composition-layers values 腿改家族等值 | 如提案 |

## 10. 裁定记录（2026-11-23 同日闭合）

- **Q1 已裁：手写 curated**（用户 2026-11-23 裁定，采建议案）。金样语义＝
  手写新规格（同包短名＋去头，其余逐字节保持 classic）；R1 复刻不外溢到
  限定 raw 簇——R1 前提（规则件即业务逻辑本体）在纯数据件上不成立，重排
  是 ABI 透明的（JVM 签名不变），F4 无损。bank 生产件随翻转重排文本。
- Q2–Q8 依常设委托验收标准（正确／工业生产级／优雅／Plain FP）按建议案
  执行：N1 同包短名／跨包 FQN、N2 包裹字段名恒 value（派生层显式产出）、
  L1 去生成头（face 判例）、L2 案类声明保持单行、T2 exact 语义逐字节保持、
  翻转单元＝整族一提交、检出＝bankwealth context 清单、composition-layers
  values 腿改家族等值。逐条讲解随沙箱轮呈报，如有异议逐条回滚。

## 11. 沙箱三轮实证（2026-11-23，金样 8 件手写后）

金样树 `test/reference/curated/value-object/v1/`（8 件＋technical-input.json＋
README）手写毕。自检：4 件无 nominal 引用件与 classic 去头后逐字节相同；
4 件 record 差异仅 FQN→短名。三轮：

- **R1 合同完备**（金样＝合同渲染逐字节）：抛置式渲染原型按裁定风格渲染
  8 件代表，与手写金样 8/8 逐字节相等——金样零合同外业务字节。
- **R2 ABI 编译不变量**：沙箱树 /private/tmp/vo-sandbox 全 118 件换 curated
  版后 sbt 全量编译，与 pristine 对照树**误差相等**（各恰 2 个错误，均为
  classic technical-port 渲染器既有同包重复定义，见 §12）——换件对编译
  健康零新增影响；536 源全部通过 typer 对短名引用的解析（ABI 透明实证）。
- **R3 全量 delta 纪律**：118/118 件满足「classic−头−FQN == curated 渲染」
  ——重排严格限于裁定两处，无第三种偏差。

## 12. 既有缺陷发现（非本族、非本程序引入，登记呈报）

- **事实**：bank 生成应用冷 sbt 全量编译**当前失败**，恰 2 错——
  `BankPaymentPorts.scala` 与 `BankRefundPorts.scala`（同包
  `example.bankwealth.application`）各自定义 `CompletionContext` 与
  `OperationNotExecuted`（pristine 对照树同样失败；沙箱换件树不新增）。
- **根因**：classic `scala-cqrs-application/render-technical-ports.mjs:41-42`
  无条件把这两个共享类型发进**每个** technical-port 件的 companion；bank 的
  payment 与 refund 两案均声明 technical 工件（两案知识均在程序启动前已
  存在，出现时点待考）→ 同包冲突。
- **门语义厘清**：计划 §8 五步门的 compile 步＝`truthsrc-project.mjs
  compile` → metarch `compile-project`＝**知识树编译**（truth→products），
  从来不含生成应用的 sbt 编译；故该缺陷不被五步门捕获（非门失效，系门
  语义本不含 app 级 sbt 编译）。
- **归属与修复路径**：属 technical-port 簇（finite-host-dsl 行 classic 渲染）
  的既有缺陷——该簇按计划尚未翻转，翻转时统一发射器自然消除（共享类型
  去重／共享文件）。修复不属 value-object 族门序范围；是否在程序内追加
  「app 级冷 sbt 编译」门步属程序级门变更（F 裁定域），呈请用户裁定。

## 13. 裁定记录（2026-11-23，沙箱轮后）

- **R6 先修后翻**：technical-port 同包重复定义缺陷在本节拍（value-object
  翻转）之前以独立 mini-beat 修复（独立提交＋知识门＋指纹重生成），恢复
  bank 冷编译全绿后再接翻转。修复面＝classic render-technical-ports.mjs
  共享类型去重；修复的 diff 呈报走 F5。
- **R7 追加 app 编译门**：五步门升为六步门——追加「生成应用冷目录 sbt
  全量编译」常设门步（沙箱拷贝树编译，不污染工作区）。程序级门变更
  （F 裁定域），自 mini-beat 起生效；计划 §8 命令面随收口同步。
- **Q2–Q8 逐条确认无异议**（用户 2026-11-23）：N1/N2/L1/L2/T2/翻转单元/
  检出/套件腿按已记档提案执行。

## 14. §12 根因修正与家族级裁定呈报（2026-11-23，沙箱 R2 追查）

### 14.1 根因修正（更正 §12）

缺陷**不在** classic render-technical-ports.mjs（那是 legacy scala-cqrs-application
生成器的模板，`trait <stem>TechnicalPorts`＋companion 内类型——天然无冲突）。
真实产地是**统一 face 家族 #43 的金样形状**：翻转案的 `<Stem>Ports.scala` 把
`CompletionContext`（**per-case 字段类型**：payment 案 `original:
BankPaymentOriginal`，refund 案 `original: BankRefundOriginal`）与
`OperationNotExecuted` 提升到**包级**、全部引用裸名化——单案翻转自洽，双案
同包即同名校（refund 翻转 a845fc3 起冷编译即破；此前各节拍门＝知识树编译，
不含 app 级 sbt 编译，故未暴露）。face 裁定文档从未裁定过包级提升——属
金样成样时单案视角的疏漏，非既裁定项。

### 14.2 约束链（修复设计的事实边界）

1. 手写供给（F7 冻结，在生成 build 的 Compile 集内）以**包级裸名** import
   两类型：`import example.bankwealth.application.{…, CompletionContext,
   OperationNotExecuted}`（payment/refund bindings 各一行）。
2. `context.original` 被实质使用：`require(input == original &&
   context.original == original)`＋`authority(kind, context.original, context)`
   透传给 per-case 类型参数——两案 CompletionContext 确为**两个不同类型**，
   不可合一、不可泛化去字段。
3. 同包裸名＝一 name 一 member：两个不同类型不能共用一个包级裸名。
4. bank repo 顶层 `test/scala/BankPaymentDeliveryAcceptanceSpec.scala` 的
   `Technical.CompletionContext`（经 PortBindings 限定）在现产形状下**本就
   悬空**（PortBindings 无此成员；该目录不在生成 build 编译集内）——独立
   陈旧观察，不构成本修复约束。

### 14.3 修复方案呈报（家族级裁定，不自裁）

- **方案 A（建议）——伴名空间归位**：两定义移入各案 `<Stem>Ports` 的
  companion object（沿 classic per-stem companion 判例；OperationNotExecuted
  虽两案同形，一并随伴入伴——各案 saga 只捕获本案类型，语义自洽）。
  生成件 PortBindings/HostIO/SagaDefinition 各加一行
  `import example.bankwealth.application.<Stem>Ports.{CompletionContext,
  OperationNotExecuted}`（正文裸名不动）；手写供给仅 **2 件各改 1 行
  import**（正文零改动）——**需 F7 豁免裁定**；#43 金样树随 F3 同步升级
  （Ports 件形状改＋三件加 import），发射器同步，parity 重验。
- 方案 B——per-case 包级改名（BankPaymentCompletionContext 等）＋手写
  import 行用 `{新名 => 旧名}` 重命名导入：手写同为 2 行但导入形丑陋、
  包级 vocabulary 膨胀，劣于 A。
- 方案 C——回退 refund 翻转（a845fc3）至 Phase 4 再翻：撤销已提交程序进度，
  不可取。

### 14.4 metarch 侧先行动工（value-object 门序裁定内工作，未涉 F7）

#43 修复裁定悬置期间，value-object 门序的 metarch 侧（已全裁定，Q1–Q8）
先行落成——bank 翻转仍按 R6 待 #43 先修：

- 家族 `emitter/families/value-object.mjs`（#1，handwritten-golden，
  checkInput fail-closed VO_INPUT＋20 例负测电池——不进电池债务清单）。
  合同顶层 `packages` 绑定集（跨 context FQN 规则 N1 所需）。
- 派生层 `lib/derivation/value-object.mjs`（VO_DERIVATION，转写级
  fail-closed；合同携带全量包绑定，nominal 目标可达）。
- emission 桥 `lib/derivation/value-object-emission.mjs`
  （withFlippedValueObjects：bankwealth 清单翻转＝整族单元；classic 精确
  对账替换＋孤儿件拒绝＋路径碰撞守卫；非清单项目透传）。
- 接线 play-service generate.mjs valueobject-dsl 分支；registry index 第
  12 注册；emitter 套件 FAMILY_COUNT 12。
- 金样合同以 layout 序重出（classic 产能序）；fixture＝8 代表的
  knowledge-products 切片。
- **验收**：parity allGreen 12/12（value-object 8 件金样等值＋双跑确定＋
  电池 20/20）；派生套件 9/9；composition-layers 6/6（inventory fixture
  透传——恰好钉住非清单项目不受扰行为）；**真知识全量干跑**：
  captureProject→派生 118 值→家族渲染 118 件→对 bank 现产 delta 纪律
  118/118 ✓（真模块栈复证沙箱 R3）。

## 15. 裁定记录（2026-11-23，#43 修复裁定＋执行）

**用户裁定原文**：「先提交，然后 #43 修复方案 A，给予 F7 豁免」。

1. **value-object 节拍先提交**：metarch 侧工作以 71267eb 单独闭合
  （20 文件，+3142；bank 翻转仍按 R6 待 #43 先修）。
2. **方案 A 批准**：`CompletionContext`/`OperationNotExecuted` 移入
  `<Stem>Ports` 伴名 object（classic per-stem 先例
  `render-technical-ports.mjs` 同形）。生成件 HostIO/PortBindings/
  SagaDefinition 各 +1 行同包相对 import（`import <Stem>Ports.<成员>`，
  正文裸名不动）；#43 金样树 F3 同步 5 件（Ports 件伴名化＋三 app 件各
  +1 import＋手写金样件 BankPaymentOracle.scala +1 import）。
3. **F7 豁免授予**（范围严格限定）：bank 手写供给
  `BankPaymentBindings.scala` / `BankRefundBindings.scala` 各改 1 行
  import（包组内两个裸名移出、新伴名成员导入行替换；正文零改动）。
  豁免仅覆盖此 2 文件各 1 行，F7 其余冻结面不变。
4. **修复面外发现（登记）**：bank `test/scala/
  BankPaymentDeliveryAcceptanceSpec.scala` 引用旧世代名
  `bank_payment_hostTechnicalPorts => Technical` 并以
  `Technical.CompletionContext` 限定使用——该文件不在构建内（已登记
  dangling debt），不构成修复约束，本节拍不动它。
5. **修复后门序**：parity 12/12 ✓ → face 套件 10/10 ✓ → 全量套件 →
  bank 手写 2 行（豁免）→ 显式 update 重生成（8 生成件）→ verify 12 项 →
  **R7 新冷编译门首跑**（沙箱拷贝树：pristine 基线＋修复态对照）→
  fix 提交。

### 15.1 R7 首跑发现与完成项（同日）

**R7 首跑揭示的门语义实质**：此前「恰 2 个重复定义错误」（§11 R2 记录）实为
**命名阶段中断**——重复定义让 scalac 在 name resolution 完成前中止，typer
从未跑完，其下全部类型级破损被掩盖。伴名化消除重复定义后，typer 首次完整
运行，暴露三簇：

- **A′（方案 A 自身不完整，本裁定内补齐）**：伴名化后 trait 体内的裸名
  `CompletionContext` 解析不到伴名成员（伴名成员不自动进入类体作用域）。
  补齐：trait 体首行 `import <Stem>Ports.CompletionContext`（金样同步）。
- **B（家族模块既有缺陷，R7 发现）**：`emitHost` 991/1166 行硬编码
  `BankPaymentHostIO.admit/deliver` 而非 `md.hostIo`——refund 翻转产出的
  BankRefundHost 因此跨线调用 payment HostIO。金样仅含 payment 一案，
  parity 永远抓不到。修复：改用 `md.hostIo`（payment 字节不变，parity 仍
  allGreen）。属委托验收杆内的正确性修复，随本节拍记档。
- **C（dispatch/ta 翻转 a0d958c 手写漏改，R7 发现）**：生成的
  BankTaEffectHost（effect-face 新 ABI：无 `Implementation`、typed
  `ReconcileDecision`）与手写 BankTaEffectBindings.scala /
  BankTaRefundApplication.scala（仍用旧 ABI）漂移——该翻转当时仅改 8＋4
  行，且五步门只过知识编译，从未暴露。**用户裁定：批准 F7 豁免＋由我修**
  （AskUserQuestion 同日）。修复三处（对齐 sip 侧已对齐模型）：
  `Host.Bindings` 三槽改 `Host.EffectBinding` 命名槽位；
  `input.decision != "retry"` → `!= Host.ReconcileDecision.Retry`（顺带
  消灭恒真守卫——类型不等比较使重试授权被静默禁用）；
  `TaHost.Reconcile(input, "retry", …)` → `ReconcileDecision.Retry`。

**R7 首跑全绿证据**：/private/tmp/r7-fixed 沙箱（generated/current 拷贝＋
手写副本＋重指向 build.sbt）`rm -rf target` 后彻底冷编译
`sbt "Compile/compile"` → **[success]，exit 0**（144 s）。对照树
vo-sandbox（修复前 face 文件）复证恰 2 错（重复定义）。收敛链：
旧形 2 错（掩盖全部）→ A′+B 后恰剩 TA 簇 5 处 → C 后 0 错。
全量套件 4,483 测试失败集两树（改动前/后）逐名相同 → 环境 flake，零回归。

### 15.2 value-object 翻转执行记录（R6 先修后翻，本日闭合）

- 显式 update（`generate --update`）exit 0：total 235，COVER 127＝8 face
  件（伴名化）＋118 values 件（curated 翻转）＋`.truthsrc/inputs.json`
  账本；A′+B 后再 update `written:3`（两 stems Ports＋BankRefundHost）。
- **F5 逐文件 diff 清单**：classic 渲染器复现旧字节对盘上 curated 逐件
  分类——118/118 恰为裁定两处（去头＋同包 FQN 缩短；94 件含 FQN 缩短共
  271 处，其余仅去头），零第三种偏差。
- bank 五步门：doctor ✓／validate hard 0 ✓／compile exit 0 ✓／显式
  update ✓／verify 12 项全 true ✓；加 R7 冷编译 ✓（15.1）。
- `docs/emitter-unification-plan.md` §5 value-object 行已标 ✅ 翻转；
  §8 补第六步命令。classic `valueobject-dsl` 行退役与 `render-values.mjs`
  物理删除仍按 Phase 4（legacy 生成器仍引用，F6 不动）。
