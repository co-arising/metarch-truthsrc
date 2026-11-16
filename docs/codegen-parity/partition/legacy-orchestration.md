# legacy-orchestration 逻辑制品分区合同

状态：**content-specification**。本片段仅编制分类、construct 所有权和目标落点；未运行应用、CLI、生成、编译、测试、typecheck或服务。未修改生成器、目录账、基线、作者树、生成应用、ledger或anchors。计数不是 parity-PASS / behavior-PASS。

## 范围与数字

本组仅包含 `ddl-dsl`、`monarch-dsl`、`policy-dsl`、`projection-dsl`、`saga-dsl`。

- producer **5**；catalog producer-output **38**（1 + 2 + 8 + 10 + 17），全部有精确 `catalogCoverage → logicalOutputs`。
- logical rows **70**：A **31**，B **39**。包含附加中间/闭包写出，不等于文件数、125类别数或Scala族覆盖率。
- 组内发现 **5** 条 parser JSON 写出；另记 **7** 条关联 run-all 写出，交中央与 run-all/scaffold分区去重，不声称全catalog缺失。
- 实读/引用 **54** 个固定源码文件；完整字节数与 SHA-256均对到原852文件 [`baseline/index.json`](../baseline/index.json)。全读的producer/renderer与按范围读的共享入口/Scala参考分别标明。没有额外源码或补充快照，`extraSources=[]`。

机器账在 [legacy-orchestration.json](legacy-orchestration.json)。每行都有真实路径表达式、源码符号与行区间、construct/RHS范围、目标文件、唯一组装owner、fixture条件、依赖和未决项；无“其它代码”兜底。

## 银行选择与可达性

[银行固定配置](../baseline/bank/truthsrc.project.json) 278–298行选 **scala-cqrs-play-service**，不是这五个legacy producer。其 [generate.mjs](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 16行明确调用 `createEffectRegistry('2')`，经 [produce-effect.mjs](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs) 6–26行继承 [applicationRegistry](../baseline/js/generators/scala-cqrs-application/produce.mjs) 17–30行。该完整registry没有本组五个ID，故全部 **not-selected**。family候选在 [registeredProductProducer](../baseline/js/lib/products/generate-cli.mjs) 92–102行独立登记，并非自动被银行继承。

DDL/Monarch/Policy/Projection的简略manifest只指向CLI `emit.mjs`；缺少core `inputSchema/products/artifactKinds/output`，不能当作core `generate(ctx)`可用producer。Saga manifest则有真实 `generate(ctx)`，支持显式legacy与strict-contract；**strict-scala即使合同编译成功仍无条件throw**（`generate.mjs` 140–145行）。辅助 `run-all` 的strict/composition路由是另一入口，不能以helper源码存在解除该封禁。

`core.applyEntries`的ledger/anchors writer也会服务其它producer；共用writer不代表Saga被银行选中。源码存在、入口可调用、配置选择、落盘、真实运行这五层证据严格分开。

## 核心A/B拆分

### 1. Monarch：一个物理文件，四个B职责

[emit.mjs](../baseline/js/generators/monarch-dsl/emit.mjs) 19–101行同时生成stage ADT/chain/stable label/interpreter、纯运行State、Play JSON StateCodec、PersistentMonarch委托宿主。

目标分别为 `app/<basePath>/application/services/transactor/<Run>Plan.scala`、`<Run>State.scala`、`infrastructure/persistence/converters/<Run>StateCodec.scala` 和 `<Run>Host.scala`。同一 `monarch-file-assembler` 负责头/package/import归并以及搬出codec后的引用；解释器拥有Future/ExecutionContext，宿主拥有Actor/observer依赖。它没有实现Monarch引擎，也不是domain Entity或Actor Protocol族。

parser缺stageLogic时只发TODO注释；run-all只取非空`stages`，不会自动消费formal `execution IR.steps`。这里的standalone计划不能与另一个`emitMonarchPlan`的固定wafer子计划合并。

### 2. Policy：纯参数与Actor投递不可混为一族

[领域策略](../baseline/js/generators/policy-dsl/emit.mjs) 是 `Event → List[RuleParams]`；`CmdPolicy.Command`只是参数alias，不含ActorRef。它们列B，不复活不在42族内的旧Scala Policy。

`Mechanics`才做typed sharding ask；generated handler装配decode/decide/execute/dispose/bury，属于B命令投递，不是JDBC读模型fold。`PolicyMachine`是Future管线，`FailureVerdict`是纯ADT，`DlqBury`是SQL副作用，分别有具体目标；DLQ建议移到 `infrastructure/persistence/projection/DlqBury.scala`。

**真实缺口**：Mechanics返回`Future[Either[Error,Unit]]`，Machine却在`Future.traverse`后忽略所有返回值，只对failed Future作recoverWith。业务`Left`不会进入dispose。永久失败DLQ写失败仍返回Done也不是“已可靠留痕”。两项都要先固定处置/offset语义。

A仅登记有真实经典职责对应的source/provider/runner（`projection`）和ShardedDaemonProcess启动（`bootstrap`）。atLeastOnceAsync不能为了像raw exactlyOnce而改义。四个静态短事件名MANUAL handler当前确实生成，但Runner未引用；建议冻结到 `test/fixtures/legacy-policy-transcriptions/<Handler>.scala`，先审外部引用，不擅自抹掉旧幂等例外。

### 3. Projection：read-model类别并不等于DTO职责

standalone `read-model` 实际是Projection运行装配，归A `projection`，分single/composite/M3-primary；M3只发primary，不等于全多源。其per-event handler即使有refCode也始终 **MANUAL ???**（emit 293–338行）。raw classic单工程handler也有placeholder，这不构成JS通过。

[smviews](../baseline/js/generators/projection-dsl/smviews.mjs) 有独立复制的single/composite和真正逐source的multi分支，不是继承同一renderer；不合并catalogRefs。图方言可翻译子集保留A handler；vector handler拆成A I/O壳与A `projection-apply-event` 行构造/删除键，Await/仓库写仍归壳；lookup/prose/manual/重复key等显式残余仍是A缺实现。

[viewrepo](../baseline/js/generators/projection-dsl/viewrepo.mjs) 的`ViewRepository.scala`拆为A接口、A `ViewTable.View` DTO和B `info.structure`子文档。前两项本就在raw ProjectionRepositoryTemplate职责内；子文档建议 `application/projection/repository/<View>Documents.scala`。统一owner保有trait/companion/字段/doc/DI/import/初始化全部内容，不能只挑接口而漏掉DTO。单工程raw `@ImplementedBy`反向依赖也明确是三层规则例外，不当金样借口。

SQL/Mongo/graph/vector实现都归A `projection-repository-implementation`：实际raw模板/构造依赖有这些存储职责，而不是按category把图向量挪B。SQL主表+list子表事务、Mongo typed BSON与kind/毒行、GraphMutationExecutor Strict、vector先embed再upsert和rowToView都在construct账。`mergeLinkTolerant`真实未实现；SQL独立DB.localTx不等于复用Projection session，图/向量I/O更不能据exactlyOnce字样宣称端到端恰一次。

SQL DDL与Mongo索引常量是B，目标分别 `conf/sql/view-tables.sql`、`infrastructure/persistence/mongo/MongoViewIndexSpec.scala`。常量不等ensureIndex已执行。未知storage.kind、无tenant仍发分页、DTO struct optional与Mongo codec不一致、部分SQL读取类型与`rsBigDecimal`符号均保留具体未决。

### 4. Saga：classic、strict扩展、测试与证据分开

legacy Scala不是“合同报告”。[emitLegacySagaSpec](../baseline/js/generators/saga-dsl/emit.mjs) 158–225行拆为A `saga-definition`（包括Args/Format）、A `saga-context`、A `saga-participant`内联三相位绑定和B受信`prelude/helpers`源槽。raw使用AskParticipant/PhaseAsk，JS使用SagaStep.builder；raw Context是case class、JS是RecipientRef trait；raw有runner/返回definition的register，JS无runner/Unit register。API接线差异不能靠字符串存在抹平。所有共享头/import/声明/辅助初始化由`legacy-saga-file-assembler`独占编排。

strict-contract三个JSON分别保留whole contract、step×phase表、pointer/source消费记录，都是B；固定`contract-only/runnable=false/runtimeBindingVerified=false`。它们与core最终生成ledger不是一个制品。

`run-all`真实strict源码对应三个**单列扩展**，不是39族或products金样：

- A `strict-saga-module`包含typed Args/Input/Receipt、Host接口、pin/identity校验、前序receipt读、trigger/completion映射和StrictParticipant/behavior装配；纯Input/Receipt不注入ActorRef。
- A `strict-fixture-host`包含types别名、wire/args/money codec、FixtureHost及Entry/authorizer。raw money把StrictWire和MoneyCodec合文件，JS独立文件；raw collection有严格UTF-8和0..64边界，JS缺少这些拒绝。JS host所有phase取faces[0]，而raw按faceBase；这仍是A差距。
- A `composition-invocation-host`包含持久化host与child plan：意图先持久再发Start、IdentityObserved/Attach、child journal权威、confirmed-prefix、poll/killSwitch/PostStop；JS固定Fab/Lot和两字段child state，raw更model-driven。child失败不是Saga补偿或阶段恢复的同义词。

生成安全/恢复/部署测试全列B，即使出自扩展模板。目标为 `test/<basePath>/application/services/transactor/`，不写生产包第四层。Composition部署大文件进一步拆Facts、Node、Suite并保持一个测试assembler：共享journal证据与原子JSON写归Facts，owner/successor角色归Node，ProcessBuilder/SIGTERM/wait/reap/日志与临时DB归Suite。money四模板保持P19–P22原有独立断言，不把固定CreditBalance/错误码描述为任意银行业务生成能力。

## 基准与目标例外

只使用 [scala-artifacts.json](../scala-artifacts.json) 的39传统族加3扩展。未将`template/products/*`、Node后处理、scaffold、人工golden或历史产物当成raw模板。分区定位不替代逐Model/Builder/Template深度diff。

原始Scala同样有FQN、MANUAL、代码字符串槽、@ImplementedBy反向依赖，ApplyEvent.ts甚至含取当前时间；不宣称其全部纯净。目标服从 [三层与OO/Plain FP规范](../layout-and-style.md)：source names可规范化，业务ID、operationId、PID、cursor、PB字段/manifest、codec pin、名义类型、金额精度/overflow和独立oracle不可顺便改变。

B每行都有明确物理位置/责任/fixture/rules；A有传统或扩展精确职责。所有测试fixture状态均 `specified-not-executed`，复杂度 `not-measured`。

## 未入本组catalog的真实写出

1. 五个parser各有JSON写出：DDL/Projection共用完全相同的直通逻辑，Monarch专有spec、Policy旧单policy spec、Saga strict IR/legacy spec。它们应在owned scratch，不是第二作者真源。
2. 关联run-all三个临时spec、runtime JAR复制、build.sbt版本附加、serialization.conf复制、persistence.conf写出，共七项另记。writer确为run-all，不冒称saga manifest输出。全catalog跨组去重交中央处理。
3. `anchors.mjs`独占临时文件是同一index的原子提交载体，不计第二份永久anchor；生成测试未来日志/JSON/DB写入是测试副作用，不误计已经执行的generator结果。
4. run-all注释仍说Java fallback=on，但实际固定serialization.conf是off；以真实内容为准。此文没有改serializer绑定，也未读取/运行所指JAR。

## 可读业务路径与未决交接

教学路径可读为：事件发生 → 纯Policy产参数 → Mechanics typed ask → Actor持久化回复；读侧另行事件源 → handler → 技术仓库。两者不是同一个事务。组合fixture则为split Saga → child Monarch → merge Saga，各自journal与恢复责任分明；它不是银行现役选择的证明。

落地前需分别裁定：policy输入契约与Left/DLQ处置；读侧placeholder/事务session/结构化codec；classic participant与runner/API；strict多聚合face、集合wire拒绝、fixture硬编码准入；迁包的名称/FQN/codec/anchor兼容。7条run-all关联写由集成者去重。文档覆盖未决为零，以上实现/接口未决没有被计数掩盖。**本轮无任何新运行验证。**
