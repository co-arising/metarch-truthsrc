# composition-invocation-host v1 — S1a′ 有界组合宿主族金样候选

> 传统清单第 42 族（strict 扩展）：一条有界组合 plan
> **invokeSaga(split) → awaitChildRun → invokeSaga(merge)** 的技术宿主——
> 组合宿主（intent-before-start、IdentityObserved→Attach 恢复、子 journal 为
> 唯一权威终态）、monarch 子计划、观察端口/适配器/装配，外加两份 suite。
> 上游＝两个 admitted wafer saga（#40 族形状手写供给）＋两个 #41 族 fixture
> host＋Lot 聚合 TCC 供给。BC 侧四份输出**从未实跑**（无金样字节），本族
> 金样按门序完整手写（合同 §9.1 的 Fab-like bounded3 profile）。
>
> 2026-11-20/21 裁定链（开工前 F1–F14 全批建议＋讲解后 G1–G4 门内涌现点）：
> **F1 供给＝monarch 0.3.0 对齐**（bank-wealth-demo `.local/truthsrc-runtime-
> 0.3.0` staged；formal CLI 同 pin；0.3.0 behavior 七显参与 raw C05 逐参吻合）
> / **F2 落点＝三层绑定**（无第四层 .composition 包）/ **F3 观察端口**（宿主
> 构造形状记档偏离）/ **F4 业务供给九件**（两模块孪生必需——同模块两次
> invoke 会共享 entry pid＋单例名）/ **F5 身份**（wafer-transfer/WaferChildPlan）
> / **F6 D3 合同面** / **F7 E5 探针驱动**（0.3.0 终态占用折叠为既有终态，
> raw 的 Rejected 断言被实证复现）/ **F8 行为门范围**（无 mongod 实证，
> Mongo 手术与双 JVM 套件编译面）/ **F9 oracle 重定目标**（snapshot 解码
> 在 0.2.1/0.3.0 均无 API——raw 投机代码被门序现形）/ **F10 H18 恒真
> 简化** / **F11 修订（用户裁定）＝算法消解**（withTimers 键控定时器＋setup 时子 actor/观察流一次性建立为不可变 val；应用树零 Defn.Var，引擎家族修订删除）/ **F12 import 面** /
> **F13 CC 重构** / **F14 发射集 7 件**。
> **G1** E3 注入窗 lot 一致性走真实 TCC 命令 / **G2** 恢复窗＝
> rejectNextPersisted 确定崩停＋同 PID 重驱 / **G3** else-if/match 嵌套
> 度量语义按引擎实测钉扎 / **G4** 上游 sha 复核性质删除，digest 复核精神
> 由 wafer payload digest 承载。

## 本族制品解决什么问题

有界组合的编排宿主：每个 (pipeline, operation, occurrence) 一个持久 actor，
驱动 split→await-child→merge 三步 plan。Journal（权威，confirmed-prefix 恢复）：
OperationStarted → InvocationIntentPersisted → IdentityObserved →
StepCheckpointed → ChildProgressMirrored（仅派生）→ OperationConcluded。
镜像子进度永不权威——子 run 自身 journal 才是；子失败使操作停止
（child-failed），绝不自动补偿父流程；超时永不推断失败：未答 poll 重试，
不判死。子计划是 monarch-persistence 的三 stage fixture run（receive/process/
finalize），父宿主经 CompositionChildJournal 端口观察其 journal。

## 范围（27 源文件进门）

- 生产 15 文件＝**族工件 5**（host/child plan/端口/适配器/bootstrap）＋
  **供给 9**（Lot 三件＋两 wafer 模块＋两 fixture host＋两 entry）＋
  **公共 1**（Id）。StrictWire 为 #41 字节复制。
- 测试 8 文件：两 suite（R/D 模板全量编译面）＋行为/结构双套件（43 性质）
  ＋Cases/Oracle/Fixture。
- 质量骨架 4 文件＋政策/清单/输入/payload。

## 关键合同点（裁定状态）

| 项 | 状态 | 一句话 |
|---|---|---|
| F1 供给 | ✅ | monarch 0.3.0＋core staged；闭包 141 坐标（+scalatest 家族＋scala-xml） |
| F2/F3 端口拆分 | ✅ | 宿主零 journal 细节；适配器在 infrastructure；测试绑定 testkit read journal |
| F4 供给 | ✅ | Lot TCC＋两孪生模块＋两 host＋两 entry；孪生等价性质钉住 |
| F7 E5 | ✅ | 0.3.0 终态占用折叠复现 raw 语义（Rejected＋零泄漏） |
| F9 oracle | ✅ | 游标 face＝receive#0/process#1/finalize#2；snapshot 解码删除（无 API） |
| F11 修订 | ✅ | 四 var 槽算法消解（PollTick/子 actor val/观察流 val）；应用树零可变槽，引擎零家族修订 |
| G2 恢复窗 | ✅ | rejectNextPersisted 确定崩停＋同 PID 重驱；Attach＋授权 Reconcile 到 Succeeded |

## 行为合同（ScalaCheck 实测，43 条；31 行为＋12 negative:）

- **子计划面**：StartRun→RunStarted＋三游标＋RunCompleted、codec 往返＋
  frozen wire 形、live-run key 拒收（already in state）。
- **lot TCC 面**：真 sharded 实体上 reserve/commit、拒绝不落标记、缺预约
  commit 拒收、逐 txid 四效果过滤。
- **身份派生**：txid/childRunKey/childPersistenceId/persistenceIdFor 稳定且
  occurrence 域定；singleton 名＝PID 的 sha-256 组合前缀；TestHooks 默认放行。
- **真实 cluster 流**：全链 AllStepsSucceeded＋lot 守恒、trace（intent 先于
  checkpoint、child checkpoint 先于 merge intent）、每 saga Started 恰一＋
  逐 saga 恰四 TCC 事件、Begin 双拒、E4b 栏栅（saga/child journal 零事件）＋
  崩停重驱、E3 注入窗（lot 侧效果经真实 TCC 落库）、E2 Attach＋授权
  Reconcile（Attach 不开第二事务）、E5 占用终态、PostStop stopped 钩子。
- **结构/引擎元**：树布局、wafer payload digest vs 模块常量、模块孪生、
  import 白名单（monarch 恰三文件/strict 运行时面/域零机制）、F11 恰四槽、
  端口依赖面、引擎计数语义、分层违规负例、收据 pin 合同锁定、args codec
  五槽 canonical 框架、两 suite 入口面登记。

## 质量状态

- 沙箱三轮（discovery `-01` / final-bytes `-02` / 同字节复跑 `-03`，均
  QUALITY_EXECUTION_COMPLETE）：两段编译＋度量门（27 文件 2222 scope
  0 violation 0 excess；16 行闭式例外＝引擎 6＋R/D 模板成员 10）＋43 性质
  三 seed 全过；prepared pin `ae52e6b4…` 三轮逐字节等值（零漂移）。
- bundle sha `2d82a60f…`（41 件 payload，6,524,020 字节）与讲解裁定
  （F1–F14＋F11 修订＋G1–G4，2026-11-21 全批）见 manifest/review-status。

## JS 生成器（字节比对验收）

`tools/gen-composition-invocation-host.mjs`（输入合同
`truthsrc.composition-invocation-host-input/v1`，fixture
`test/fixtures/composition-invocation-host-v1/input.json`）：同一输入重现
七件族工件**逐字节**（端口 1285 / 子计划 3037 / Mongo 适配器 1983 / 装配
847 / 组合宿主 30854 / R 套件 31467 / D 套件 27067 字节，produced sha256 =
golden sha256 逐文件相等），双跑确定；40 条 fail-closed 负对照（schema 版本/
非法符号/计划步数/await 位次/非法 step id/六字段表/op- 派生前缀/两 pid 前缀/
非正时序/检查点键缺失/阶段数与三变换/1..8 界/子计划状态形/端口信号与映射表/
offset 0/触发器六槽与 to←from 换向/child-wafers 源/终态映射面/prepare-confirmed
规则/sys-error 面/四钩子/套件 db 前缀与命名空间/种子资金/游标-阶段链一致/
两崩溃模式/部署前缀/打印标签/E0 探针批/E6 标签数）全部拒收。全部名字、
包面、字段表、状态字段、派生格式、码串、护栏/日志消息、阶段链、事件映射表、
时序常量、窗口表、配置键、db 前缀、打印标签与期望值出自输入合同——发射器
只冻结逐处记档的排版形（多参声明的冻结行拆分表、96/100 列打包、CJK doc
手工平衡断行、D 模板证据文件名与 JSON 键等模板力学）。

## 沙箱门家族修订（本族登记）

- 沿用 #41 的端口限定 25551 loopback 规则（SBPL 数值 IP 过滤不可用实证）
  与 2400s 墙钟、420s properties 上限、`-Dquality.candidate`。
- 新增供给坐标：monarch-persistence/core 0.3.0（staged）、scalatest 家族
  九工件＋scala-xml（缓存）。离线保证保持：全部坐标本地缓存或 staged。
