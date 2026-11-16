package net.imadz.codegen.scaffolding.cqrs.model.application

import net.imadz.codegen.scaffolding.cqrs.{
  ArtifactModel,
  GeneratorContext,
  TypeRef
}
import net.imadz.meta._

case class ProjectionModel(
    override val selfType: TypeRef,
    sourceAggregate: TypeRef,
    // [NEW] 源聚合根对应的 Proto 事件类型 (e.g. CreditBalanceEventPO.Event)
    sourceProtoEventType: TypeRef,
    repository: TypeRef,
    handlers: Seq[ProjectionHandlerModel],
    override val dependencies: Set[TypeRef],
    // [M3 向量读模型·多聚合投影] sourceAggregates>1 时（如 KnowledgeSemanticView=Note+Concept）：
    // 事件信封类型 per-aggregate（NoteEventPO.Event / ConceptEventPO.Event 不可混流），
    // 模板按聚合发 per-aggregate 投影变体（createProjectionFor<Agg>）＋各自组合分发器；
    // 单聚合投影该字段为 Nil——既有 27 视图零漂移。
    aggregateSources: Seq[ProjectionAggregateSource] = Nil,
    /** S7（EP §二 G1）：视图号——台账 artifacts[] 文件级落点由此可查。 */
    override val noteIds: Seq[String] = Nil,
    /** codegen-multi-project M3（S4 P8）：kernel 纯函数族——`<View>ApplyEvent.scala`
      * （on<Event>(existing: Option[V], e: E): V）。多项目模式发射（writeArtifact kind=
      * projection-apply-event → kernel）；单项目模式 Nil 零漂移。 */
    applyEvents: Seq[ApplyEventFunction] = Nil,
    /** Phase 2 债①：identity 方案（ProjectionMetadata.identityScheme 透传）——
      * Some("persistenceId") 时壳发 entityId 寻址（identity=e=>Seq(entityId,entityId)）、
      * kernel 出 (E, String)=>V 签名。None＝事件载荷 identityKeys（既有形零漂移）。 */
    identityScheme: Option[String] = None
) extends ArtifactModel

/** M3（S4 P8）：投影纯函数声明——builder 从 referenceCode 全文本直译（Phase 2 债①方言 v2：
  * view.copy(...)/updateOnly(key): view.copy|row.copy(...)/view.delete(...)/emptyRow(args)...）；
  * 无 refCode 或方言外头形 → applyForm="degraded" 诚实降级（??? 落桩·壳 updateOnly 兜底）。 */
case class ApplyEventFunction(
    eventName: String,
    /** 事件类型 FQN（<Agg>Entity.<Event>）——模板 import 用 */
    eventFqn: String = "",
    /** None＝直译不出（复杂折叠）——模板发 updateOnly 形或落桩注释 */
    applyExpr: Option[String],
    /** 直译表达文本（标识符重写后：event.→e.·view.copy(→existing.getOrElse(emptyRow).copy(
      * ·view.→row.·守卫/集合操作逐字保真）——模板直接插值发射。 */
    bodyExpr: String = "",
    /** 方言形：create（getOrElse emptyRow·缺省）／updateOnly（行签名·壳 ViewMachine.updateOnly）/
      * delete（kernel 出键元组·壳直调 repo.delete）／persistenceIdCreate（emptyRow(entityId,…)
      * 参数化·壳 entityId 寻址）／degraded（无 refCode·??? 落桩）。 */
    applyForm: String = "create",
    /** view.copy 键对（viewField ← eventField ← 视图列类型·类型适配：Id→.toString/Instant→ts）*/
    fieldPairs: Seq[(String, String, String)],
    literalPairs: Seq[(String, String)],
    /** 结构化列降级（P8 诚实降级）：直译丢弃的视图列名——模板留痕注释 */
    droppedColumns: Seq[String] = Nil,
    /** 债① delete 形键对（k ← e.g·view.delete(sourceType = "note", sourceId = e.noteId) 直译）——
      * kernel 出 def on<Event>(e: E): (String, String)，壳 match 直调 repo.delete(k0, k1)。 */
    deletePairs: Seq[(String, String)] = Nil,
    /** Phase 2 债②（emptyRow 建模）：视图全列集（列名→列型 signature·与 Table 同源
      * readModelSchema）——模板发射 emptyRow 默认行助手（String→""/Option→None/List→Nil/
      * Id→零 UUID/Boolean→false/Int→0），create 形 `getOrElse(emptyRow).copy`
      * 取代 `getOrElse(throw)` 诚实降级（金样＝di-poc ContainerViews/InviteTenantMember 终形）。
      * 空＝Table 列集未建模（单项目模式）——模板保持 throw 形。 */
    viewColumns: Seq[(String, String)] = Nil
)

/** [M3 多聚合投影] 单个源聚合的投影面：聚合对象（.tags 访问）＋事件族信封类型＋本族 handler */
case class ProjectionAggregateSource(
    aggregate: TypeRef,
    protoEventType: TypeRef,
    handlers: Seq[ProjectionHandlerModel]
)

case class ProjectionHandlerModel(
    override val selfType: TypeRef,
    event: TypeRef,
    repository: TypeRef,
    logicCode: String,
    override val dependencies: Set[TypeRef],
    // S2-48 挂账⑥(a)（2026-09-05·BUG-014 回移植）：组合分发器路由依据——
    // eventCaseName＝本 handler 的具体事件名（proto Event case 名·match 臂用）；
    // routable＝具体事件是否属投影源聚合的事件族（跨聚合 handler 仅装配不路由——
    // 其事件属其他聚合 tag 流，本流不可达，match 臂类型也不成立）。
    eventCaseName: String = "",
    routable: Boolean = true,
    /** M3（S4 P8）：视图名（<View>On<Event>Handler → <View>）与具体事件名——模板
      * ViewMachine.run 接线用（单项目模式未消费·零漂移）。 */
    viewName: String = "",
    concreteEventName: String = "",
    /** 实体面事件 FQN（net.imadz.metarch.domain.entities.<Agg>Entity.<Event>）——
      * M3 kernel ApplyEvent import 用（proto PO 住 glue·kernel 禁 import PO）。 */
    entityEventFqn: String = "",
    /** identity 键序＋载荷存在位（readModelSchema.identityKeys × 事件字段集·repo findByIdentity
      * 参数序）——ViewMachine identity/read 接线用；present=false 发空串占位（BUG-014 判例）。
      * 空＝tenantId 单键兜底。 */
    identityKeys: Seq[(String, Boolean)] = Nil,
    /** 债①三形（builder 从真源方言定·模板零 registry 依赖——MVC 分层判例）：壳接线形
      * create（ViewMachine.run·缺省）／updateOnly（ViewMachine.updateOnly）／
      * delete（match 直调 repo.delete）／persistenceIdCreate（entityId 寻址＋闭包传参）。 */
    applyForm: String = "create",
    /** S7（EP §二 G1）：知识身份＝**所属投影**的号（handler＝投影的派生容器·
      * 母元素＝读取模型／投影；builder 不收 ProjectionMetadata，由调用点漏斗前补齐）。 */
    override val noteIds: Seq[String] = Nil
) extends ArtifactModel

object ProjectionHandlerBuilder {
  def build(
      meta: ProjectionEventHandlerMetadata,
      projectionName: String,
      repoType: TypeRef,
      eventFamilyProtoType: TypeRef,
      eventFamilyProtoImport: TypeRef,
      ctx: GeneratorContext,
      sourceAggregate: TypeRef
  ): ProjectionHandlerModel = {
    val handlerPkg = ctx.layout.application.projection.handlers
    // 使用TypeResolverDSL中的函数，自动处理命名规范和包路径
    val selfType = ctx.typeResolver.projectionHandler(meta.name)
    // Event 类型解析
    val eventType = ctx.typeResolver.resolve(EventRef(meta.eventName))

    val logicCode = meta.logic.referenceCode.getOrElse("???")

    // identity 键序＝视图 schema 的 identityKeys（repo iface findByIdentity 参数序·G3 演练实修）。
    // 事件载荷缺失键→空串占位（BUG-014 判例：questionId 幽灵字段·空串主键成分）。
    // 模板按 (key, present) 二元发 identity 臂。
    val identityKeys: Seq[(String, Boolean)] = {
      val evFields: Set[String] =
        ctx.metaRegistry.resolveAll[SubordinateDomainEventMetadata]
          .find(_.name == meta.eventName).map(_.fields.map(_.name).toSet).getOrElse(Set.empty)
      val keys = (for {
        proj <- ctx.metaRegistry.resolveAll[ProjectionMetadata].find(_.name == projectionName)
        schema <- proj.readModelSchema
      } yield schema.identityKeys).getOrElse(Nil)
      keys.map(k => (k, evFields.contains(k)))
    }

    // 债①三形判定（builder 层·真源单遍）：persistenceId ＞ updateOnly ＞ view.delete 头 ＞ create。
    // 与 ProjectionBuilder.applyEvents 直译引擎同真源同口径（applyForm 双载体：壳接线＋kernel 签名）。
    val projMeta = ctx.metaRegistry.resolveAll[ProjectionMetadata].find(_.name == projectionName)
    val applyForm: String = {
      val persistence = projMeta.flatMap(_.identityScheme).filter(_ == "persistenceId")
      val updateOnlyDeclared = projMeta.exists(_.updateOnlyEvents.contains(meta.eventName))
      val deleteHead = meta.logic.referenceCode.exists(_.trim.startsWith("view.delete("))
      // refCode 头形即声明（updateOnly(key): 头＝行签名语义·与 updateOnlyEvents 双通道同权）
      val updateOnlyHead = meta.logic.referenceCode.exists(_.trim.startsWith("updateOnly("))
      if (persistence.isDefined) "persistenceIdCreate"
      else if (deleteHead) "delete"
      else if (updateOnlyDeclared || updateOnlyHead) "updateOnly"
      else "create"
    }

    // 挂账⑥(a)·BUG-014 回移植：跨聚合判别——具体事件（如 QuestionEntity.QuestionRaised）
    // 的属主实体包 vs 投影源聚合（NoteAggregate→NoteEntity）事件族；非本族 handler 仅装配不路由
    val aggEntity = sourceAggregate.name.replace("Aggregate", "") + "Entity"
    val routable = eventType.fqn.contains(s".$aggEntity.")

    val deps =
      Set(eventType, repoType, eventFamilyProtoImport) ++ Set(
        ctx.knownFrameworkTypes("ExecutionContext"),
        ctx.knownFrameworkTypes("Future")
      )

    val dependencies = deps
      .flatMap(_.collectAllDependencies)
      .filter(t => t.shouldImport(handlerPkg))

    ProjectionHandlerModel(
      selfType,
      eventFamilyProtoType,
      repoType,
      logicCode,
      dependencies.toSet,
      // eventCaseName 空值回退：具体事件类名兜底（proto Event case 名与事件类名一致）
      eventCaseName =
        if (meta.eventName.trim.nonEmpty) meta.eventName else eventType.name,
      routable = routable,
      viewName = projectionName,
      concreteEventName = eventType.name,
      entityEventFqn = eventType.fqn,
      identityKeys = identityKeys,
      applyForm = applyForm
    )
  }
}
