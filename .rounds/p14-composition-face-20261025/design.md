# P14 批B（第 5 门第二段）：组合面——awaitChildRun 契约 + InvocationPipelineHost + 真 monarch 0.2.1 候选 jar + 崩溃窗

冻结：2026-10-25 · 依据：批准计划（.zcode/plans/plan-session_97d04872ef77d60f9acf8f6b0ce65909.md）批B 段 · 前批：P13（fab strict 面，已全绿未提交）

## §0 首动作已决：monarch 双 jar 兼容探针 GO（2026-10-25 12:24）

- jar：`monarch-persistence/target/demo-candidate-20261021/net/imadz/{monarch-core,monarch-persistence}_2.13/0.2.1/`，sha256 与 `fab-simulator-demo/VALIDATION-0.2.1.md` 在案值恒等（core `66223d37…`、persistence `ba144dbc…`）。
- 依赖面：monarch-persistence 0.2.1 POM 钉 akka 2.6.20 全家（actor-typed/persistence-typed/serialization-jackson/cluster-sharding-typed）；fab 应用 build.sbt 同钉；探针 `evicted` 无 akka 混版。scalapb-runtime 0.11.14 与 fab 应用既有 scalapb 同版（plugins.sbt compilerplugin 0.11.14）——零新增序列化框架。
- 运行面（探针工程 `probe/`，PROBE-OK 全绿）：PROBE-1 ActorSystem 启动（ManifestInfo 不拒=无混版）；PROBE-2 `StartRun(runId, initialState)`→`Accepted`；PROBE-3 **同 runId 重发→`Rejected(runId, reason="run already in state Done")`**（reason 携带终态名——宿主「已挂接」判定依据实测成立）；PROBE-4 run 完成即 RunStarted/StageDone×2/RunCompleted 落 journal；PROBE-5 MonarchSerializer roundtrip（manifest="E1"，scalapb EventPO wire 双向）。
- jar 自带 reference.conf（monarch-proto serializer+bindings+jackson allowed-class-prefix 兼容历史 0.2 记录）——classpath 即注册，应用侧零配置。
- **裁记**：探针 journal 读通道（eventsByPersistenceId）不在探针面验收（akka 2.6.20 内建 read journal 仅 leveldb 且其初始化在本机失败）；Mongo read journal 同 API 通道已在 P11/P12 installEventSource 面验证，批B 验收 E1–E5 在 fab 应用真 Mongo 面覆盖。
- **API 面（javap 实核）**：`PersistentMonarch.behavior(pid, stages: Seq[Stage], exec: (Stage,S)=>Future[S], codec: StateCodec[S], stageName, failurePolicy: Option[...], observer: RunObserver[S])`（implicit ec）；`RunObserver.nop`；`StateCodec.stringCodec`；Command=`StartRun/ResumeRun/Checkpoint/Diagnostic`；Event=`RunStarted(runId,stageCursors,initialSnapshot)/StageDone/StageResolved/RunCompleted(runId)/RunFailedEvt/RunPlanExtended`；RunReply=`Accepted(runId)/Rejected(runId,reason)`；Diagnostic=(generation,cursor,error) 是诊断记录**非查询**——「子终态走 journal 读」定案成立。

## §一 定位与边界

- 第 5 门=EP S7：`invokeSaga`、稳定 invocation 与**有界 durable 子任务**，不以 UI 或内存 adapter 冒充 JVM 恢复。批B 补「组合面」：拆合批之间的 await-child 策略 + 生成 InvocationPipelineHost + 真 monarch 子 run + 确定性崩溃窗。
- 零库改动：saga-core / monarch-core / monarch-persistence 全不动（探针+终检 git 三净为证）。
- 组合总线=共享 Mongo journal（P11 先例）：宿主读子 run journal、自身恢复、镜像派生同一耐久底座；run-scoped db 留证不删。
- 设计管线 `fab-split-await-child-merge-design` **保持 document-only**（描述行更新指向后继，narrative-only 断言不翻正）。
- 不写共享 apps；mongo 容器 metarch-mongo 沿用 P11 授权；生成应用修复走 generator/scaffold 合法源面。

## §二 契约面（additive）

`schema/execution-ir-v1.schema.json` stepExecution oneOf 增第三判别 `awaitChildRunStepExecution`：

- `awaitChildRun`（封闭对象）：
  - `childRun`: { `planRef`（子 stages 管线引用）, `identity`: { `derivation`: `"durable-parent-step"`（父 opKey+stepId+occurrence[+chunkIndex] 派生；**禁时间/random/attempt**）, `conflict`: `"reject-different-args"` }, `payloadCompatibility`: `"exact"` }
  - `start`: `"durable-intent-before-start"`；`completionMode`: `"await-terminal"`
  - `results` 五 resultKind（与 invokeSaga 族对称，冻结释义）：`succeeded`(code ChildCompleted，outputs 携 completed wafer manifest) / `child-rejected`(code ChildRejected——StartRun 拒绝且 reason 非 already-in-state=计划不匹配，action stop fail-closed) / `child-failed`(code ChildFailed——RunFailedEvt) / `recovery-required`(code RecoveryRequired) / `outcome-unknown`(code Unknown)
  - 外围 `reads`/`writes`（writes=durable child run reference）/`outcomes` 同 sagaStepExecution 形。
- **计划原文「五 resultKind」的冻结释义**：invokeSaga 的 rejected-before-effects/compensated 在 child run 面无对应物（child 无拒绝无补偿；StartRun Rejected(already-in-state)=已挂接语义吞掉），五族重整为上述集合——语义等价对称，非范围裁剪。
- SCHEMA.md PL4 段同步（awaitChildRun 条目+execution 契约描述「Contract declaration only」保持为真）。

## §三 真源原子（example/fab-split-merge/）

1. `tree/pipelines/fab-child-process.pipeline.yaml`（新）：2–3 stage 有界子计划，fixture 语义无设备 I/O（如实注记 description）。形状=monarch 块（kind: pipeline + monarch stages 声明；monarch-dsl parse 面既有形状为蓝本）。
2. `tree/pipelines/fab-split-child-merge.pipeline.yaml`（新）：可执行组合管线——step1 `split`(invokeSaga fab-split v1，同 fab-split-invoke 面) → step2 `await-child`(awaitChildRun→fab-child-process) → step3 `merge`(invokeSaga fab-merge v1，args 只能源自 child 耐久终态+durable 初始输入)。execution 块：confirmed-prefix、durable-source-stage 身份、有界 admission（chunk 上界≥WaferSet maxItems=64）。
3. 设计管线描述行更新（document-only 不变）。
4. `execution-bindings.json` 增组合管线绑定（invocations 两 invokeSaga 步+awaitChildRun 步 childRun 绑定 monarch 0.2.1）+ child 管线绑定；`bindings.json` 不动（saga 面已在 P13 定形）。

## §四 compile/query（lib/execution/compile.mjs + 测试）

- `validateExecutionDeclarations`/compile 扩展消费 awaitChildRun：
  - child planRef 存在且为 stages 形管线；identity 派生封闭（durable-parent-step；出现时间/random/attempt 即拒）；bounded（maxItemsPerChunk≥WaferSet maxItems）；前置 requires-satisfied（split must-precede）；merge args 只能源自 child 耐久终态或 durable 输入。
  - 新诊断码 `EXECUTION_AWAIT_*` 族：`EXECUTION_AWAIT_PLAN_MISSING` / `EXECUTION_AWAIT_IDENTITY_OPEN`（非封闭派生） / `EXECUTION_AWAIT_BOUND`（上界不足） / `EXECUTION_AWAIT_PRECEDES`（前置不满足） / `EXECUTION_AWAIT_SOURCE`（merge args 引用非耐久源）。
- 负例测试（truthsrc test 面）：纯 port 替代 await / dynamic insertion / identity 含 attempt / merge args 引非耐久源——全拒。

## §五 生成器与接线

1. 新 `generators/saga-dsl/emit-invocation-host.mjs`：**InvocationPipelineHost**（per (pipelineId, opKey) 持久 actor；事件走 jackson-cbor CborSerializable 族）：
   - journal：`OperationStarted`(全输入 start-record) → `InvocationIntentPersisted(step)` → `StepCheckpointed(step, kind, receiptRef)` → `ChildProgressMirrored`(仅派生，非权威) → `OperationConcluded`；恢复=confirmed-prefix 前缀重放。
   - invokeSaga 步：intent 落盘→同 identity Start→GetStatus 轮询→terminal→checkpoint(kind+receiptRef)。
   - awaitChildRun 步：ChildRunRequested 落盘→`StartRun(派生 runId)`（Rejected(already-in-state)=已挂接吞掉续观察）→eventsByPersistenceId live 观察子终态→RunCompleted=checkpoint 携 completed manifest；RunFailedEvt=暂停 recovery-required（**补偿≠阶段恢复**，不自动补偿）。
   - 恢复路径：每未 checkpoint 步 `Attach(identity)`（saga-core 观察命令**首次生成面接线**）→终态即补 checkpoint（derived，不重执行）/非终态续候永不起二事务/ConflictingIdentity fail-closed 停；镜像永不权威，以子/saga journal 权威对账。
2. monarch-dsl 发射子计划模块入 fab 应用（MonarchSpec→PersistentMonarch Scala，既有 emit.mjs）。
3. bootstrap 增 invocation host singleton 接线（emit-strict-host strictEntries 槽扩展）；P12 persistence.conf（saga 门控）扩 monarch 子 run journal 面。
4. run-all 接线：`--saga-execution-binding` 新入参（组合管线绑定）+ monarch 双 jar → app lib/ + build.sbt unmanaged；saga jar 沿 P13 入参。
5. 验证 spec 发射：`FixtureCompositionSpec.scala`（fab 应用面，E1–E5+E-D）。

## §六 验收（fab 应用面 = target/p14-composition-face-20261025/app）

- **E1 全链**：split→child stages→merge；wafer 身份/数量端到端守恒、sources 不丢、每 pid 事件计数=无重复 effect。
- **E2 Saga 终态已存/checkpoint 未存**（saga journal 尾截断→重启→Attach 补账→saga journal 零新事件=checkpoint 丢失不重做）。
- **E3 checkpoint 已存/镜像未存**（镜像尾截断→子 journal 权威对账）。
- **E4 intent 已存/Start 未发**（截断→同 identity 补发→全库恰一 saga pid）。
- **E5 负例**：同 txId 异 args=ConflictingIdentity fail-closed。
- **E-D 物理面**：fork 双 JVM+宿主节点 SIGTERM→singleton 迁移→共享 Mongo 恢复续跑→收敛+守恒（D4 机理复用；若失稳如实登记降级单 JVM 真 journal 面，E1–E5 不降）。
- monarch 双 jar sha256 登记（§0 已核）；三库 git 全净=零改动证明；truthsrc 全量绿（新 schema/compile 测试）；金样零 diff（money 基线不触）；fab 新 digest 钉；money 12/12 惰性复跑不动。
- 诚实标记：execution 契约 schema 描述 "Contract declaration only" 保持为真——可跑证据只在 fab 应用面。

## §七 红线对照（继承全量）

补偿≠阶段恢复；不用超时推断失败；不重投未知效果；query 不偷启新执行；intent-before-start；checkpoint 丢失不重做；attempt 不作效果去重键；异步 handoff 仅显式契约（journal 观察=耐久通道+稳定 child identity）；多源合批不取 head。工程红线：不 commit/push/publish；不写共享 apps；mongo 容器沿用；金样字节恒等；digest 纪律（money ba60f58a/3a586c81 不动；fab P13 钉 9fea6196/86da085f/cd186ecb 不动，批B 新产物新钉）；run-scoped db 留存；隔离缓存不入库；不删失败证据。


## §八 实施与验收补记（2026-10-25 收口）

迭代 18 轮（编译 13+运行 5）：宿主 receiveSignal（非 onSignal/onRecoveryCompleted）、AbstractBehavior 误继承（返回 EventSourcedBehavior 的普通 class）、polling 防重守卫自锁（去守卫——GetStatus 幂等）、空 journal 首启 RecoveryCompleted 触发 state.started.get 崩（fresh-actor guard）、HOCON 不支持 + 拼接（seed 预拼）、rxmongo journal 真实形状=**per-batch 文档**（{pid, from, to, events[], v}——countJournal=events 数组求和、截断=$push+$slice——E2 Mongo 实据：宿主 journal 存活 from=1..2+from=3，saga/child/merge 三 pid 恢复后零新增）。

E5 语义实锤：saga-core 0.2 将同 identity 异 args 的 Start 折叠为返回既有终态（无独立 ConflictingIdentity reply on Start）——occupier 拒绝终态被宿主继承并 fail-closed 停止（concluded=Rejected、From 零效果泄漏）=零第二重效果的等价 fail-closed；断言按真实语义收口（原「ConflictingIdentity」字面断言翻正）。

E-D 物理面按计划降级条款如实登记未实施（E1-E5=真 Mongo journal 单 JVM 面+真截断窗；D4 failover 机理 P13 应用面已证）。
