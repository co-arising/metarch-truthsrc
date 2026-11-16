# aggregate-root — 聚合根接线与分片标识

## 1. 范围、状态、基线

- Artifact：`aggregate-root`（传统模板族 #6）；状态：`decision-required`。本文是内容规格，不是 implemented/parity-PASS/behavior-PASS。
- 调度：[CQRSApplicationGenerator.scala L603–658](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L603)：`app.aggregates.foreach` 每个聚合发一个 root；`metaCategory` 只影响归属账，不改变这里的 builder。普通输出为 `app/<base>/application/aggregates/<Base>Aggregate.scala`。`base` 是包转目录；物理源码根由 writer 决定。
- 原始 Model / Builder / Template：[AggregateRootModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateRootModel.scala)、[AggregateRootBuilder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRootBuilder.scala)、[AggregateRootTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateRootTemplate.scala)。三者全文为固定输入，不以 `template/products/*` 代替。
- 人工参考：[CreditBalanceAggregate.scala](../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceAggregate.scala)；银行现状：[同名 application 文件](../baseline/actual-js/app/example/bankwealth/application/aggregates/CreditBalanceAggregate.scala)。两个 CreditBalance 不是同一业务输入；下面是**结构性对照，非同输入字节比较**。
- root 不定义业务 Commands/Replies，不定义普通聚合 Events/State，不负责 factory、repository 或 event-sourced bootstrap 的实现。

## 2. Model 全字段及 Builder

`AggregateRootModel` 构造顺序为 `selfType: TypeRef, commandFamilyType: TypeRef, stateType: TypeRef, eventType: TypeRef, behaviorObject: TypeRef, sharding: ShardingModel, inlineEvents: Seq[EventModel] = Nil, inlineState: Option[StateModel] = None, stepsFactory: Option[StepsFactoryModel] = None, contextType: Option[TypeRef] = None, dependencies: Set[TypeRef], noteIds: Seq[String] = Nil`。继承 `ArtifactModel`；`registerTo` 仅委托父实现，不额外注册嵌套类型。

同文件子模型全部覆盖：

| 模型 | 字段顺序、默认值 |
|---|---|
| `CommandFamilyModel` | `name: String, commands: Seq[CommandModel], superTypes: Seq[TypeRef] = Nil` |
| `CommandModel` / `CommandReplyModel` | `name: String, fields: Seq[FieldDef], superTypes: Seq[TypeRef] = Nil`；实际发射属于 protocol |
| `ShardingModel` | `typeKeyName: String, taggingBaseName: String, shardCount: Int` |
| `StepsFactoryModel` | `methodName: String, parameters: Seq[FieldDef], participantInstantiations: Seq[ParticipantInstantiation], steps: Seq[SagaStepModel], contextType: TypeRef` |
| `ParticipantInstantiation` | `name: String, participantType: TypeRef, constructorArgs: Seq[String]` |
| `SagaStepModel` | `stepName: String, participantName: String, prepareCmd/commitCmd/compensateCmd: Option[TypeRef], phase: String = "PreparePhase", maxRetries: Int = 0` |
| 外部 `StateModel` | `name: String, fields: Seq[FieldDef], selfType: TypeRef` |
| 外部 `EventModel` | `name: String, selfType: TypeRef, fields: Seq[FieldDef], superTypes: Seq[TypeRef] = Nil` |

后两项见 [DomainEntityModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/DomainEntityModel.scala)。`FieldDef`/类型签名由 [TypeSystem.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala) 承载；参数默认值是源码字符串，不是结构化业务表达式。

Builder 实际步骤：

1. `pkg = ctx.layout.application.aggregates.root`；`aggregateRoot(meta.name)` 通过集中 naming 去已有后缀，再得到 `<Base>Aggregate`。
2. **显式引用解析** `entityState(meta.stateRef)`、`eventFamily(meta.eventFamilyRef)`、`entityBehavior(meta.behaviorRef)`；不是拿聚合名字符串替换推导所有类型。
3. `commandFamily(meta.commandFamily.name)` 经 symbol table 解析到 Protocol 内部类型；缺 owner 时有 fallback，不能把 fallback 当成功的标准输入。
4. `persistenceConfig.tagging` 只接收 `ShardedTags(baseName, numberOfShards)`；其它 tagging 抛 `IllegalArgumentException("Unsupported tagging strategy or missing baseName")`。`entityTypeKey` 来自 persistence 配置，不是强制等于类名。
5. 依赖为 state/event/behavior 的递归依赖，command-family 及框架 `Effect`、`EntityTypeKey`；behavior 收集写了两次但 Set 消重。经 `shouldImport(pkg)` 过滤。`noteIds = meta.noteId.toSeq`。
6. 普通 builder 显式给 `inlineEvents=Nil, inlineState=None, stepsFactory=None`，`contextType` 用默认 None；所以下面的模板历史分支不能冒充这条 builder 会生成的业务体。

共享支撑固定源：[PackageLayout](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala)、[NamingConventions](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala)、[TypeResolverDSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L233)、[GeneratorContext](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala)、[ArtifactModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala)、[CodeGenerationDSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala)。

## 3. Template 构造、RHS 与变体账

输出顺序：package → imports → 无父类 object → Commands/Replies 已移到 Protocol 的两条注释 → optional inline state/events → optional step factory → wiring → sharding。无主/辅构造器、annotation、self-type、var、lazy 或 implicit；type alias 的 owner 是 Protocol。

| construct / 条件 | 完整内容规则与 RHS |
|---|---|
| imports | `dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct`，每行一个 import；普通 builder 因而可能带未使用的 Effect/State/Event，人工参考已精简，不能说两者相同 |
| 普通 wiring | `def commandHandler: <commandFamilyType.packageName>.<commandFamilyName.replace("Command", "CommandHandler")> = <behaviorObject.name>.apply`；原模板返回类型是 FQN，不是已完全规整的 import 风格 |
| 普通有效 sharding | `val entityTypeKey: EntityTypeKey[CommandFamily] = EntityTypeKey("<typeKeyName>")`；随后 `val tags: Vector[String] = Vector.tabulate(shardCount)(i => s"<taggingBaseName>$i")`；不启动集群、不选 tag、不持久化 |
| 普通 null fallback | 当 `sharding == null` 或 `typeKeyName == null`，只发 `EntityTypeKey("<commandFamilyType.name>")`，不发 tags。属于模板可调用面，不是标准 builder 产物 |
| Saga suffix 分支 | 判断 **`selfType.name.endsWith("SagaTransactor")`**，不是 `inlineState.isDefined`；发 `apply(id: String, coordinator: akka.cluster.sharding.typed.scaladsl.EntityRef[net.imadz.infra.saga.SagaTransactionCoordinator.Command], sagaContext: Context): akka.actor.typed.Behavior[CommandFamily] = BehaviorObject.apply(id, coordinator, sagaContext)`；缺 contextType 则用 `Any`（历史缺口，非推荐目标） |
| Saga sharding | 只发 `entityTypeKey`，直接读取 `model.sharding.typeKeyName`，不经普通 null guard，不发 tags |
| `inlineState.isDefined` | `sealed trait <eventType.name 或 null 时 TransactionEvent> extends CborSerializable`；按 `inlineEvents` 输入序发 case classes，字段用 identifier、signature、默认源码串；忽略 EventModel 的 superTypes/selfType，统一继承该事件族 |
| inline status/state | `sealed trait Status extends CborSerializable`；同一 object 内依次 `New, Initiated, Prepared, Completed, Failed(reason: String)`；state case class 的字段后追加 `status: Status = Status.New`；继承 CborSerializable；`applyEvent(event): State` 带 AI_PROMPT 后 `???`；companion `empty(id: String) = State(id = Some(id))`。该写法假定已有 id/defaults，空字段还能产生前置逗号，不宣称适用于任意 state |
| `stepsFactory` 存在 | `def <methodName>(<parameters>): List[SagaTransactionStep[iMadzError, String, <contextType.name>]]`，AI_PROMPT 后 `???`。**participantInstantiations / steps / phase / maxRetries 并未被模板消费**，不能把模型有字段说成编排已实现 |

Saga v3 的独立 root 在其它模板族；这里仅登记历史模板分支，不复制、重建或扩张 v3 runtime。

## 4. JS 四层对照及具体 diff

| lane | 固定源、当前内容 | 处置 |
|---|---|---|
| formal model/builder | [build-aggregate-models.mjs L4–41](../baseline/js/generators/scala-cqrs-play-service/build-aggregate-models.mjs#L4) 由 reference-layout 枚举聚合，收集 commands/external producers，`authority = external.length > 0`，没有 ShardingModel；root 甚至记为 `kind: aggregate-behavior` | adapt，拆正逻辑 artifact kind，不以一个 role 混淆 root/behavior |
| formal template | [aggregate-factory.mjs L1–16](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-factory.mjs#L1) 的 `aggregateTemplate` 接 `hosts` 和条件 `authority`，返回 `behaviors.XBehaviors(hosts[, authority])`，无 key/tags | split；root 不再由 factory 文件共同拥有 |
| formal 调用/输出 | [generate.mjs L16–24](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16) → [renderAggregateLayers](../baseline/js/generators/scala-cqrs-play-service/render-aggregate-layers.mjs#L20)；[aggregateNames](../baseline/js/generators/scala-cqrs-play-service/aggregate-names.mjs) 同时保留 domain legacy wrapper | formal 有接线体，不是“完全缺 root” |
| legacy | [aggregate-dsl/render.mjs L908–941](../baseline/js/generators/aggregate-dsl/render.mjs#L908) 已发 key/tags + wiring；tags 硬编码 `Vector.tabulate(1)(i => s"${objName}Tag$i")`，handler 可捕获 fold ports，protocol 名固定 CommandFamily 后缀 | 可复用结构，不能复用固定 tag 数或反向套进 formal 银行业务 |
| family | [aggregate-core build-models](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs)、[templates/aggregate.mjs](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/aggregate.mjs) 有命名/类型结构模型，但 root 内直接 dispatch GetState/Execute、decide/persist/thenReply，没有独立 behaviors，也没有 sharding；该 family 拒绝 external producers | not-wired；复用解析/依赖思路，不是 formal 的直接替代品 |

以下 minus 为真实银行文件（只省略 generated header），plus 为真实人工参考；不把人工例子的无 hosts 解释成银行可删除 hosts。package 的变化用于表达来源与层级，不是要求银行改用 `net.imadz`。

```diff
--- actual-js/app/example/bankwealth/application/aggregates/CreditBalanceAggregate.scala
+++ curated-scala/net/imadz/application/aggregates/CreditBalanceAggregate.scala
@@
-package example.bankwealth.application.aggregates
+package net.imadz.application.aggregates
 
-import example.bankwealth.application.aggregates.CreditBalanceProtocol.CommandHandler
-import example.bankwealth.domain.CreditBalanceComputations
+import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
+import net.imadz.application.aggregates.CreditBalanceProtocol.{CreditBalanceCommand, CreditBalanceCommandHandler}
+import net.imadz.application.aggregates.behaviors.CreditBalanceBehaviors
 
 object CreditBalanceAggregate {
 
-  def commandHandler(hosts: CreditBalanceComputations): CommandHandler =
-    behaviors.CreditBalanceBehaviors(hosts)
+  // Command Handler
+  def commandHandler: CreditBalanceCommandHandler = CreditBalanceBehaviors.apply
+
+  // Akka Sharding Configuration
+  val CreditBalanceEntityTypeKey: EntityTypeKey[CreditBalanceCommand] = EntityTypeKey("CreditBalance")
+  val tags: Vector[String] = Vector.tabulate(5)(i => s"credit-balance-$i")
 }
```

人工参考的 `CreditBalanceEntityTypeKey` 与 raw 的 `entityTypeKey` **名字不同**；工厂、repository、bootstrap 必须一致选择，不能混用。目标普通成员采用 lowerCamelCase（建议 raw 的 `entityTypeKey`），人工值名属于须明确批准的例外，不偷偷“修正基线”。key 字符串、tags 前缀/数量影响运行行为及读侧消费，不是格式差异。

## 5. 胶水与实现槽

- `akka.cluster.sharding.typed.scaladsl.EntityTypeKey.apply[Command](String)`：Akka typed sharding 的实体类别标识；与 repository 的 `entityRefFor`、bootstrap 的 `Entity` 注册必须同一个 key。
- `akka.persistence.typed.scaladsl.Effect[Event, State]`：Protocol handler 函数结果；root 本身不调用 `persist`，不得在这里添加副作用。
- 业务生成依赖：`<base>.application.aggregates.<Base>Protocol.<CommandHandler>`、`<base>.application.aggregates.behaviors.<Base>Behaviors.apply`。银行 hosts/authority 是真实参数依赖，迁移后需保留经命名解析的 typed port，不置换成 `Any`/字符串 dispatcher。
- 历史 inline 分支要求 `net.imadz.common.CborSerializable`、`net.imadz.common.CommonTypes.iMadzError`（[common 固定源码](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala)），以及 SagaTransactionStep/coordinator/typed Behavior；普通 root builder 并未为所有历史 inline 内容补全依赖。`???` 是未完成槽，不得发 fake success。
- 此处有框架源/生成源能确定源码 API；所消费 Akka/common/Saga JAR 的精确可用接口及版本仍须后续核实，不以 sibling 源码替代 artifact 证据。

## 6. JS 实施写集合与 owner（本阶段均未修改）

- adapt `generators/scala-cqrs-play-service/build-aggregate-models.mjs`：root 增加解析后的 wiring/sharding 结构；显式报不支持 tagging，保留 authority/hosts 的实际依赖。
- proposed `generators/scala-cqrs-play-service/templates/aggregate-root.mjs`：唯一 root 文件组装 owner；从 `templates/aggregate-factory.mjs` split `aggregateTemplate`，后者只拥有 factory。
- adapt `generators/scala-cqrs-play-service/render-aggregate-layers.mjs` 的 role dispatch；迁移 root 的 kind、dependencies、source/codeMappings，不在此自行发 header 或写文件。
- `aggregate-names.mjs`、公共 names/type/layout/writer/registry 由集成者统一修改；本组只提供路径与类型需求。
- 与 protocol/behavior/factory/bootstrap/repository 作为一个迁移闭包退役 domain wrapper 的 root/factory；不能先删 domain Request carrier 再留下 aliases。每个旧 FQN/path 的回锚迁移须保留知识身份，不按新名字反查。

## 7. 验收与具体未决项

**全部未运行。** 后续授权后，用同一聚合 metadata（显式 state/event/behavior refs、ShardedTags、reply 声明）分别进入 raw Scala MBT 和新 JS 模型，完整文件对账；人工 golden 另做批准覆盖，不把两者拼成一个不存在的金样。命令形状为 `diff -u <同输入Scala输出绝对路径> <同输入JS输出绝对路径>`（只读）；运行接口检验应在独占 fixture 执行 `sbt compile`/`sbt test`，会写构建缓存，需另授权。本次没有运行这些命令。

逐项要求：全部 construct/RHS、模板历史分支可达性、key/tags 精确值、无循环 owner、正常 imports、PascalCase 类型/lowerCamelCase 成员、应用根仅 domain/application/infrastructure 三业务层（其它框架目录由总体布局合同处理）、稳定重复生成、code anchor 的 split/move 对账。普通方法 CC≤5；>10 拆解或逐方法认可例外，不靠 String/Any 分派压分。

未决项：

1. key **值名**采 raw `entityTypeKey` 还是人工 `CreditBalanceEntityTypeKey`；值内容/tag 数必须由银行 deployment/persistence 真源给出，不能照搬 5 或 legacy 的 1。
2. 银行是否采用 cluster-sharding runtime profile，以及现有 unique-id persistence 身份如何迁移；这不是 root 加两行即可实现。
3. raw root 无参 handler 与银行带 hosts/authority handler 选定的 typed 接线契约；不删真实依赖来追求文本相似。
4. 历史 suffix-Saga/null/inline/steps 分支是明确支持还是拒绝；支持时需完整模型、所用 runtime API 和业务算法，不准启用 `Any`/`???` 的假完成路径。

额外源需求：本次未读取固定基线外生产源。后续需要选定消费 JAR/解析报告，以及银行 key/tag/persistence 身份与 hosts 装配配置；不是缺少已在 baseline 中的 root/helper 框架源码。
