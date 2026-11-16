package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.ProjectionModel

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object ProjectionTemplate extends CodeTemplate[ProjectionModel] {

  def generate(model: ProjectionModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 获取handler名称和聚合名称
    val handlerName = model.handlers.head.selfType.name // Assuming one handler
    val aggName = model.sourceAggregate.name

    // S2-48 挂账⑥(a)（2026-09-05·BUG-014 回移植）：多 handler 投影发组合分发器——
    // 原 handlers.head 只接线一个 handler，其余事件落入 ??? 兜底中断投影流（真仓
    // 2026-08-26 手修形态回移植）。单 handler 投影保持原装配不变（零漂移）。
    val isComposite = model.handlers.size > 1
    val compositeName = s"${model.selfType.name}CompositeHandler"
    val decap = (s: String) => if (s.nonEmpty) s.head.toLower.toString + s.tail else "handler"
    val routableHandlers = model.handlers.filter(_.routable)
    val nonRoutableHandlers = model.handlers.filterNot(_.routable)

    // [M3 向量读模型·多聚合投影] sourceAggregates>1：事件信封 per-aggregate 不可混流
    // （NoteEventPO.Event / ConceptEventPO.Event 各属各的 tag 流），按聚合发投影变体：
    // sourceProvider<Base> ＋ createProjectionFor<Base>（tag=<Base>Tag<index>·offset 独立）＋
    // <View><Base>CompositeHandler（仅本族事件路由）。Bootstrap 按 tags 总数分派 index。
    val isMultiAggregate = model.aggregateSources.nonEmpty

    // 3. 构建导入声明
    val baseImports = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(t => t.startsWith("scala") || t.startsWith("java.lang"))
      .distinct

    // [FIX] Tag Base Name Logic (should match Aggregate Bootstrap)
    // 与 AssemblyEngine 的 ShardedTags 约定对齐：tagging.baseName = <聚合基名>Tag（生成 tags "<Name>Tag<i>"）
    val tagBaseName = aggName.replace("Aggregate", "") + "Tag"

    val eventProtoType = model.sourceProtoEventType.name
    val eventProtoImport = s"${model.sourceProtoEventType.packageName}._"

    // Repository Type Name
    val repoTypeName =
      model.repository.fqn // repositoryType.map(_.name).getOrElse("Any")

    val additionalImports = Seq(
      "akka.actor.typed.ActorSystem",
      "akka.projection.eventsourced.EventEnvelope",
      "akka.projection.eventsourced.scaladsl.EventSourcedProvider",
      "akka.projection.jdbc.scaladsl.JdbcProjection",
      "akka.projection.scaladsl.{ExactlyOnceProjection, SourceProvider}",
      "akka.projection.ProjectionId",
      "akka.persistence.query.Offset",
      "akka.contrib.persistence.mongodb.MongoReadJournal",
      "net.imadz.common.application.projection.{ScalikeJdbcSession, ScalikeJdbcSetup}",
      "akka.cluster.sharding.typed.scaladsl.ClusterSharding",
      "javax.inject.Singleton",
      eventProtoImport
    ) ++ (if (model.handlers.size > 1 || isMultiAggregate)
      Seq("akka.projection.jdbc.scaladsl.JdbcHandler") // 组合分发器基类（挂账⑥(a)·BUG-014 回移植·M3 多聚合变体同用）
    else Seq.empty)

    val importDecl = imports((baseImports ++ additionalImports): _*)

    // 3. 构建Source Provider代码
    val sourceProviderCode = s"""
  // Akka Persistence Query Source Provider
  private def sourceProvider(tag: String)(implicit system: ActorSystem[_]): SourceProvider[Offset, EventEnvelope[$eventProtoType]] = {
    EventSourcedProvider.eventsByTag[$eventProtoType](
      system = system,
      readJournalPluginId = MongoReadJournal.Identifier,
      tag = tag
    )
  }
"""

    // 4. 构建Projection工厂方法
    val projectionIdName = model.selfType.name
      .replaceAll("([A-Z])", "_$1")
      .toLowerCase
      .stripPrefix("_")

    // [FIX] 增加 projectionName 字段
    val projectionNameVal =
      s"  val projectionName = \"${model.selfType.name.replace("Projection", "")}\""

    // 挂账⑥(a)：handler 装配——单 handler 原样；多 handler 组合分发器（全量装配·按族路由）
    val handlerWiring =
      if (isComposite)
        s"""new $compositeName(
        ${model.handlers.map(h => s"new ${h.selfType.name}(repository)").mkString(",\n        ")}
      )"""
      else s"new $handlerName(repository)"

    // [M3 多聚合投影] per-aggregate 投影变体：每个源聚合一份
    // sourceProvider<Base>＋createProjectionFor<Base>＋<View><Base>CompositeHandler。
    // tag=<Base>Tag<index>（与聚合 Bootstrap 分片约定一致）；ProjectionId(name, tag)
    // per-tag 独立 offset。信封类型 per-aggregate——本聚合不可达事件（其他聚合 tag 流）
    // 由 CompositeHandler 的 case _ 优雅跳过。
    val multiAggregateCode = model.aggregateSources.map { src =>
      val aggBase = src.aggregate.name.replace("Aggregate", "")
      val eventProtoType = src.protoEventType.name
      val srcCompositeName = s"${model.selfType.name}${aggBase}CompositeHandler"
      val handlerArgs = src.handlers.map(h => s"new ${h.selfType.name}(repository)").mkString(",\n        ")
      val routeArms = src.handlers.map(h =>
        s"case $eventProtoType.${h.eventCaseName}(_) => ${decap(h.eventCaseName)}.process(session, envelope)").mkString("\n        ")
      s"""
  /** [M3 多聚合投影] $aggBase 源聚合的事件流（信封 ${eventProtoType}，与本视图其他聚合流互不混流） */
  private def sourceProvider$aggBase(tag: String)(implicit system: ActorSystem[_]): SourceProvider[Offset, EventEnvelope[$eventProtoType]] = {
    EventSourcedProvider.eventsByTag[$eventProtoType](
      system = system,
      readJournalPluginId = MongoReadJournal.Identifier,
      tag = tag
    )
  }

  /**
   * [M3 多聚合投影] $aggBase 流投影实例（ExactlyOnce·tag=<${aggBase}Tag><index>·offset 独立）。
   * @param index 该聚合 tag 分片索引（由 Bootstrap 按聚合顺序偏移后传入）
   */
  def createProjectionFor$aggBase(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: $repoTypeName): ExactlyOnceProjection[Offset, EventEnvelope[$eventProtoType]] = {
    implicit val sys: ActorSystem[_] = system
    val tag = s"${aggBase}Tag$$index"

    JdbcProjection.exactlyOnce(
      projectionId = ProjectionId("$projectionIdName", tag),
      sourceProvider = sourceProvider$aggBase(tag),
      handler = () => new $srcCompositeName(
        $handlerArgs),
      sessionFactory = () => new ScalikeJdbcSession()
    )
  }

  /**
   * ${model.selfType.name} $aggBase 流组合分发器：按事件类型把 envelope 路由到对应 per-event Handler；
   * 未知事件（其他聚合 tag 流不可达，防御性）优雅跳过，保证投影流不中断。
   */
  private class $srcCompositeName(
    ${src.handlers.map(h => s"${decap(h.eventCaseName)}: ${h.selfType.name}").mkString(",\n    ")}
  ) extends JdbcHandler[EventEnvelope[$eventProtoType], ScalikeJdbcSession] {

    override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[$eventProtoType]): Unit =
      envelope.event match {
        $routeArms
        case _ => ()
      }
  }
"""
    }.mkString("\n")

    val projectionFactoryCode = s"""
  /**
   * 创建 Projection 实例，使用 ExactlyOnce 语义。
   * @param index 分片索引，用于计算 Tag (e.g. tag-0, tag-1)
   */
  def createProjection(system: ActorSystem[_], sharding: ClusterSharding, index: Int, repository: $repoTypeName): ExactlyOnceProjection[Offset, EventEnvelope[$eventProtoType]] = {
    implicit val sys: ActorSystem[_] = system
    // [FIX] 计算 Tag: baseName + index (需要与 Aggregate Bootstrap 保持一致)
    val tag = s"$tagBaseName$$index"

    JdbcProjection.exactlyOnce(
      projectionId = ProjectionId("$projectionIdName", tag),
      sourceProvider = sourceProvider(tag),
      handler = () => $handlerWiring,${if (isComposite) " // [FIX 挂账⑥(a) BUG-014] 组合分发器：修复单 handler 装配缺陷（原仅接线单事件 handler，其余事件落入 ??? 兜底中断投影流）" else " // [FIX] Instantiate Handler with Repo"}
      sessionFactory = () => new ScalikeJdbcSession()
    )
  }
"""

    // 挂账⑥(a)：组合分发器私有类——envelope 按事件类型路由到对应 per-event Handler；
    // 跨聚合 handler 仅装配不路由（其事件属其他聚合 tag 流，本流不可达，match 臂类型也不成立）；
    // 未知事件优雅跳过（不抛异常、不打日志），保证投影流不中断。
    val compositeHandlerClass = if (!isComposite) "" else s"""
  /**
   * ${model.selfType.name} 组合分发器：按事件类型把 envelope 路由到对应 per-event Handler；
   * 未知事件优雅跳过（不抛异常、不打日志），保证投影流不中断。
   */
  private class $compositeName(
    ${model.handlers.map(h => s"${decap(h.eventCaseName)}: ${h.selfType.name}").mkString(",\n    ")}
  ) extends JdbcHandler[EventEnvelope[$eventProtoType], ScalikeJdbcSession] {

    override def process(session: ScalikeJdbcSession, envelope: EventEnvelope[$eventProtoType]): Unit =
      envelope.event match {
        ${routableHandlers.map(h => s"case $eventProtoType.${h.eventCaseName}(_) => ${decap(h.eventCaseName)}.process(session, envelope)").mkString("\n        ")}
${if (nonRoutableHandlers.nonEmpty) s"""        // 跨聚合事件（${nonRoutableHandlers.map(_.eventCaseName).mkString(" / ")}）属其他聚合 tag 流，本流不可达，对应 Handler 仅装配不路由
""" else ""}        case _ => ()
      }
  }
"""

    // 5. 构建注释
    val classComment = s"""/**
 * ${model.selfType.name}: Akka Projection 定义。
 * 负责从事件源 (${aggName}) 读取事件并协调给 Handler。
 */
"""

    // 6. 构建完整源代码（M3 多聚合投影：单聚合路径整体让位给 per-aggregate 变体）
    val singleAggregateCode = if (isMultiAggregate) "" else s"""
  $sourceProviderCode

  $projectionFactoryCode
$compositeHandlerClass
"""
    val multiAggregateSection = if (isMultiAggregate) multiAggregateCode else ""

    val body = s"""
  val projectionName = "${model.selfType.name.replace("Projection", "")}"

$singleAggregateCode$multiAggregateSection
"""

    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: Akka Projection 定义。
 * 负责从事件源 (${aggName}) 读取事件并协调给 Handler。
 */
@Singleton
object ${model.selfType.name} {

$body

}
"""

    // 7. 生成代码
    sourceCode
  }
}
