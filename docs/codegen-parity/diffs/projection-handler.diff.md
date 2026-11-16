# projection-handler（28，嵌套 Model 的 per-event 子文件）内容规格

## 1. 范围、状态、来源和基数

Artifact id `projection-handler`；状态 `decision-required`。完整固定 [ProjectionModel.scala（含 ProjectionHandlerModel/ProjectionHandlerBuilder）](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/ProjectionModel.scala)、[ProjectionBuilder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/ProjectionBuilder.scala)、[ProjectionHandlerTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionHandlerTemplate.scala)。HEAD/hash 见 [inventory](../scala-artifacts.json)、[index](../baseline/index.json)。不能因 JS handler 名称近似就把 custom journal 事务处理器认作 Akka JdbcHandler。

[CQRSApplicationGenerator L890–905](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L890) 遍历 **`model.handlers`**，每个 hModel 复制投影 noteIds 后写一个文件；不是从裸 metadata 重遍历，也没有独立顶层 HandlerModel 清单。正常输出基数为最终 handlers.size（重名路径冲突仍需验证），路径 `app/<business-base>/application/projection/handlers/<Handler>.scala`；multi 在 `modules/glue/src/main/scala/` 下同包。graph handler 即使算法未实现仍可能有文件；跨源 handler 生成不代表当前 tag 流能路由到它。

应用 business base 只三层 domain/application/infrastructure；handler 在 application.projection.handlers，不放第四层 service/readside，技术适配源码的 source module 可以是 glue。类型 PascalCase、局部/方法 lowerCamelCase，避免重复 Handler 后缀，正常 imports 而非长 FQN 洪流。

## 2. Model 全字段与实际 Builder

| Model | 原序字段（未标默认即必填） |
|---|---|
| `ProjectionHandlerModel` | `selfType:TypeRef, event:TypeRef, repository:TypeRef, logicCode:String, dependencies:Set[TypeRef], eventCaseName:String="", routable:Boolean=true, viewName:String="", concreteEventName:String="", entityEventFqn:String="", identityKeys:Seq[(String,Boolean)]=Nil, applyForm:String="create", noteIds:Seq[String]=Nil` |
| 父 `ProjectionModel` | `selfType:TypeRef, sourceAggregate:TypeRef, sourceProtoEventType:TypeRef, repository:TypeRef, handlers:Seq[ProjectionHandlerModel], dependencies:Set[TypeRef], aggregateSources:Seq[ProjectionAggregateSource]=Nil, noteIds:Seq[String]=Nil, applyEvents:Seq[ApplyEventFunction]=Nil, identityScheme:Option[String]=None` |
| `ProjectionAggregateSource` | `aggregate:TypeRef, protoEventType:TypeRef, handlers:Seq[ProjectionHandlerModel]` |
| sibling `ApplyEventFunction` | `eventName:String, eventFqn:String="", applyExpr:Option[String], bodyExpr:String="", applyForm:String="create", fieldPairs:Seq[(String,String,String)], literalPairs:Seq[(String,String)], droppedColumns:Seq[String]=Nil, deletePairs:Seq[(String,String)]=Nil, viewColumns:Seq[(String,String)]=Nil` |

TypeRef 为 name:String/packageName:String/typeParams:Seq[TypeRef]=Nil，nested FQN 与 generic signature/递归 deps 见 [TypeSystem](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)。ArtifactModel 默认 morphisms Nil/registerTo 只自身；noteIds 进 writer，不生成新业务字段。eventCaseName/routable 服务上层 composite；viewName/concreteEventName/entityEventFqn/identityKeys/applyForm 服务 multi shell/kernel 接线；logicCode 在 single 仅文档，不执行。

### 2.1 ProjectionBuilder 的可达路径

[Builder L15–69、321–413](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/ProjectionBuilder.scala) 先解析 source aggregate/repo/PO family，repositoryRef 缺失抛错。sourceAggregates.size>1 按声明序、事件 entity FQN 属主分组，空组过滤；有组时 flatten handlers，无组 fallback meta.handlers。每组调用嵌套 ProjectionHandlerBuilder 并使用该组 eventFamilyProtoType/Import/sourceAggregate。multi-only ApplyEvent 的四形/降级记录详见 [ApplyEvent diff](projection-apply-event.diff.md)，文件只在 applyEvents.nonEmpty 时发；不能假定每个 Handler 总能调一个同名 kernel 方法。

### 2.2 嵌套 ProjectionHandlerBuilder（Model 文件 L106–184）

1. selfType=typeResolver.projectionHandler(meta.name)，去后缀再保证 Handler；包 layout.application.projection.handlers。
2. eventType=resolve(EventRef(meta.eventName)) 为具体 domain entity event；但**返回 Model.event 是 eventFamilyProtoType**，不是具体 eventType。logicCode=referenceCode.getOrElse("???")。
3. identityKeys：先找到同名 SubordinateDomainEventMetadata 的 fields 名集合；再找 projectionName 对应 readModelSchema.identityKeys 原序；生成 `(key, evFields.contains(key))`，找不到 schema为 Nil。missing key 没有拒绝，而在模板落空串；无 keys 模板以 tenantId 单键兜底。
4. applyForm 实际优先级：projection identityScheme=persistenceId→persistenceIdCreate；否则 refCode 以 view.delete 开头→delete；否则 updateOnlyEvents 包含事件或 updateOnly( 头→updateOnly；否则 create。代码顺序与上方旧注释不同，以代码为准。它没有检查 ApplyEventFunction.applyForm 或函数 presence。
5. routable：sourceAggregate.name.replace("Aggregate", "")+Entity 后，eventType.fqn 是否包含 `.<Entity>.`。`eventCaseName` 为非空 meta.eventName，否则 eventType.name；viewName=projectionName；concreteEventName=eventType.name；entityEventFqn=eventType.fqn。
6. deps=eventType、repoType、eventFamilyProtoImport、ExecutionContext、Future，递归 collectAllDependencies/filter shouldImport(handlerPkg)。不收 ViewMachine、ApplyEvent、converter 类型；不在这里盖 noteIds，caller 在写盘前补投影号。

## 3. 完整输出 construct、imports、签名与 RHS

### 3.1 通用外壳和完整 import 规则

- package=model.selfType.packageName。
- base imports=dependencies 按 fqn 排序/map，过滤 javax.inject.Inject/scala*/java.lang*→distinct。
- 再追加 `akka.projection.eventsourced.EventEnvelope`、`akka.projection.jdbc.scaladsl.JdbcHandler`、`net.imadz.common.application.projection.ScalikeJdbcSession`、`scala.concurrent.Future`、`scala.concurrent.ExecutionContext`、`javax.inject.Inject`；[DSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L20) 排序，不对两组合并后再去重。
- 文档“负责处理...”后 raw 文本 `*/// @Singleton`：这是**注释中的 Singleton，不是 @Singleton 注解**。
- `class ActualHandlerName @Inject() (lowerFirst(repository.name): RepositoryName) extends JdbcHandler[EventEnvelope[model.event.name], ScalikeJdbcSession]`。若 selfType.name 尚无 Handler 才追加；writer 文件名仍原 selfType，需要一致。构造参数无 val/var、无默认值、无第二参数列表、无 type参数/self-type/父构造实参/companion/辅助构造器。
- 内部只有 `override def process(session:ScalikeJdbcSession,envelope:EventEnvelope[Po.Event]):Unit`，无返回 Future，没有额外成员。不同分支 method body 见下，Future/EC import 在多数分支未使用。

### 3.2 single-project 与 graph multi 的 MANUAL 分支

判别：`multiProject` 是 template 可变开关（由 sys.props 初值），`isGraphView=model.selfType.name.contains("GraphView")`，**不是 storageConfig 类型**。当 !multi 或 isGraphView，生成如下逻辑：

```scala
override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[Po.Event]): Unit = {
  envelope.event match {
    case event: Po.Event =>
      // Logic for protobuf event: Po.Event
      // 投影意图（元数据 referenceCode）：<logicCode原文>
      // ==== BEGIN MANUAL ====
      ??? // 行为侧实现：repository.upsert(view.copy(...))（手写实现留在本区块，重生成自动保留）
      // ==== END MANUAL ====
    case _ => ()
  }
}
```

这是**整族类型**匹配，不是具体 EventCase：如果只有一个 per-event Handler 被直接接线，它仍会匹配所有 Po.Event 子类而进入未完成 body。unknown 外层值才跳过。logicCode 是 comment/source string，不是可执行映射，且多行字符串可能影响注释边界。MANUAL 由后续行为填充/merge 策略保留，不得换成空 `()` 或 Future.successful 冒充实现。

### 3.3 multi 非 graph：degraded 优先

Template 先解析 poObj=model.event.name.split('.').head；aggName 从 dependencies 中一个匹配 concrete event 的 TypeRef 找 endsWith(Entity) 的片段剥后缀，找不到为空。`tableRef` 和 converter FQN **硬编码 net.imadz.metarch**，不是 ctx business base。

`applyEventMissing` 再做一次 logicCode 头探测：空/??? 或不以 updateOnly(/view.delete(/emptyRow(/upsert by <key>:/view.copy( 开头即 missing。missing 时**不调用 ViewMachine**，生成族 match、元数据意图与降级注释、MANUAL `??? // 投影意图未建模`，default ()。即使 Builder 给 updateOnly 并产 `onEvent(row,e)=row`，这里仍 missing；须统一，不能分别猜测。

### 3.4 multi 非 graph：四种可执行 shell

所有 decode：`case Po.Event.EventCase(po) => Some(net.imadz.metarch.infrastructure.persistence.converters.<Agg>ProtoConverters.<Event>Conv.fromProto(po)); case _ => None`。得到真正 domain event 后才传 kernel，不给 domain event/参数加 ActorRef。

| form | process 全部关键 RHS 与顺序 |
|---|---|
| delete | `envelope.event match` 具体 PO case→val e=converter.fromProto(po)→`val (t0,t1)=ViewApplyEvent.onEvent(e)`→`repo.delete(t0,t1)`；其他→()。没有 read/upsert/ViewMachine；t0/t1 是 raw 名，目标应 sourceType/sourceId 等有语义名但先修键合同 |
| updateOnly | 表达式体 `ViewMachine.updateOnly[Event, tableRef](envelope, decode=..., identity=e=>Seq(...), read=ids=>repo.findByIdentity(...), applyEvent=ViewApplyEvent.onEvent, write=repo.upsert,)`，named args 严格此序。identityKeys非空时 present key→e.key.toString，缺key→""；空 keys→e.tenantId.toString。read 逐 ids(0..n-1)，空 keys只 ids(0)。传 `(View,Event)=>View`，查无行跳过依赖真实 ViewMachine |
| persistenceIdCreate | 大括号体先 `val entityId=envelope.persistenceId.toString.split("\\|").last`，再 ViewMachine.run；identity 固定 Seq(entityId,entityId)，read固定双参 ids(0),ids(1)，applyEvent=(existing,e)=>ViewApplyEvent.onEvent(e,entityId)，write=repo.upsert。existing 被忽略；不跟 identityKeys 数量调整 |
| create/其它 form | `ViewMachine.run[Event,tableRef]` 同 updateOnly 五段接线，但 applyEvent 为 `(Option[View],Event)=>View`。无其它分支特判，unknown applyForm也落此路 |

传入的 `session` 在上述生成调用中**从未传给 repo/ViewMachine**。即使框架方法返回 Unit，具体阻塞、异步异常、事务归属不能凭函数名证明。Vector/Mongo 仍可能走表 shape 的 read/upsert；graph 则始终留 MANUAL，而不是已自动 GraphMutationExecutor 接线。

## 4. JS 当前对应：不能以类似类名分类

| lane | 固定源码/符号 | Model / Builder / Template / 产物结论 |
|---|---|---|
| formal 银行 | [render-journal-readside](../baseline/js/generators/scala-cqrs-play-service/render-journal-readside.mjs) renderProjection/project；[render-journal-domain](../baseline/js/generators/scala-cqrs-play-service/render-journal-domain.mjs) renderJournalDomain | Model 是 store.streams/indexes，builder 解聚合/identity与codeMappings；Template把处理嵌在 Projection.project/Domain.fold；实际不发 per-event JdbcHandler。project 的同 Session 校验/append/indexes 是其自有业务机制 |
| legacy emit | [emit L293–339](../baseline/js/generators/projection-dsl/emit.mjs#L293) | spec.events/refCodes→每事件 JdbcHandler，MANUAL ???；有对应 skeleton，不是完全不存在；无 multi ApplyEvent/ViewMachine 接线 |
| legacy smviews | [smviews L175–294、535–637](../baseline/js/generators/projection-dsl/smviews.mjs#L175) translateGraph/translateVector/manualBodyFor/handlerFile/generateSmViews | graph 条件解析顺序调用 upsert/update/delete/mergeEdge，graph.manual/重复 props/非标量/无法解析→残余???；vector 在 MANUAL 中 Await(10s)→默认行/copy→upsert，delete直调；不是 kernel函数。读取 target field types 的 typed Map[String,Any] 行为已不同于 Scala String props |
| deprecated | [views](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/builders/views.mjs)、[handler](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/templates/handler.mjs)、[generate](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/generate.mjs) | deriveView+protoFields guard→table/vector/graph MANUAL，不能派生时使用 manualBlocks sidecar；无 sidecar直接抛。staleGenerations 可跳 handler；graph mergeEdge 派生调用只三参而 repository 方法四参，必须显式审查，不复制成 exact |
| 新 family | [buildModels](../baseline/js/generators/scala-cqrs-persistence-readside-v1/build-models.mjs)、[handlerTemplate L203](../baseline/js/generators/scala-cqrs-persistence-readside-v1/templates/repository.mjs#L203)、[render.productionJobs](../baseline/js/generators/scala-cqrs-persistence-readside-v1/render.mjs#L28) | 有独立 Handler 类，但构造 `(repository,initialAggregateState)`，方法 project(ownEnvelope):ProjectResult，不继承 JdbcHandler。frame parse/role验证→repo.transaction→重复 bytes 比对或连续序列→decode domain Event→aggregate EventHandler.apply→append→replaceState→replaceMapIndex→checkpoint。typed 数据模型和值对象保留，可复用 discipline；责任仍不是 per-view ApplyEvent |

formal [实际 Projection](../baseline/actual-js/app/example/bankwealth/infrastructure/projection/BankJournalReadsideProjection.scala#L95) 与 [实际 Domain](../baseline/actual-js/app/example/bankwealth/infrastructure/projection/BankJournalReadsideDomain.scala#L28) 分别确认事务与折叠。技术种类返回 State(None,None,None) 是业务声明选择，不是未知事件成功；未知 kind 抛异常。不能把它们变成 unknown→() 来对齐 Scala 默认分支。

结构性对照，非同输入字节比较。minus 摘自实际银行事务处理，plus 为多项目 updateOnly 目标结构（View/Event 等为占位输入，不捏造具体银行事件）。

```diff
-val state = bindings.fold(row, envelope.event)
-val next = session.append(row, envelope.sequenceNr, serialized, state)
-bindings.indexes(session, next)
+// <base>.application.projection.handlers.ViewOnChangedHandler
+class ViewOnChangedHandler @Inject() (repository: ViewRepository)
+  extends JdbcHandler[EventEnvelope[SampleEventPO.Event], ScalikeJdbcSession] {
+  override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[SampleEventPO.Event]): Unit =
+    ViewMachine.updateOnly[Changed, View](
+      envelope,
+      decode = {
+        case SampleEventPO.Event.Changed(po) => Some(ChangedConv.fromProto(po))
+        case _ => None
+      },
+      identity = e => Seq(e.id.toString),
+      read = ids => repository.findByIdentity(ids(0)),
+      applyEvent = ViewApplyEvent.onChanged,
+      write = repository.upsert
+    )
+}
```

plus 使用正常 imported 类型而非 raw 的长硬编码 FQN；完整 imports 由 §3.1 +具体 DTO/事件/converter/ViewMachine 来，ViewMachine 的实际来源未确定，当前不是可执行交付。不能把 minus 同事务 event/checkpoint 的保障从验收表删掉。

## 5. 人工 golden / 胶水 / 手写槽

[人工月度 handler](../baseline/curated-scala/net/imadz/application/projection/MonthlyIncomeAndExpenseSummaryProjectionHandler.scala) 全文与 raw 差异：case class(sharding,repository)；`val adapter=new CreditBalanceEventAdapter`；process 对 adapter.fromJournal(...).events.foreach；BalanceChanged 正金额→income，否则反号→expense；FundsDeducted 用 envelope.timestamp 记 expense；getDateFromTimestamp 用 systemDefault ZoneId 转 year/month/day；default ()。不是 per-event constructor、不是 referenceCode 直译、不是已分离纯函数；也没用 session。其专用算法、时区及幂等性不可从模板名字推导。

胶水必须逐件接实：

- `akka.projection.jdbc.scaladsl.JdbcHandler[EventEnvelope[Po.Event],ScalikeJdbcSession]`/`akka.projection.eventsourced.EventEnvelope` 的同步 process API；[ScalikeJdbcSession](../baseline/common/src/main/scala/net/imadz/common/application/projection/ScalikeJdbcSession.scala) 的 withConnection/begin/commit/rollback/close；[scaffold build](../baseline/bc/scaffold/build.sbt) 声明 Projection1.2.5/ScalikeJDBC3.5.0/common-core0.2，不等于 JAR/二进制验证。
- `<base>.infrastructure.proto.<agg>.<Agg>EventPO.Event.<Event>`、`<base>.infrastructure.persistence.converters.<Agg>ProtoConverters.<Event>Conv.fromProto`；具体名称必须由 proto/converter owner 与 resolver 提供，不能依 dependencies.find 侥幸拼 FQN。
- `<base>.application.projection.handlers.<View>ApplyEvent.on<Event>` 与 repository.findByIdentity/upsert/delete 必须签名匹配，absence/degraded 不能伪造方法。
- `ViewMachine` raw 为无 import 的简单名，模板暗示同包 `<base>.application.projection.handlers.ViewMachine`，但已读固定基线未提供真实定义；不能断言 common-core 中已发布。run/updateOnly 至少需要 decode/identity/read/applyEvent/write 合同，阻塞超时/None/异常传播/事务都未由调用点证明。
- graph `GraphMutationExecutor` 和 vector/Mongo store 由 [实现 diff](projection-repository-implementation.diff.md) 单列；manual re-key/status、graph tolerant links、无 dialect 行为由业务 owner 填，不准 fake success。

## 6. 后续 JS 写集合、文件组装 owner

proposed：`generators/scala-cqrs-projection-v1/build-handler-models.mjs`、`templates/handler.mjs`；依赖本组 build-projection-models/build-apply-event-models/repository models。projection 集成者的 `build-models.mjs/render.mjs` 统一拥有每个 handler 文件，只遍历已判定的 handlers；函数 presence/事件属主/typed decode/identity/order/routing 入 Model，不留 template 猜业务。

adapt `generators/projection-dsl/emit.mjs/smviews.mjs` 的多源/有限图动词，退役重复模板；deprecated templates/handler.mjs 仅供已审查来源，不重启 sidecar 自动接管。`generators/run-all.mjs`/formal service registry 的迁移由集成者协调，旧路径 MANUAL、imports、codeMappings、fingerprints 一起迁；不能让两个 producer 覆盖同一文件。新 family templates/repository.mjs 的 handler 可按既有契约拆文件责任，但不把 project 改名 process 冒称兼容。公共 names/types/layout/writer/registry 与 bootstrap/proto/converter/运行库不由本组私改，本阶段只文档。

## 7. 验收与未决项

当前未运行。未来同输入 `diff -u <scala-file> <js-file>` 覆盖 Model每字段、imports/构造器/继承/process返回型、single/multi/GraphView/degraded、四form、nested model cardinality、路由、presence一致、全 RHS、MANUAL保持与稳定回锚。经独立授权后目标 `sbt compile` 与真实 JdbcHandler+session+converter+ViewMachine 接口/行为；必须测未知事件、缺identity、persistenceId分隔/键数、updateOnly缺行、delete键、毒事件失败/重放。构建/生成会写 target/cache，JDBC用例改独占DB；本阶段不运行任何测试、构建、生成或服务，不假设现有 suite 足够。CC≤5，>10拆分或逐方法审批，不能 Any/String dispatcher 刷分。

新增 1 个未决语义，依赖 D-P01/03/04/08/09/10/11/12。

- **D-P13**：事件缺 identity 时空串/tenantId fallback 与 persistenceId 固定双键是否允许，single handler 的整族匹配、GraphView 名称判别及缺失 dialect 的 MANUAL 归属如何显式建模；确认真实 ViewMachine 不吞失败、不在未完成写后推进 offset。

`generatorsModified=false`；`runtimeExecuted=false`。
