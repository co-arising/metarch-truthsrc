package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.bootstrap

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap._
import net.imadz.codegen.scaffolding.cqrs.{
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.meta._
import net.imadz.meta.EventRef
import net.imadz.codegen.structure.NamingConventions

object BootstrapBuilder {

  def buildAggregate(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): BootstrapModel = {
    val selfType = ctx.typeResolver.aggregateBootstrap(meta)
    val (baseName, shards) = meta.persistenceConfig.tagging match {
      case ShardedTags(b, s) => (b, s)
      case _                 => ("tag", 5)
    }
    val tags = (0 until shards).map(i => s"$baseName$i")

    val aggType = ctx.typeResolver.aggregateRoot(meta)

    // Entity
    val entityName = meta.entityRef.targetName
    val entityType = ctx.typeResolver.entity(entityName)

    // EventHandler
    val eventHandlerType = ctx.typeResolver.entityEventHandler(entityName)

    val behaviorType = ctx.typeResolver.resolve(meta.behaviorRef)
    val stateType = ctx.typeResolver.resolve(meta.stateRef)
    val eventAdapter = ctx.typeResolver.aggregateEventAdapter(meta)
    val snapshotAdapter = ctx.typeResolver.aggregateSnapshotAdapter(meta)

    // [FIX] Id Type
    val idType = ctx.typeResolver.resolve(CustomType("Id", "net.imadz.common"))

    val deps = Set(
      aggType,
      ctx.typeResolver.aggregateProtocol(meta), // Add Protocol Dependency
      behaviorType,
      stateType,
      eventAdapter,
      snapshotAdapter,
      entityType,
      // [FIX] 添加 EventHandler 和 Id 依赖
      eventHandlerType,
      idType,
      ctx.knownFrameworkTypes("ClusterSharding"),
      ctx.knownFrameworkTypes("Entity"),
      ctx.knownFrameworkTypes("EntityTypeKey"),
      ctx.knownFrameworkTypes("Behaviors"),
      ctx.knownFrameworkTypes("PersistenceId"),
      ctx.knownFrameworkTypes("LogOptions"),
      ctx.knownFrameworkTypes("SupervisorStrategy"),
      ctx.knownFrameworkTypes("RetentionCriteria"),
      ctx.knownFrameworkTypes("LoggerFactory"),
      ctx.knownFrameworkTypes("Level")
    )
    val dependencies = deps.filter(_.shouldImport(selfType.packageName))

    BootstrapModel(
      selfType = selfType,
      bootstrapType = AggregateBootstrapType,
      // 2026-08-21 摄入侧适配：聚合名不带 Aggregate 后缀 → 统一命名规范（模板 replace("Aggregate",...) 依赖后缀）
      targetName = NamingConventions.aggregateRootName(NamingConventions.getBaseName(meta.name)),
      commandName = meta.commandFamily.name,
      entityName = Some(entityName),
      eventHandlerType = Some(eventHandlerType), // [FIX] Set
      entityTypeKey = Some("entityTypeKey"),
      tags = Some(tags),
      sagaRepositories = Nil,
      transactorRepo = None,
      transactorContext = None,
      transactorContextInit = None,
      projectionRepo = None,
      sourceAggregateType = None,
      shards = shards,
      dependencies = dependencies,
      // 空状态初始化表达式按聚合标识符实际类型推导（Gate-2）：String 标识符
      // 直接用 entityId；其余（框架 Id 先例）用 Id.of(entityId)。
      emptyStateArg = Some(meta.identifier.fieldType match {
        case StringType => "entityId"
        case _          => "Id.of(entityId)"
      })
    )
  }

  /** saga_v3: generic engine bootstrap — one coordinator sharding shared by ALL
    * saga definitions; executors spawn as coordinator children with deterministic
    * pids (saga-coordinator-$txId / saga-executor-$txId-$stepId-$phase). */
  def buildSagaCoordinator(
      sagas: Seq[SagaTransactorMetadata],
      ctx: GeneratorContext
  ): BootstrapModel = {
    val pkg = ctx.layout.infrastructure.bootstrap
    val selfType = ctx.typeResolver.sagaCoordinatorBootstrap
    val coordinatorType = ctx.knownFrameworkTypes("SagaTransactionCoordinator")
    val deps = Set(
      coordinatorType,
      ctx.typeResolver.stepExecutor,
      ctx.knownFrameworkTypes("ClusterSharding"),
      ctx.knownFrameworkTypes("Entity"),
      ctx.knownFrameworkTypes("Behavior"),
      ctx.knownFrameworkTypes("PersistenceId"),
      ctx.knownFrameworkTypes("Timeout"),
      ctx.knownFrameworkTypes("ActorSystem"),
      ctx.typeResolver.extendedActorSystem,
      TypeRef("FiniteDuration", "scala.concurrent.duration"),
      TypeRef("ExecutionContext", "scala.concurrent"),
      TypeRef("EntityRef", "akka.cluster.sharding.typed.scaladsl")
    )
    val dependencies = deps.filter(_.shouldImport(pkg))

    BootstrapModel(
      selfType = selfType,
      bootstrapType = SagaCoordinatorBootstrapType,
      targetName = "SagaTransactionCoordinator",
      commandName = "Command",
      entityName = None,
      eventHandlerType = None,
      entityTypeKey = None,
      tags = None,
      sagaRepositories = Nil,
      transactorRepo = None,
      transactorContext = None,
      transactorContextInit = None,
      projectionRepo = None,
      sourceAggregateType = None,
      shards = 5,
      dependencies = dependencies
    )
  }

  /** saga_v3: per-saga bootstrap — registers the SagaDefinition on this node
    * (must run before sharding recovers any entity). */
  def buildSagaTransactor(
      meta: SagaTransactorMetadata,
      ctx: GeneratorContext
  ): BootstrapModel = {
    val pkg = s"${ctx.basePackage}.infrastructure.bootstrap"
    val name = s"${meta.name}Bootstrap"
    val selfType = ctx.typeResolver.bootstrap(name, pkg)
    val baseName = meta.name.replace("SagaTransactor", "")
    val definitionType =
      TypeRef(s"${baseName}SagaDefinition", ctx.layout.application.services.transactor.root)
    val deps = Set(
      definitionType,
      TypeRef("Scheduler", "akka.actor.typed"),
      TypeRef("ExecutionContext", "scala.concurrent")
    )
    val dependencies = deps.filter(_.shouldImport(pkg))

    BootstrapModel(
      selfType = selfType,
      bootstrapType = SagaTransactorBootstrapType,
      targetName = meta.name,
      commandName = "",
      entityName = None,
      eventHandlerType = None,
      entityTypeKey = None,
      tags = None,
      sagaRepositories = Nil,
      transactorRepo = None,
      transactorContext = None,
      transactorContextInit = None,
      projectionRepo = None,
      sourceAggregateType = None,
      shards = 5,
      dependencies = dependencies
    )
  }

  def buildProjection(
      meta: ProjectionMetadata,
      ctx: GeneratorContext
  ): BootstrapModel = {
    // ... (保持不变) ...
    val pkg = s"${ctx.basePackage}.infrastructure.bootstrap"
    val name = NamingConventions.getBootstrapNameFromProjectionName(meta.name)
    val selfType = ctx.typeResolver.bootstrap(name, pkg)
    val projPkg = ctx.layout.application.projection.root
    val projObjType = ctx.typeResolver.projection(meta.name, projPkg)
    val aggPkg = ctx.layout.application.aggregates.root
    val sourceAggType = ctx.typeResolver.aggregateRoot(meta.sourceAggregate)
    val repoType = meta.repositoryRef.map(ctx.typeResolver.resolve(_)).get
    val deps = Set(
      projObjType,
      repoType,
      sourceAggType,
      ctx.knownFrameworkTypes("ActorSystem"),
      ctx.knownFrameworkTypes("ClusterSharding"),
      ctx.typeResolver.shardedDaemonProcess,
      ctx.typeResolver.shardedDaemonProcessSettings,
      ctx.typeResolver.projectionBehavior
    )
    val dependencies = deps.filter(t => t.shouldImport(pkg))

    // [M3 多聚合投影] sourceAggregates>1：各聚合对象（.tags 枚举）进 Bootstrap 依赖，
    // numberOfInstances=各聚合 tags 之和，index 按聚合顺序偏移分派到 per-aggregate 投影变体。
    // 与 ProjectionBuilder 空流过滤同律：视图消费意图归零的聚合流整体退场（空壳分发器编译红·
    // #4 Stage 意图迁移实证）——否则 Bootstrap 还会按 tags 求和给已消失的 createProjectionForX 分片。
    // 判据与 ProjectionBuilder 一致：事件归属聚合（EventRef fqn 含 .<Agg>Entity.）的 handler 非空才保留。
    val aggregateTags = if (meta.sourceAggregates.size > 1)
      meta.sourceAggregates
        .filter(aggName => meta.handlers.exists { h =>
          ctx.typeResolver.resolve(EventRef(h.eventName)).fqn.contains(s".${aggName}Entity.")
        })
        .map(ctx.typeResolver.aggregateRoot)
    else Nil
    val aggregateTagDeps = aggregateTags.toSet.filter(_.shouldImport(pkg))

    BootstrapModel(
      selfType = selfType,
      bootstrapType = ProjectionBootstrapType,
      targetName = meta.name,
      commandName = "",
      entityName = None,
      eventHandlerType = None,
      entityTypeKey = None,
      tags = None,
      sagaRepositories = Nil,
      transactorRepo = None,
      transactorContext = None,
      transactorContextInit = None,
      projectionRepo = Some(repoType),
      sourceAggregateType = Some(sourceAggType),
      projectionAggregateTags = aggregateTags,
      shards = 5,
      dependencies = dependencies ++ aggregateTagDeps
    )
  }
}
