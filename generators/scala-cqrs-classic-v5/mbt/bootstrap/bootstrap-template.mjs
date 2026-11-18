import { fqn } from '../../../../lib/classic-architecture/types.mjs';
import {
  AggregateBootstrapType, SagaCoordinatorBootstrapType,
  SagaTransactorBootstrapType, ProjectionBootstrapType,
} from './bootstrap-model.mjs';

/** Frozen BootstrapTemplate + CodeGenerationDSL.ImportDeclaration semantics.
 * Base imports are distinct; the subsequent extra imports are NOT deduplicated.
 * Sorting is Java/Scala string ordering, never locale ordering or formatting.
 */
export function renderClassicBootstrap(model) {
  const baseImports = [...new Set(model.dependencies.map(fqn).sort())];
  const extraImports = model.bootstrapType === ProjectionBootstrapType ? []
    : model.bootstrapType === SagaTransactorBootstrapType ? [
      'akka.actor.typed.Scheduler', 'scala.concurrent.ExecutionContext',
    ] : [
      'akka.cluster.sharding.typed.scaladsl.EntityContext',
      'akka.actor.typed.Behavior',
      'akka.persistence.typed.PersistenceId',
      'akka.persistence.typed.scaladsl.EventSourcedBehavior',
      'akka.cluster.sharding.typed.scaladsl.Entity',
      'scala.concurrent.duration.DurationInt',
      'net.imadz.common.Id',
    ];
  const imports = [...baseImports, ...extraImports].sort().map(name => `import ${name}`).join('\n');
  let body;
  switch (model.bootstrapType) {
    case AggregateBootstrapType: body = renderClassicAggregateBootstrap(model); break;
    case SagaCoordinatorBootstrapType: body = renderClassicSagaCoordinatorBootstrap(model); break;
    case SagaTransactorBootstrapType: body = renderClassicSagaTransactorBootstrap(model); break;
    case ProjectionBootstrapType: body = renderClassicProjectionBootstrap(model); break;
    default: throw new TypeError(`unknown classic BootstrapType: ${model.bootstrapType}`);
  }
  return `package ${model.selfType.packageName}

${imports}

/**
 * ${model.selfType.name}: ${model.bootstrapType} 引导组件
 */
trait ${model.selfType.name} {

${body}

}
`;
}

export function renderClassicAggregateBootstrap(model) {
  const aggName = model.targetName;
  const entityName = model.entityName ?? aggName;
  const eventHandlerName = model.eventHandlerType === null
    ? `${entityName}.eventHandler` : model.eventHandlerType.name;
  if (model.entityTypeKey === null) throw new Error('None.get');
  const typeKey = `${aggName}.${model.entityTypeKey}`;
  const behaviorCall = `${aggName.replaceAll('Aggregate', 'Behaviors')}.apply`;
  const eventAdapter = `new ${aggName.replaceAll('Aggregate', '')}EventAdapter`;
  const snapshotAdapter = `new ${aggName.replaceAll('Aggregate', '')}SnapshotAdapter`;
  const protocolName = aggName.replaceAll('Aggregate', 'Protocol');
  const cmdType = `${protocolName}.${model.commandName}`;
  return `
  def init${aggName}(sharding: ClusterSharding): Unit = {
    val behaviorFactory: EntityContext[${cmdType}] => Behavior[${cmdType}] = { context =>
      val i = math.abs(context.entityId.hashCode % ${aggName}.tags.size)
      val selectedTag = ${aggName}.tags(i)
      apply(context.entityId, selectedTag)
    }

    sharding.init(Entity(${typeKey})(behaviorFactory))
  }

  private def apply(entityId: String, tag: String): Behavior[${cmdType}] =
    Behaviors.logMessages(LogOptions().withLogger(LoggerFactory.getLogger("iMadz")).withLevel(Level.INFO),
      Behaviors.setup { actorContext =>
        EventSourcedBehavior(
          persistenceId = PersistenceId(${typeKey}.name, entityId),
          emptyState = ${entityName}.empty(${model.emptyStateArg ?? 'Id.of(entityId)'}),
          commandHandler = ${behaviorCall},
          // [FIX] 使用 EventHandler.apply
          eventHandler = ${eventHandlerName}.apply
        ).withTagger(_ => Set(tag))
          .withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
          .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1).withStashCapacity(100))
          .eventAdapter(${eventAdapter})
          .snapshotAdapter(${snapshotAdapter})
      })
`;
}

export function renderClassicSagaCoordinatorBootstrap(_model) {
  // Original fixed engine body: Any here is verbatim StepExecutor type erasure,
  // NOT a resolver fallback for a missing metadata/external type.
  return `
  def initSagaEngine[C](sharding: ClusterSharding, context: C, system: akka.actor.typed.ActorSystem[_], globalTimeout: scala.concurrent.duration.FiniteDuration = 5.minutes): Unit = {
    implicit val ec: scala.concurrent.ExecutionContext = system.executionContext
    implicit val askTimeout: Timeout = Timeout(30.seconds)
    val extendedSystem = system.classicSystem.asInstanceOf[ExtendedActorSystem]

    val executorBehavior: String => Behavior[StepExecutor.Command] = name =>
      StepExecutor[Any, Any, C](
        PersistenceId.ofUniqueId(s"saga-executor-$name"),
        context = context,
        defaultMaxRetries = 5,
        initialRetryDelay = 100.millis,
        circuitBreakerSettings = StepExecutor.CircuitBreakerSettings(5, 30.seconds, 30.seconds),
        extendedSystem = extendedSystem)

    sharding.init(Entity(SagaTransactionCoordinator.entityTypeKey) { entityContext =>
      SagaTransactionCoordinator(
        PersistenceId.ofUniqueId(s"saga-coordinator-\${entityContext.entityId}"),
        executorBehavior,
        globalTimeout = globalTimeout)(ec, askTimeout)
    })
  }

  /** Resolves the sharded coordinator for a transaction id (for SagaRunner). */
  def coordinatorRef(sharding: ClusterSharding, transactionId: String): EntityRef[SagaTransactionCoordinator.Command] =
    sharding.entityRefFor(SagaTransactionCoordinator.entityTypeKey, transactionId)
`;
}

export function renderClassicSagaTransactorBootstrap(model) {
  const sagaName = model.targetName;
  const definitionObject = `${sagaName.replaceAll('SagaTransactor', '')}SagaDefinition`;
  return `
  def init${sagaName}(implicit ec: ExecutionContext, scheduler: akka.actor.typed.Scheduler): Unit = {
    ${definitionObject}.register
    ()
  }
`;
}

export function renderClassicProjectionBootstrap(model) {
  const projName = model.targetName;
  if (model.projectionRepo === null || model.sourceAggregateType === null) throw new Error('None.get');
  const repoName = model.projectionRepo.name;
  const sourceAgg = model.sourceAggregateType.name;
  if (model.projectionAggregateTags.length > 0) {
    const aggs = model.projectionAggregateTags.map(ref => ref.name);
    const prefixSum = i => aggs.slice(0, i + 1).map(name => `${name}.tags.size`).join(' + ');
    const total = prefixSum(aggs.length - 1);
    const arms = aggs.map((agg, i) => {
      const aggBase = agg.replaceAll('Aggregate', '');
      const localIndex = i === 0 ? 'index' : `index - (${prefixSum(i - 1)})`;
      return `        if (index < ${prefixSum(i)})
          ProjectionBehavior(${projName}.createProjectionFor${aggBase}(system, sharding, ${localIndex}, repository))`;
    }).join('\n        else ');
    return `
  def init${projName.replaceAll('Projection', '')}Projection(system: ActorSystem[_], sharding: ClusterSharding, repository: ${repoName}): Unit = {
    ShardedDaemonProcess(system).init(
      name = ${projName}.projectionName,
      numberOfInstances = ${total},
      behaviorFactory = index => {
${arms}
        else throw new IllegalStateException(s"projection tag index out of range: $index / ${total}")
      },
      settings = ShardedDaemonProcessSettings(system),
      stopMessage = Some(ProjectionBehavior.Stop)
    )
  }
`;
  }
  return `
  def init${projName.replaceAll('Projection', '')}Projection(system: ActorSystem[_], sharding: ClusterSharding, repository: ${repoName}): Unit = {
    ShardedDaemonProcess(system).init(
      name = ${projName}.projectionName,
      numberOfInstances = ${sourceAgg}.tags.size,
      behaviorFactory = index => ProjectionBehavior(${projName}.createProjection(system, sharding, index, repository)),
      settings = ShardedDaemonProcessSettings(system),
      stopMessage = Some(ProjectionBehavior.Stop)
    )
  }
`;
}
