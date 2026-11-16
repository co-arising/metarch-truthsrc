package net.imadz.codegen.scaffolding.cqrs

import net.imadz.codegen.logic.DeepMetaScanner
import net.imadz.codegen.logic.graph.EnhancedDependencyGraphBuilder
import net.imadz.codegen.structure._
import net.imadz.meta._

import scala.reflect.ClassTag

// MetadataRegistry 保持不变（2026-08-21 修复：按 name 的 Map 在「聚合名 == 角色名」（User）等撞名时互相覆盖，
// resolve 强转出错——改为 Seq 全量保留 + 类型过滤解析，API 不变）
case class MetadataRegistry(
    private val metas: Seq[DomainDrivenMetadata]
) {
  def resolve[T <: MetaType](ref: MetaRef): Option[T] = {
    metas
      .find(m => m.name == ref.targetName && m.isInstanceOf[T])
      .map(_.asInstanceOf[T])
  }

  def resolveByName[T <: MetaType](name: String): Option[T] =
    metas.find(m => m.name == name && m.isInstanceOf[T]).map(_.asInstanceOf[T])

  def resolveAll[T <: MetaType](implicit
      tag: scala.reflect.ClassTag[T]
  ): Seq[T] = {
    metas.collect {
      case m if tag.runtimeClass.isInstance(m) => m.asInstanceOf[T]
    }.toSeq
  }
}

/** 代码生成器上下文，用于存储生成过程中的所有状态和配置
  */
case class GeneratorContext(
    rootPackage: String,
    frameworkPackage: String,
    moduleName: String,
    symbolTable: SymbolTable = SymbolTable.empty,
    metaRegistry: MetadataRegistry = MetadataRegistry(Nil),
    var artifactRegistry: ArtifactRegistry = ArtifactRegistry.empty,
    var registry: DomainRegistry = null,
    var scaffolding: Scaffolding = null,
    // E5-WP1（2026-09-12）：关注点作用域守卫（B 策略默认 All——零行为变化；Option A 预留）
    scope: ScopeFilter = ScopeFilter.All,
    /** EP_Field_Nature_And_Concern_Anchors Phase 3(a)：命中「排除聚合状态列」处置的字段 nature 集
      * （如 credential）。**按性质过滤、不按字段名**——域模型状态字段（identifier/state/proto/converter）
      * 中 nature ∈ 此集的成员不发射。空集＝零行为变化（未指定 concern 时的缺省）。 */
    excludedStateFieldNatures: Set[String] = Set.empty,
    /** P2 Slice 2：形式路径行为语义附件（systemFile 路径的 formal-semantics）。缺省 None＝
      * Examples/既有入口零行为变化；仅 systemFile+契约准入路径由 CodegenMain 注入。 */
    formalSemantics: Option[net.imadz.meta.filesystem.FormalSemantics] = None
) {
  /** 状态字段是否被锚定排除（nature 命中排除集）——三处发射点（DomainEntityBuilder/
    * AggregateRootProtoBuilder/AggregateConverterBuilder）共用此唯一判据。 */
  def isStateFieldExcluded(f: net.imadz.meta.FieldMetadata): Boolean =
    f.nature.nonEmpty && excludedStateFieldNatures.contains(f.nature)

  /** DSL风格的类型解析器
    */
  val typeResolver: TypeResolverDSL = TypeResolverDSL(this)
  def basePackage: String = s"$rootPackage.$moduleName"

  val types = new FrameworkTypes(frameworkPackage)

  /** 统一命名规范 */
  val conventions = NamingConventions
  val knownFrameworkTypes: Map[String, TypeRef] = Map(
    "Id" -> types.Id,
    "CborSerializable" -> types.CborSerializable,
    "Future" -> TypeRef("Future", "scala.concurrent"),
    "Either" -> TypeRef("Either", "scala"),
    "Inject" -> TypeRef("Inject", "javax.inject"),
    "Singleton" -> TypeRef("Singleton", "javax.inject"),
    "ImplementedBy" -> TypeRef("ImplementedBy", "com.google.inject"),
    "ControllerComponents" -> TypeRef("ControllerComponents", "play.api.mvc"),
    "BaseController" -> TypeRef("BaseController", "play.api.mvc"),
    "Action" -> TypeRef("Action", "play.api.mvc"),
    "AnyContent" -> TypeRef("AnyContent", "play.api.mvc"),
    "Request" -> TypeRef("Request", "play.api.mvc"),
    "Json" -> TypeRef("Json", "play.api.libs.json"),
    "List" -> TypeRef("List", "scala.collection.immutable"),
    // EP_Field_Nature_And_Concern_Anchors（2026-09-18）：Option 注册为框架类型——
    // 可选 VO 成员（真源 optional:true）解析出 scala.Option[T]（缺此项时 CustomType 兜底
    // 会把 Option 拉到 net.imadz.domain.values → 悬空引用）
    "Option" -> TypeRef("Option", "scala"),
    "Map" -> TypeRef("Map", "scala.collection.immutable"),
    "BigDecimal" -> TypeRef("BigDecimal", "scala.math"),
    "ActorRef" -> TypeRef("ActorRef", "akka.actor.typed"),
    "ActorSystem" -> TypeRef("ActorSystem", "akka.actor.typed"),
    "Scheduler" -> TypeRef("Scheduler", "akka.actor.typed"),
    "Behaviors" -> TypeRef("Behaviors", "akka.actor.typed.scaladsl"),
    "Behavior" -> TypeRef("Behavior", "akka.actor.typed"),
    "ActorContext" -> TypeRef("ActorContext", "akka.actor.typed.scaladsl"),
    "adapter" -> TypeRef("adapter", "akka.actor.typed.scaladsl"),
    "ClusterSharding" -> TypeRef(
      "ClusterSharding",
      "akka.cluster.sharding.typed.scaladsl"
    ),
    "Entity" -> TypeRef("Entity", "akka.cluster.sharding.typed.scaladsl"),
    "EntityContext" -> TypeRef(
      "EntityContext",
      "akka.cluster.sharding.typed.scaladsl"
    ),
    "EntityTypeKey" -> TypeRef(
      "EntityTypeKey",
      "akka.cluster.sharding.typed.scaladsl"
    ),
    "EntityRef" -> TypeRef("EntityRef", "akka.cluster.sharding.typed.scaladsl"),
    "PersistenceId" -> TypeRef("PersistenceId", "akka.persistence.typed"),
    "Effect" -> TypeRef("Effect", "akka.persistence.typed.scaladsl"),
    "Timeout" -> TypeRef("Timeout", "akka.util"),
    "ExecutionContext" -> TypeRef("ExecutionContext", "scala.concurrent"),
    "Projection" -> TypeRef("Projection", "akka.projection"),
    "ProjectionId" -> TypeRef("ProjectionId", "akka.projection"),
    "Offset" -> TypeRef("Offset", "akka.persistence.query"),
    "EventEnvelope" -> TypeRef("EventEnvelope", "akka.projection.eventsourced"),
    "EventSourcedProvider" -> TypeRef(
      "EventSourcedProvider",
      "akka.projection.eventsourced.scaladsl"
    ),
    "SourceProvider" -> TypeRef("SourceProvider", "akka.projection.scaladsl"),
    "ExactlyOnceProjection" -> TypeRef(
      "ExactlyOnceProjection",
      "akka.projection.scaladsl"
    ),
    "JdbcProjection" -> TypeRef(
      "JdbcProjection",
      "akka.projection.jdbc.scaladsl"
    ),
    "JdbcHandler" -> TypeRef("JdbcHandler", "akka.projection.jdbc.scaladsl"),
    "MongoReadJournal" -> TypeRef(
      "MongoReadJournal",
      "akka.contrib.persistence.mongodb"
    ),
    "ScalikeJdbcSession" -> TypeRef(
      "ScalikeJdbcSession",
      "net.imadz.common.application.projection"
    ),
    "ScalikeJdbcSetup" -> TypeRef(
      "ScalikeJdbcSetup",
      "net.imadz.common.application.projection"
    ),
    "iMadzError" -> types.iMadzError,
    "InvariantRule" -> types.InvariantRule,
    "CommandHelper" -> types.CommandHelper,
    "runReplyingPolicy" -> TypeRef(
      "runReplyingPolicy",
      "net.imadz.common.application.CommandHandlerReplyingBehavior"
    ),
    "SagaTransactionCoordinator" -> TypeRef(
      "SagaTransactionCoordinator",
      "net.imadz.infra.saga"
    ),
    "SagaStep" -> TypeRef("SagaStep", "net.imadz.infra.saga"),
    "SagaTransactionStep" -> TypeRef(
      "SagaTransactionStep",
      "net.imadz.infra.saga"
    ),
    "PreparePhase" -> TypeRef("PreparePhase", "net.imadz.infra.saga.SagaPhase"),
    "CommitPhase" -> TypeRef("CommitPhase", "net.imadz.infra.saga.SagaPhase"),
    "CompensatePhase" -> TypeRef(
      "CompensatePhase",
      "net.imadz.infra.saga.SagaPhase"
    ),
    "TransactionResult" -> TypeRef(
      "TransactionResult",
      "net.imadz.infra.saga.SagaTransactionCoordinator"
    ),
    "TracingStep" -> TypeRef(
      "TracingStep",
      "net.imadz.infra.saga.SagaTransactionCoordinator"
    ),
    "SagaParticipant" -> TypeRef("SagaParticipant", "net.imadz.infra.saga"),
    "ParticipantEffect" -> TypeRef(
      "ParticipantEffect",
      "net.imadz.infra.saga.SagaParticipant"
    ),
    "SagaResult" -> TypeRef(
      "SagaResult",
      "net.imadz.infra.saga.SagaParticipant"
    ),
    "Json" -> TypeRef("Json", "play.api.libs.json"),
    "OWrites" -> TypeRef("OWrites", "play.api.libs.json"),
    "ControllerComponents" -> TypeRef("ControllerComponents", "play.api.mvc"),
    "BaseController" -> TypeRef("BaseController", "play.api.mvc"),
    "Action" -> TypeRef("Action", "play.api.mvc"),
    "AnyContent" -> TypeRef("AnyContent", "play.api.mvc"),
    "Request" -> TypeRef("Request", "play.api.mvc"),
    "AkkaSerializationWrapper" -> TypeRef(
      "AkkaSerializationWrapper",
      "net.imadz.infra.saga.serialization"
    ),
    "StepExecutor" -> TypeRef("StepExecutor", "net.imadz.infra.saga"),
    "ForSaga" -> TypeRef("ForSaga", "net.imadz.infra.saga"),
    "LogOptions" -> TypeRef("LogOptions", "akka.actor.typed"),
    "SupervisorStrategy" -> TypeRef("SupervisorStrategy", "akka.actor.typed"),
    "RetentionCriteria" -> TypeRef(
      "RetentionCriteria",
      "akka.persistence.typed.scaladsl"
    ),
    "LoggerFactory" -> TypeRef("LoggerFactory", "org.slf4j"),
    "Level" -> TypeRef("Level", "org.slf4j.event"),
    "ReadModel" -> TypeRef(
      "ReadModel",
      s"${frameworkPackage}.common.CommonTypes"
    )
  )

  /** 通用递归依赖收集器 结合了 DeepMetaScanner 的扫描能力和 Registry 的解析能力。
    */
  def collectDeepDependencies[T <: DomainDrivenMetadata: ClassTag](
      roots: Seq[Any]
  ): Set[T] = {
    val visited = scala.collection.mutable.Set[String]()
    val results = scala.collection.mutable.Set[T]()

    def loop(obj: Any): Unit = {
      val dataTypes = DeepMetaScanner.scan(obj)

      dataTypes.foreach {
        case ref: MetaRef =>
          metaRegistry.resolve[DomainDrivenMetadata](ref) match {
            case Some(meta) =>
              if (!visited.contains(meta.name)) {
                visited.add(meta.name)
                implicitly[ClassTag[T]].unapply(meta).foreach { t =>
                  results.add(t)
                  loop(t)
                }
              }
            case None =>
          }
        case ct: CustomType =>
          // [FIX] Try to resolve CustomType against known Metadata to support nested types
          metaRegistry.resolveByName[DomainDrivenMetadata](ct.typeName).foreach { meta =>
             if (!visited.contains(meta.name)) {
                implicitly[ClassTag[T]].unapply(meta).foreach { t =>
                   visited.add(meta.name)
                   results.add(t)
                   loop(t)
                }
             }
          }
          ct.typeParameters.foreach(loop)
        case _ =>
      }
    }

    roots.foreach(loop)
    results.toSet
  }

  // 懒加载布局
  lazy val layout: PackageLayout = PackageLayout(basePackage)

  // 需要在生成开始前调用
  def init(system: SystemMetadata): Unit = {
    this.registry = new DomainRegistry(system, layout)
    this.scaffolding = Scaffolding(this)
  }
}

class FrameworkTypes(frameworkPkg: String) {
  val CborSerializable = TypeRef("CborSerializable", s"$frameworkPkg.common")
  val Id = TypeRef("Id", s"$frameworkPkg.common.CommonTypes")
  val UUID = TypeRef("UUID", s"java.util")
  val InvariantRule =
    TypeRef("InvariantRule", s"$frameworkPkg.common.CommonTypes")
  val iMadzError = TypeRef("iMadzError", s"$frameworkPkg.common.CommonTypes")
  val DomainService =
    TypeRef("DomainService", s"$frameworkPkg.common.CommonTypes")
  val CommandHelper = TypeRef(
    "CommandHelper",
    s"$frameworkPkg.common.application.CommandHandlerReplyingBehavior"
  )
}

object GeneratorContext {
  def fromSystemMetadata(
      system: SystemMetadata,
      formalSemantics: Option[net.imadz.meta.filesystem.FormalSemantics] = None
  ): GeneratorContext = {
    val allMetas = EnhancedDependencyGraphBuilder.flattenAllComponents(system)
    val registry = MetadataRegistry(allMetas)

    val symbolTableEntries = allMetas.flatMap { meta =>
      collectOwnedTypeNames(meta).map { nestedName =>
        NestedTypeName(nestedName) -> OwnerEntityName(meta.name)
      }
    }

    val symbolTable = SymbolTable.of(symbolTableEntries: _*)

    new GeneratorContext(
      rootPackage = "net.imadz",
      frameworkPackage = "net.imadz",
      moduleName = system.contextName.getOrElse("codegen"),
      symbolTable = symbolTable,
      metaRegistry = registry,
      formalSemantics = formalSemantics
    )
  }

  private def collectOwnedTypeNames(meta: DomainDrivenMetadata): Seq[String] =
    meta match {
      case entity: DomainEntityMetadata =>
        Seq(
          entity.state.name,
          entity.eventFamily.name,
          eventHandlerTypeAlias(entity)
        ) ++
          entity.eventFamily.events.map(_.name)
      case agg: AggregateRootMetadata =>
        agg.commandFamily.commands.map(_.name) ++
          agg.replyFamily.replies.map(_.name) ++
          Seq(agg.commandFamily.name, agg.replyFamily.name)
      case saga: SagaTransactorMetadata =>
        val sagaEvents = Seq(
          "TransactionInitiated",
          "TransactionPrepared",
          "TransactionCompleted",
          "TransactionFailed"
        )
        val stateName = NamingConventions.getSagaTransactionStateName(saga.name)

        saga.commandFamily.commands.map(_.name) ++
          Seq(saga.commandFamily.name) ++
          saga.replyMetadata.map(r => Seq(r.name)).getOrElse(Nil) ++
          sagaEvents :+ stateName
      case query: QueryServiceMetadata =>
        query.structs.map(_.name) ++
          query.methods.map(method =>
            method.returnType.fullQualifiedName.dottedPath.split('.').last
          )
      case _ =>
        Seq.empty
    }

  private def eventHandlerTypeAlias(entity: DomainEntityMetadata) = {
    s"${entity.eventFamily.name}Handler"
  }
}
