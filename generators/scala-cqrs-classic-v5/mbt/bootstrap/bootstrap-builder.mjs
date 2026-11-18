import { typeRef, fqn, collectDependencies, shouldImport } from '../../../../lib/classic-architecture/types.mjs';
import {
  ClassicBootstrapModel, bootstrapTypeSet,
  AggregateBootstrapType, SagaCoordinatorBootstrapType,
  SagaTransactorBootstrapType, ProjectionBootstrapType,
} from './bootstrap-model.mjs';

function importedRoots(refs, pkg) {
  return bootstrapTypeSet(refs).filter(ref => shouldImport(ref, pkg));
}

/** BootstrapBuilder.buildAggregate, including its ignored persistence options. */
export function buildClassicAggregateBootstrap(meta, ctx) {
  const resolver = ctx.typeResolver;
  const selfType = resolver.aggregateBootstrap(meta);
  const tagging = meta.persistenceConfig.tagging;
  const sharded = tagging?._type === 'ShardedTags';
  const baseName = sharded ? tagging.baseName : 'tag';
  const shards = sharded ? tagging.numberOfShards : 5;
  // Scala (0 until shards) is empty for zero/negative shard counts; no repair.
  const tags = Array.from({ length: Math.max(0, shards) }, (_, i) => `${baseName}${i}`);
  const aggregateType = resolver.aggregateRoot(meta);
  const entityName = meta.entityRef.targetName;
  const entityType = resolver.entity(entityName);
  if (typeof resolver.entityEventHandler !== 'function') {
    throw new TypeError('classic bootstrap requires ctx.typeResolver.entityEventHandler(entityName): TypeRef (frozen TypeResolverDSL.scala L333–337)');
  }
  const eventHandlerType = resolver.entityEventHandler(entityName);
  const behaviorType = resolver.resolve(meta.behaviorRef);
  const stateType = resolver.resolve(meta.stateRef);
  const eventAdapterType = resolver.aggregateEventAdapter(meta);
  const snapshotAdapterType = resolver.aggregateSnapshotAdapter(meta);
  // Original CustomType resolution applies the known Id override. It is NOT
  // the literal net.imadz.common.Id additionally imported by the template.
  const idType = resolver.resolve({
    _type: 'CustomType', typeName: 'Id', packagePath: 'net.imadz.common', typeParameters: [],
  });
  const refs = [
    aggregateType, resolver.aggregateProtocol(meta), behaviorType, stateType,
    eventAdapterType, snapshotAdapterType, entityType, eventHandlerType, idType,
    ctx.knownFrameworkTypes.ClusterSharding, ctx.knownFrameworkTypes.Entity,
    ctx.knownFrameworkTypes.EntityTypeKey, ctx.knownFrameworkTypes.Behaviors,
    ctx.knownFrameworkTypes.PersistenceId, ctx.knownFrameworkTypes.LogOptions,
    ctx.knownFrameworkTypes.SupervisorStrategy, ctx.knownFrameworkTypes.RetentionCriteria,
    ctx.knownFrameworkTypes.LoggerFactory, ctx.knownFrameworkTypes.Level,
  ];
  return ClassicBootstrapModel({
    selfType, bootstrapType: AggregateBootstrapType,
    targetName: ctx.conventions.aggregateRootName(ctx.conventions.getBaseName(meta.name)),
    commandName: meta.commandFamily.name,
    entityName, eventHandlerType, entityTypeKey: 'entityTypeKey', tags, shards,
    dependencies: importedRoots(refs, selfType.packageName),
    emptyStateArg: meta.identifier.fieldType._type === 'StringType' ? 'entityId' : 'Id.of(entityId)',
    references: collectDependencies(refs),
    retained: meta,
  });
}

/** BootstrapBuilder.buildSagaCoordinator ignores the supplied Saga sequence.
 * It can build with []; only the dispatcher gates emission on nonempty sagas.
 */
export function buildClassicSagaCoordinatorBootstrap(ctx, sagas = []) {
  const resolver = ctx.typeResolver;
  const selfType = resolver.sagaCoordinatorBootstrap;
  const refs = [
    ctx.knownFrameworkTypes.SagaTransactionCoordinator, resolver.stepExecutor,
    ctx.knownFrameworkTypes.ClusterSharding, ctx.knownFrameworkTypes.Entity,
    ctx.knownFrameworkTypes.Behavior, ctx.knownFrameworkTypes.PersistenceId,
    ctx.knownFrameworkTypes.Timeout, ctx.knownFrameworkTypes.ActorSystem,
    resolver.extendedActorSystem, typeRef('FiniteDuration', 'scala.concurrent.duration'),
    typeRef('ExecutionContext', 'scala.concurrent'),
    typeRef('EntityRef', 'akka.cluster.sharding.typed.scaladsl'),
  ];
  return ClassicBootstrapModel({
    selfType, bootstrapType: SagaCoordinatorBootstrapType,
    targetName: 'SagaTransactionCoordinator', commandName: 'Command', shards: 5,
    dependencies: importedRoots(refs, ctx.layout.infrastructure.bootstrap),
    references: collectDependencies(refs), retained: sagas,
  });
}

/** BootstrapBuilder.buildSagaTransactor: one definition registration trait. */
export function buildClassicSagaTransactorBootstrap(meta, ctx) {
  const pkg = `${ctx.basePackage}.infrastructure.bootstrap`;
  const selfType = ctx.typeResolver.bootstrap(`${meta.name}Bootstrap`, pkg);
  // Scala String.replace replaces ALL occurrences, not merely a final suffix.
  const definitionType = typeRef(
    `${meta.name.replaceAll('SagaTransactor', '')}SagaDefinition`,
    ctx.layout.application.services.transactor.root,
  );
  const refs = [
    definitionType, typeRef('Scheduler', 'akka.actor.typed'),
    typeRef('ExecutionContext', 'scala.concurrent'),
  ];
  return ClassicBootstrapModel({
    selfType, bootstrapType: SagaTransactorBootstrapType,
    targetName: meta.name, commandName: '', shards: 5,
    dependencies: importedRoots(refs, pkg),
    references: collectDependencies(refs), retained: meta,
  });
}

/** BootstrapBuilder.buildProjection only; no ProjectionBuilder/model copying. */
export function buildClassicProjectionBootstrap(meta, ctx) {
  const resolver = ctx.typeResolver;
  const pkg = `${ctx.basePackage}.infrastructure.bootstrap`;
  const selfType = resolver.bootstrap(ctx.conventions.getBootstrapNameFromProjectionName(meta.name), pkg);
  const projectionType = resolver.projection(meta.name, ctx.layout.application.projection.root);
  const sourceAggregateType = resolver.aggregateRoot(meta.sourceAggregate);
  if (meta.repositoryRef === null) throw new Error('None.get');
  const projectionRepo = resolver.resolve(meta.repositoryRef);
  const refs = [
    projectionType, projectionRepo, sourceAggregateType,
    ctx.knownFrameworkTypes.ActorSystem, ctx.knownFrameworkTypes.ClusterSharding,
    resolver.shardedDaemonProcess, resolver.shardedDaemonProcessSettings,
    resolver.projectionBehavior,
  ];
  // Original M3 filter: RAW sourceAggregates.size > 1 (not effectiveAggregates),
  // EventRef owner FQN contains .<declared-name>Entity., short-circuiting exists.
  // Retain declaration order and duplicates. If ALL streams disappear, the
  // template falls back to its single-source branch; do not fix that behavior.
  const projectionAggregateTags = meta.sourceAggregates.length > 1
    ? meta.sourceAggregates.filter(name => meta.handlers.some(handler =>
      fqn(resolver.resolve({ _type: 'EventRef', targetName: handler.eventName })).includes(`.${name}Entity.`),
    )).map(name => resolver.aggregateRoot(name))
    : [];
  return ClassicBootstrapModel({
    selfType, bootstrapType: ProjectionBootstrapType,
    targetName: meta.name, commandName: '', projectionRepo, sourceAggregateType,
    projectionAggregateTags, shards: 5,
    dependencies: importedRoots([...refs, ...projectionAggregateTags], pkg),
    references: collectDependencies([...refs, ...projectionAggregateTags]), retained: meta,
  });
}
