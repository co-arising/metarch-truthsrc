# projection（27，source/provider/runtime 装配）内容规格

## 1. 范围、状态与来源

Artifact id `projection`；状态 `decision-required`。基准是传统 Scala Akka Projection + ScalikeJDBC；不是目前银行 custom per-PID journal runtime/JDBC，也不是仅因新 family 输出 kind=`projection-runner` 就建立 exact 对应。

完整固定 [ProjectionModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/ProjectionModel.scala)、[ProjectionBuilder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/ProjectionBuilder.scala)、[ProjectionTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionTemplate.scala)，版本见 [inventory](../scala-artifacts.json)、[index](../baseline/index.json)。[人工月度 Projection](../baseline/curated-scala/net/imadz/application/projection/MonthlyIncomeAndExpenseSummaryProjection.scala) 与 raw 分开比较。

[CQRSApplicationGenerator L855–905](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L855) 对每个 infra.projections：build 一次→有 applyEvents 才发 ApplyEvent→发 Projection→遍历嵌套 handlers 逐个发 handler。每投影一个 `<model.selfType.name>.scala`，**不自动补 Projection 后缀**；多聚合仍一文件，内含 per-source 方法/私有 class。空 handlers 时 Template 的 `.head` 直接失败，不存在已实现的零事件空壳。

单项目 `app/<business-base>/application/projection/<View>.scala`；multi 为 `modules/glue/src/main/scala/<business-base>/application/projection/<View>.scala`。glue 是源模块不是业务包。业务 base 下只有 domain/application/infrastructure，normal imports、PascalCase 类型/lowerCamelCase 成员优先于历史 FQN/重复 import。

## 2. 全部 Model 字段与依赖

全部按源码构造器顺序，未标默认即必填。

| Model | 字段 |
|---|---|
| `ProjectionModel` | `selfType:TypeRef, sourceAggregate:TypeRef, sourceProtoEventType:TypeRef, repository:TypeRef, handlers:Seq[ProjectionHandlerModel], dependencies:Set[TypeRef], aggregateSources:Seq[ProjectionAggregateSource]=Nil, noteIds:Seq[String]=Nil, applyEvents:Seq[ApplyEventFunction]=Nil, identityScheme:Option[String]=None` |
| `ProjectionAggregateSource` | `aggregate:TypeRef, protoEventType:TypeRef, handlers:Seq[ProjectionHandlerModel]` |
| `ProjectionHandlerModel` | `selfType:TypeRef, event:TypeRef, repository:TypeRef, logicCode:String, dependencies:Set[TypeRef], eventCaseName:String="", routable:Boolean=true, viewName:String="", concreteEventName:String="", entityEventFqn:String="", identityKeys:Seq[(String,Boolean)]=Nil, applyForm:String="create", noteIds:Seq[String]=Nil` |
| `ApplyEventFunction` | `eventName:String, eventFqn:String="", applyExpr:Option[String], bodyExpr:String="", applyForm:String="create", fieldPairs:Seq[(String,String,String)], literalPairs:Seq[(String,String)], droppedColumns:Seq[String]=Nil, deletePairs:Seq[(String,String)]=Nil, viewColumns:Seq[(String,String)]=Nil` |

父模型 handlers/aggregateSources 是装配输入，**不是只取 head 的同义列表**；applyEvents/identityScheme 由 sibling templates 消费，ProjectionTemplate 不输出纯函数或 identity 算法。TypeRef=`name,packageName,typeParams=Nil`，signature/递归依赖详见 [TypeSystem](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)；[ArtifactModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala) 的 registerTo 只注册本体，morphisms 默认 Nil，noteIds 仅文件台账。

### 2.1 Builder 精确推导

1. selfType=typeResolver.projection(meta.name)，package=layout.application.projection.root；sourceAggregate=aggregateRoot(meta.sourceAggregate)，repoRef 解析或 IllegalArgumentException。
2. [AggregateRootProtoBuilder.getProtoEventFamilyType/getProtoEventUnionType](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/proto/AggregateRootProtoBuilder.scala#L20) 提供 `<Agg>EventPO.Event` 类型和 PO object import；不直接把 domain event 作为 Journal 信封类型。
3. 只有 sourceAggregates.size>1 才做 multi 候选。按 sourceAggregates 原序，对每聚合筛事件 FQN 含 `.<aggName>Entity.` 的 meta.handlers，逐个用本聚合 family 构建 handler；无 handler 的组丢弃。非空 aggregateSources 的 handlers 展平作为全量；若所有组都空，fallback 主聚合 buildHandlers(meta.handlers)，不是总是返回 Nil。
4. 嵌套 ProjectionHandlerBuilder 位于 Model 文件 L106–184：logic.referenceCode 或 ???；event type 用 resolver；routable 由 source Aggregate→Entity 字串比较；eventCaseName 首选 meta.eventName，空值用 eventType.name；identityKeys 由 schema 顺序×事件字段存在位；form 优先 persistenceId，再 delete，再 updateOnly 声明/头，再 create。只在最终写 handler 前盖投影 noteIds。
5. 依赖 union：sourceAggregate/repository/handler selfTypes，所有 handler.dependencies，Inject/ExecutionContext/Projection/typed ActorSystem/ScalikeJdbcSession/ScalikeJdbcSetup/MongoReadJournal/主 PO object；递归 collectAllDependencies→shouldImport；再并入各 aggregate/source proto/handler deps，最后 shouldImport。详见 [GeneratorContext framework types](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L68)、[TypeResolver](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala)。fallback Any/未完成 resolveMetaRef 是真实解析边界，不是所有元数据都合法。
6. multi-only applyEvents 全文本方言、四形/default/降级的全部推导见 [ApplyEvent diff §3](projection-apply-event.diff.md#3-builder-从输入到表达式全文分支覆盖)；这是同一次 build 的 sibling 数据，不能删掉它造成 handler 有调用而文件不发。

## 3. 全文件 construct / 顺序 / RHS 账

### 3.1 imports 与顶层

base imports：dependencies sortBy(fqn)→map fqn→filter scala*/java.lang*→distinct。再追加以下**全部**字符串，最后 [CodeGenerationDSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L20) 按字符串排序；合并后不 distinct，所以实际可重复导入 ActorSystem/MongoReadJournal，ScalikeSession 单项/花括号亦重叠。

```scala
import akka.actor.typed.ActorSystem
import akka.projection.eventsourced.EventEnvelope
import akka.projection.eventsourced.scaladsl.EventSourcedProvider
import akka.projection.jdbc.scaladsl.JdbcProjection
import akka.projection.scaladsl.{ExactlyOnceProjection, SourceProvider}
import akka.projection.ProjectionId
import akka.persistence.query.Offset
import akka.contrib.persistence.mongodb.MongoReadJournal
import net.imadz.common.application.projection.{ScalikeJdbcSession, ScalikeJdbcSetup}
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import javax.inject.Singleton
// 再加 sourceProtoEventType.packageName + "._"
// handlers.size>1 或 aggregateSources.nonEmpty 再加 akka.projection.jdbc.scaladsl.JdbcHandler
```

这些是输入序，输出会排序。base 还可能包含 Inject/Projection、domain event、repo、aggregate/handler/PO 等未实际使用的 imports。目标用集中正常 imports/简单类型名去重，不能复刻冗余当风格要求。

完整输出序：package → imports → 两行 Projection 职责 Scaladoc → `@Singleton object <View>` → `val projectionName = selfType.name.replace("Projection", "")` → 单源或多源方法。无顶层 class/trait/case class、type alias、lazy/var、自类型、对象构造器；只有 composite 时嵌套 private class。`projectionNameVal/classComment` 等生成侧局部中间字符串未独立成为重复声明。

### 3.2 单源、单 handler

```scala
private def sourceProvider(tag: String)(implicit system: ActorSystem[_]): SourceProvider[Offset, EventEnvelope[Po.Event]] = {
  EventSourcedProvider.eventsByTag[Po.Event](
    system = system,
    readJournalPluginId = MongoReadJournal.Identifier,
    tag = tag
  )
}
def createProjection(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: RepositoryFqn): ExactlyOnceProjection[Offset, EventEnvelope[Po.Event]] = {
  implicit val sys: ActorSystem[_] = system
  val tag = s"AggBaseTag$index"
  JdbcProjection.exactlyOnce(
    projectionId = ProjectionId("snake_view_name", tag),
    sourceProvider = sourceProvider(tag),
    handler = () => new PerEventHandler(repository),
    sessionFactory = () => new ScalikeJdbcSession()
  )
}
```

Po.Event 代表 sourceProtoEventType.name，RepositoryFqn 是 raw 真正使用的 model.repository.fqn；tag 基名 sourceAggregate.name.replace("Aggregate", "")+Tag。projectionId 逐**每个大写字母**前加下划线→小写→去首下划线，不是 acronym-aware snake。sharding 参数不在体内用；没有调用 `.run()`/启动 actor，只有 factory。默认无辅助参数/默认值，sourceProvider 有第二个 implicit 参数列表。

### 3.3 单源、多 handler

factory 同上，handler 闭包创建 `<View>CompositeHandler(new H1(repository), new H2(repository),...)`，全量原序装配（含 non-routable）。之后发 `private class Composite(lowerFirst(eventCaseName): HandlerType, ...) extends JdbcHandler[EventEnvelope[Po.Event], ScalikeJdbcSession]`；普通构造参数无 val/var、无注解。

唯一 override：`process(session:ScalikeJdbcSession,envelope:EventEnvelope[Po.Event]):Unit = envelope.event match`；仅 routable handler 原序生成 `case Po.Event.EventCase(_) => lowerEvent.process(session,envelope)`；non-routable 只在构造中/注释中列出，**不路由**；最后 `case _ => ()` 静默跳过无日志。不能把跨聚合“生成了 handler”当成已消费该聚合流。

### 3.4 多 aggregateSources

多源时不发通用 sourceProvider/createProjection/composite；按 aggregateSources 原序每组连续发：注释→`sourceProvider<AggBase>`→`createProjectionFor<AggBase>`→`private class <View><AggBase>CompositeHandler`。签名同上但该组 proto family/handlers；每组 factory 即使只有一个 handler 仍建 composite。tag=`AggBaseTag$index`；ProjectionId 第一项相同 view snake，第二项是各自 tag。routeArms 遍历该组 handlers，不再检查 routable（Builder 已按属主筛）；默认未知→()。它们共享 repository，并不因此共享类型或事务。

### 3.5 graph/vector/JDBC/Mongo

ProjectionTemplate **没有按 storage 分支**：四 sink 仍走 MongoReadJournal→JdbcProjection.exactlyOnce→ScalikeJdbcSession。差异在 repository 与 per-event handler；图 handler multi 仍可能 MANUAL ???。Mongo/vector/graph 外部写不受 JDBC offset 的单库事务自动保护；table repo 自开 localTx 也不能用类名证明 exactly-once 副作用。

## 4. JS 三条路径、Model/Builder/Template/产物区别

### formal 银行

[generate.registry](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L59) 的 play-service-dsl 调 [renderJournalReadside](../baseline/js/generators/scala-cqrs-play-service/render-journal-readside.mjs#L214)。选一个 selected service artifact；无 projectionStore 返回 []；store 校验后一次产生 Schema/Repository/Projection/Domain/SQL 五文件，且 entry 带 sources/deps/codeMappings。该输入不包含 Scala 的 per-view handlers/applyEvents/repository 方法。

`renderProjection` L9–212 与 [实际银行 Projection 全文件](../baseline/actual-js/app/example/bankwealth/infrastructure/projection/BankJournalReadsideProjection.scala) 的全部职责：

- companion 先 Envelope(pid,sequenceNr,event:Any)+require，再 Journal(namespace,persistenceIds/currentEvents/events) 和 Bindings(identity/fold/indexes)。不是 Akka EventEnvelope/SourceProvider。
- final class(journal,bindings,dataSource)(implicit system,ec) extends AutoCloseable；imports 为 Akka streams/serialization、JDBC/Scala concurrency；成员按源码序 namespace/repository/materializer/serialization/killSwitch/allowedKinds/watches/catchUps/discovery/poll/closed/initialized/pendingWork/drained/shutdownResult。
- methods 原序 tracked→identity→payload→initialize→project→read→catchUp→invalidate→watch→discover→start→shutdown→close。tracked 入场计数/关闭拒绝、异步完成减计数；payload PB bytes 或 Akka serializer；initialize 单缓存 Future。
- project 先校验 PID identity，初始化后 repository.write：ensureRow→序号已有则核 type/manifest/bytes 完全一致，缺席则 Math.addExact 连续序列→bindings.fold→session.append→bindings.indexes→提交。不是 JdbcHandler.process(session,envelope)。
- catchUp 按 PID 缓存 Promise，取 last→currentEvents→顺序 project→记录 observed high；失败 invalidate 后重抛，清缓存。watch 从 0 开始事件订阅 mapAsync(1)，结束 invalidate；discover 保持一个可能无限订阅；start 只初始化/注册轮询，不表示全索引新鲜。
- shutdown closed→cancel poll→killSwitch→等 accepted work drain→invalidateAll；close Await timeout。只关自有订阅，不关闭 source/DataSource/ActorSystem。银行实值 poll=2000ms、close=20000ms；observed frontier 是 per-PID 样本，不是全局完成。

因此少了 Scala 目标的 View repository/typed per-event Handler/projectionId/tag/provider，但多了不同的 lifecycle/重复防冲突/水位合同；不能一方删掉再称对齐。

### legacy 与 deprecated

- [emit](../baseline/js/generators/projection-dsl/emit.mjs) 有 standard/composite/single/m3View，与 Scala 结构近似；m3View 仅主聚合。[run-all L1026–1086](../baseline/js/generators/run-all.mjs#L1026) 取主聚合事件交集，`m3` 由名称 OpenSessionDecisionView 硬编码，不是一般多源声明。
- [smviews](../baseline/js/generators/projection-dsl/smviews.mjs) indexCanonical/wiringOf 按未 promoted storyMapping notes、aggregate/event link 原序去重分组，singleSourceView/multiSourceView 支持多活跃源；graph/vector/manualBodyFor 已有实现。由 [run-all L2068](../baseline/js/generators/run-all.mjs#L2068) 单独写文件。不能只读 emit 就称 legacy 多源不存在。
- [deprecated deriveView](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/builders/views.mjs) 与 [renderProjectionDef](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/templates/projection.mjs) 有三种形态；固定包、复制 stamp/重复 import、活跃事件群，与 single 组的 routing/空源处理不完全同 Scala；[generate](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/generate.mjs) 还容许 stale sidecar/skipHandlers，不是 formal route。

### 新 persistence-readside family

[buildModels](../baseline/js/generators/scala-cqrs-persistence-readside-v1/build-models.mjs) 从严格 binding 重建 product+wire hash+exact converter ABI，resolveNameSet 后产 names/registrations/index/schema/compatibilityKey/sources；[productionJobs](../baseline/js/generators/scala-cqrs-persistence-readside-v1/render.mjs) 统一 final-byte writer。准入 [compilePersistenceReadside](../baseline/js/lib/products/persistence-readside.mjs) 仅一个 context/aggregate、1–64本地事件、完整fold、一个 String carrier map index、h2-2、envelope-resource identity、显式 wire pin。

[runner/source templates](../baseline/js/generators/scala-cqrs-persistence-readside-v1/templates/runner.mjs) Source trait 是分页 Future API，JdbcSource 读该 repository；Runner(repository,handler,source,blockingEc,system) 维护 admission/capacity/failure/accepted/completed/PID Promise/一次初始化/定时器。project→handler.project；consume 按连续页串行处理至空页；discover 按 PID 有序分页并串行共享 catchUp；start 首次发现后 scheduleOnce；失败记录首错；shutdown drain 或 timeout 返回 ShutdownResult。与银行无限 stream+killSwitch 有别，与 Akka Projection tag+offset 更非 exact。[build template](../baseline/js/generators/scala-cqrs-persistence-readside-v1/templates/build.mjs) 也没有声明 Akka Projection/ScalikeJDBC 的构建依赖。

### 结构性 diff（非同输入字节比较）

minus 是银行真实类与入参；plus 是传统 factory 目标示意，View/Po/Agg 为结构占位，非已选银行业务。

```diff
-package example.bankwealth.infrastructure.projection
-final class BankJournalReadsideProjection(journal: BankJournalReadsideProjection.Journal, bindings: BankJournalReadsideProjection.Bindings, dataSource: DataSource)
-    (implicit system: ActorSystem[_], ec: ExecutionContext) extends AutoCloseable {
-  def close(): Unit = { Await.result(shutdown(), 20000.millis); () }
-}
+package example.bankwealth.application.projection
+object View {
+  val projectionName = "View"
+  def createProjection(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: ViewRepository): ExactlyOnceProjection[Offset, EventEnvelope[Po.Event]] = {
+    implicit val sys: ActorSystem[_] = system
+    val tag = s"AggTag$index"
+    JdbcProjection.exactlyOnce(
+      projectionId = ProjectionId("view", tag),
+      sourceProvider = sourceProvider(tag),
+      handler = () => new ViewCompositeHandler(new ViewOnEventHandler(repository)),
+      sessionFactory = () => new ScalikeJdbcSession()
+    )
+  }
+}
```

imports 必须按 §3.1 +真实模型依赖完整发出，此 diff 仅略去已逐项列出的 imports/sourceProvider/composite。不能把示意体的注释当新实现 RHS。

## 5. 运行胶水与人工参考差异

- `akka.projection.eventsourced.scaladsl.EventSourcedProvider.eventsByTag`、`akka.contrib.persistence.mongodb.MongoReadJournal.Identifier`，消费 journal 的真实 schema/event adapter/profile 必须一致；[scaffold](../baseline/bc/scaffold/build.sbt) 声明 RxMongo 3.0.8、Projection 1.2.5、Akka 2.6.20，不证明目标解析 JAR 已验证。
- `JdbcProjection.exactlyOnce/ExactlyOnceProjection/ProjectionId/Offset/JdbcHandler`、[ScalikeJdbcSession](../baseline/common/src/main/scala/net/imadz/common/application/projection/ScalikeJdbcSession.scala) 是 offset/session API。repo 独立事务见 [实现 diff](projection-repository-implementation.diff.md)，不能宣称业务 exactly-once。
- [ScalikeJdbcSetup](../baseline/common/src/main/scala/net/imadz/common/application/projection/ScalikeJdbcSetup.scala) 初始化 pool/关闭生命周期；本 ProjectionTemplate 只 import，不调用 init。
- Bootstrap 接口：[buildProjection](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/bootstrap/BootstrapBuilder.scala#L179) 与 [renderProjectionBootstrap](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/bootstsrap/BootstrapTemplate.scala#L169) 使用 ShardedDaemonProcess/ProjectionBehavior，single 按 Agg.tags.size；multi 按活跃 groups tags.size 求和、prefix-sum index 换 localIndex、调用 createProjectionForAgg；越界抛，stopMessage=Some(ProjectionBehavior.Stop)。不能只生成 factory 不迁启动调用。
- 人工月度参考 sourceProvider 是方法内 val，tag 使用 `CreditBalanceAggregate.tags(index)`，ProjectionId 第一项 projectionName、显式 `(system)`，sessionFactory 在 handler 前，handler 是带 sharding/repository 的 case class。raw 则拼 tag、snake id、per-event classes。这些影响历史 offset 身份，不只是排版。
- 额外实际阅读的原仓来源（**可变工作副本，不替代 pinned 证据**）：[journal-readside declaration gate](../../../lib/products/journal-readside.mjs)，绝对路径 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/products/journal-readside.mjs`，完整清单/摘要在 detail。它返回原 store 不补默认值，v1 stream/index 有闭合字段和容量/关键字/完整 key order 校验。

## 6. 后续 JS 写集合、迁移与 owner

proposed `generators/scala-cqrs-projection-v1/build-projection-models.mjs`、`templates/projection.mjs`；同组 `build-models.mjs/render.mjs/generate.mjs/generator.json` 由 projection 集成者统一 job graph/文件 owner，依赖 repository port/impl、handler、conditional ApplyEvent、bootstrap、proto/converter、shared-layout-types。legacy `projection-dsl/emit.mjs/smviews.mjs` 可拆纯模型/模板，`run-all.mjs` 旧直写退役须等调用方、sourceMappings、manifest、路径与历史 offset 身份迁移完成。formal service 的 generate/render-journal-readside 属协调写集合；新 family 保持独立 profile，不能静默替换 banking store。公共命名/类型/import/layout/registry/writer 由集成者修改，本阶段全不改。

## 7. 验收与未决项

当前均未运行。未来同输入全文件 `diff -u <scala> <js>` 覆盖0/1/多handler、单/多源、空活跃源、routable/non-routable、四 sink、imports完整/去重目标、factory/嵌套class次序、ProjectionId/tag/Bootstrap index、锚/稳定生成；授权后独占 target `sbt compile` 与真实 eventsByTag/offset/session/restart/错误传播/未知事件策略验证。生成、构建和源/DB生命周期都有副作用，本阶段禁止；未杜撰 CLI flag/spec。普通方法 CC≤5，>10 需拆或逐方法例外，不能 Any/String dispatcher 降分。

新增 2 个未决语义，另依赖 D-P01/04/10。

- **D-P11**：tag 拼接还是实际 Agg.tags(index)、ProjectionId snake 还是历史 projectionName，历史 offset 如何迁移；sourceAggregates 声明与仅主源/空群/事件重名的处理必须统一，避免丢消费流。
- **D-P12**：factory/Bootstrap 与自管 per-PID lifecycle 哪一个承担 start/shutdown/readiness/failure/freshness；unknown event 静默跳过是否满足业务监控，不能从“不中断”推导“正确消费”。

`generatorsModified=false`；`runtimeExecuted=false`。
