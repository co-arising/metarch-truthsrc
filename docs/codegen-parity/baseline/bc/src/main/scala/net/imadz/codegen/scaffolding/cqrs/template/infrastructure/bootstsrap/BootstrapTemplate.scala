package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.bootstsrap

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap._
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object BootstrapTemplate extends CodeTemplate[BootstrapModel] {

  def generate(model: BootstrapModel): String = {
    import model._

    // 1. 构建包声明
    val pkgDecl = packageDecl(selfType.packageName)

    // 2. 构建导入声明
    val baseImports = model.dependencies.toList
      .sortBy(_.fqn)
      .map(t => t.fqn)
      .toSeq
      .distinct

    // 3. 根据bootstrap类型添加额外导入
    val extraImports = if (model.bootstrapType == ProjectionBootstrapType) {
      Seq.empty[String]
    } else if (model.bootstrapType == SagaTransactorBootstrapType) {
      Seq(
        "akka.actor.typed.Scheduler",
        "scala.concurrent.ExecutionContext"
      )
    } else {
      Seq(
        "akka.cluster.sharding.typed.scaladsl.EntityContext",
        "akka.actor.typed.Behavior",
        "akka.persistence.typed.PersistenceId",
        "akka.persistence.typed.scaladsl.EventSourcedBehavior",
        "akka.cluster.sharding.typed.scaladsl.Entity",
        "scala.concurrent.duration.DurationInt",
        "net.imadz.common.Id"
      )
    }

    val finalImports = imports((baseImports ++ extraImports): _*)

    // 4. 构建body内容
    val body = model.bootstrapType match {
      case AggregateBootstrapType       => renderAggregateBootstrap(model)
      case SagaCoordinatorBootstrapType => renderSagaBootstrap(model)
      case SagaTransactorBootstrapType  => renderSagaTransactorBootstrap(model)
      case ProjectionBootstrapType      => renderProjectionBootstrap(model)
    }

    // 5. 构建完整源代码
    val traitName = model.selfType.name
    val sourceCode = s"""${pkgDecl.code}

${finalImports.code}

/**
 * $traitName: ${model.bootstrapType} 引导组件
 */
trait $traitName {

$body

}
"""

    // 6. 生成代码
    sourceCode
  }

  private def renderAggregateBootstrap(model: BootstrapModel): String = {
    val aggName = model.targetName
    val entityName = model.entityName.getOrElse(aggName)
    // [FIX] 获取 EventHandler 名称
    val eventHandlerName =
      model.eventHandlerType.map(_.name).getOrElse(s"$entityName.eventHandler")

    val typeKey = s"$aggName.${model.entityTypeKey.get}"
    val behaviorCall = s"${aggName.replace("Aggregate", "Behaviors")}.apply"
    val eventAdapter = s"new ${aggName.replace("Aggregate", "")}EventAdapter"
    val snapshotAdapter =
      s"new ${aggName.replace("Aggregate", "")}SnapshotAdapter"
    // [FIX] Use Protocol for command type
    val protocolName = aggName.replace("Aggregate", "Protocol")
    val cmdType = s"$protocolName.${model.commandName}"

    s"""
  def init${aggName}(sharding: ClusterSharding): Unit = {
    val behaviorFactory: EntityContext[$cmdType] => Behavior[$cmdType] = { context =>
      val i = math.abs(context.entityId.hashCode % $aggName.tags.size)
      val selectedTag = $aggName.tags(i)
      apply(context.entityId, selectedTag)
    }

    sharding.init(Entity($typeKey)(behaviorFactory))
  }

  private def apply(entityId: String, tag: String): Behavior[$cmdType] =
    Behaviors.logMessages(LogOptions().withLogger(LoggerFactory.getLogger("iMadz")).withLevel(Level.INFO),
      Behaviors.setup { actorContext =>
        EventSourcedBehavior(
          persistenceId = PersistenceId($typeKey.name, entityId),
          emptyState = $entityName.empty(${model.emptyStateArg.getOrElse("Id.of(entityId)")}),
          commandHandler = $behaviorCall,
          // [FIX] 使用 EventHandler.apply
          eventHandler = $eventHandlerName.apply
        ).withTagger(_ => Set(tag))
          .withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
          .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1).withStashCapacity(100))
          .eventAdapter($eventAdapter)
          .snapshotAdapter($snapshotAdapter)
      })
"""
  }

  /** saga_v3 generic engine bootstrap: one coordinator sharding (per transactionId)
    * shared by ALL saga definitions. Step executors spawn as coordinator children
    * with deterministic pids so they replay correctly after crashes.
    *
    * Journal pid scheme (getHistory and the onResult projector depend on these):
    *   coordinator: "saga-coordinator-$txId"
    *   executor:    "saga-executor-$txId-$stepId-$phase"
    */
  private def renderSagaBootstrap(model: BootstrapModel): String = {
    s"""
  def initSagaEngine[C](sharding: ClusterSharding, context: C, system: akka.actor.typed.ActorSystem[_], globalTimeout: scala.concurrent.duration.FiniteDuration = 5.minutes): Unit = {
    implicit val ec: scala.concurrent.ExecutionContext = system.executionContext
    implicit val askTimeout: Timeout = Timeout(30.seconds)
    val extendedSystem = system.classicSystem.asInstanceOf[ExtendedActorSystem]

    val executorBehavior: String => Behavior[StepExecutor.Command] = name =>
      StepExecutor[Any, Any, C](
        PersistenceId.ofUniqueId(s"saga-executor-$$name"),
        context = context,
        defaultMaxRetries = 5,
        initialRetryDelay = 100.millis,
        circuitBreakerSettings = StepExecutor.CircuitBreakerSettings(5, 30.seconds, 30.seconds),
        extendedSystem = extendedSystem)

    sharding.init(Entity(SagaTransactionCoordinator.entityTypeKey) { entityContext =>
      SagaTransactionCoordinator(
        PersistenceId.ofUniqueId(s"saga-coordinator-$${entityContext.entityId}"),
        executorBehavior,
        globalTimeout = globalTimeout)(ec, askTimeout)
    })
  }

  /** Resolves the sharded coordinator for a transaction id (for SagaRunner). */
  def coordinatorRef(sharding: ClusterSharding, transactionId: String): EntityRef[SagaTransactionCoordinator.Command] =
    sharding.entityRefFor(SagaTransactionCoordinator.entityTypeKey, transactionId)
"""
  }

  /** saga_v3: registers the saga definition on this node — must run before
    * sharding recovers any entity. */
  private def renderSagaTransactorBootstrap(model: BootstrapModel): String = {
    val sagaName = model.targetName
    val definitionObject = s"${sagaName.replace("SagaTransactor", "")}SagaDefinition"

    s"""
  def init$sagaName(implicit ec: ExecutionContext, scheduler: akka.actor.typed.Scheduler): Unit = {
    $definitionObject.register
    ()
  }
"""
  }

  private def renderProjectionBootstrap(model: BootstrapModel): String = {
    val projName = model.targetName
    val repoName = model.projectionRepo.get.name
    val sourceAgg = model.sourceAggregateType.get.name

    // [M3 多聚合投影] sourceAggregates>1：numberOfInstances=各聚合 tags 之和，
    // index 按聚合顺序偏移分派到 per-aggregate 投影变体（信封类型不可混流——
    // NoteEventPO.Event / ConceptEventPO.Event 各属各的 tag 流）。
    // 分派式：index < 前缀和(i) → 第 i 聚合流（localIndex = index − 前缀和(i−1)）
    if (model.projectionAggregateTags.nonEmpty) {
      val aggs = model.projectionAggregateTags.map(_.name)
      val sizeOf = (a: String) => s"$a.tags.size"
      // prefixSum(i) = a0.size + ... + ai.size
      def prefixSum(i: Int): String = (0 to i).map(j => sizeOf(aggs(j))).mkString(" + ")
      val total = prefixSum(aggs.length - 1)
      val arms = aggs.zipWithIndex.map { case (agg, i) =>
        val aggBase = agg.replace("Aggregate", "")
        val localIndex = if (i == 0) "index" else s"index - (${prefixSum(i - 1)})"
        s"""        if (index < ${prefixSum(i)})
          ProjectionBehavior($projName.createProjectionFor$aggBase(system, sharding, $localIndex, repository))"""
      }.mkString("\n        else ")
      s"""
  def init${projName.replace("Projection", "")}Projection(system: ActorSystem[_], sharding: ClusterSharding, repository: $repoName): Unit = {
    ShardedDaemonProcess(system).init(
      name = $projName.projectionName,
      numberOfInstances = $total,
      behaviorFactory = index => {
$arms
        else throw new IllegalStateException(s"projection tag index out of range: $$index / $total")
      },
      settings = ShardedDaemonProcessSettings(system),
      stopMessage = Some(ProjectionBehavior.Stop)
    )
  }
"""
    } else s"""
  def init${projName.replace(
        "Projection",
        ""
      )}Projection(system: ActorSystem[_], sharding: ClusterSharding, repository: $repoName): Unit = {
    ShardedDaemonProcess(system).init(
      name = $projName.projectionName,
      numberOfInstances = $sourceAgg.tags.size,
      behaviorFactory = index => ProjectionBehavior($projName.createProjection(system, sharding, index, repository)),
      settings = ShardedDaemonProcessSettings(system),
      stopMessage = Some(ProjectionBehavior.Stop)
    )
  }
"""
  }
}
