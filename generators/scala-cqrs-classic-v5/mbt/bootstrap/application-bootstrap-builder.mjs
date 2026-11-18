import { typeRef, collectDependencies, shouldImport } from '../../../../lib/classic-architecture/types.mjs';
import { FieldDef } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { bootstrapTypeSet } from './bootstrap-model.mjs';
import { ClassicApplicationBootstrapModel } from './application-bootstrap-model.mjs';
import {
  SagaRegistrationStartupModel, SagaEngineStartupModel,
  AggregateStartupModel, ProjectionStartupModel,
} from './startup-models.mjs';

function repositoryParameter(repositoryType, ctx) {
  // Unlike NamingConventions.firstLower, the original builder calls name.head
  // without an empty guard. Preserve failure before using centralized casing.
  if (repositoryType.name.length === 0) throw new RangeError('empty.head');
  return ctx.conventions.firstLower(repositoryType.name);
}

/** Full ApplicationBootstrapBuilder.build. No partial global-file patching.
 * Only repo injections are sorted. Trait/call order is the original scan order.
 * strictEntries is an explicit attachment, never inferred from classic Sagas.
 */
export function buildClassicApplicationBootstrap(system, ctx, strictEntries = []) {
  const resolver = ctx.typeResolver;
  const pkg = ctx.layout.infrastructure.bootstrap;
  const selfType = resolver.applicationBootstrap;
  const aggregates = system.application.aggregates;
  const sagas = system.application.sagas;
  const projections = system.infrastructure.projections;
  const extraDeps = [];
  const importOnlyDeps = [];
  const initCalls = [];

  for (const saga of sagas) {
    const definitionType = typeRef(
      `${saga.name.replaceAll('SagaTransactor', '')}SagaDefinition`,
      ctx.layout.application.services.transactor.root,
    );
    importOnlyDeps.push(definitionType);
    initCalls.push(SagaRegistrationStartupModel(saga.name, definitionType));
  }
  if (sagas.length > 0) {
    const saga = sagas[0];
    // Exact .head semantics: not the first nonempty Saga/participant, not all
    // participants, and not a context-field-based repository inference.
    if (saga.participants.length === 0) throw new RangeError('head of empty list');
    const participant = saga.participants[0];
    const aggregate = ctx.metaRegistry.resolveByName('AggregateRootMetadata', participant.interactsWith.targetName);
    const repoRef = aggregate === null ? null : aggregate.repository;
    if (repoRef === null) throw new Error('Repo not found');
    const repositoryType = resolver.resolve(repoRef);
    extraDeps.push(repositoryType);
    const contextType = resolver.sagaContext(saga.context === null ? saga.name : saga.context.name);
    importOnlyDeps.push(contextType);
    const repositoryParam = repositoryParameter(repositoryType, ctx);
    // The inline constructor uses raw Some(context.name), or RAW sagaName +
    // Context. The imported type independently goes through sagaContext().
    const contextName = saga.context === null ? `${saga.name}Context` : saga.context.name;
    initCalls.push(SagaEngineStartupModel(contextType, contextName, repositoryType, repositoryParam));
  }

  for (const meta of aggregates) {
    const aggregateName = ctx.conventions.aggregateRootName(ctx.conventions.getBaseName(meta.name));
    initCalls.push(AggregateStartupModel(
      aggregateName, ctx.conventions.getAggregateInitMethodNameFromAggregateName(aggregateName),
      resolver.aggregateRoot(meta),
    ));
  }
  for (const meta of projections) {
    if (meta.repositoryRef === null) throw new Error('None.get');
    const repositoryType = resolver.resolve(meta.repositoryRef);
    extraDeps.push(repositoryType);
    initCalls.push(ProjectionStartupModel(
      meta.name, ctx.conventions.getProjectionInitMethodName(meta.name),
      resolver.projection(meta.name, ctx.layout.application.projection.root),
      repositoryType, repositoryParameter(repositoryType, ctx),
    ));
  }

  const frameworkFields = [
    FieldDef('classicSystem', resolver.classicActorSystem),
    FieldDef('sharding', ctx.knownFrameworkTypes.ClusterSharding),
  ];
  const repositoryTypes = bootstrapTypeSet(extraDeps);
  const repoFields = repositoryTypes.map(ref => FieldDef(repositoryParameter(ref, ctx), ref))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const injectedFields = [...frameworkFields, ...repoFields];
  const frameworkDeps = [
    ctx.knownFrameworkTypes.Inject, ctx.knownFrameworkTypes.Singleton,
    resolver.actorSystem, resolver.actorSystemTyped, ctx.knownFrameworkTypes.adapter,
    resolver.executionContext, resolver.extendedActorSystem,
  ];
  const traits = bootstrapTypeSet([
    ...aggregates.map(meta => resolver.bootstrap(`${ctx.conventions.getAggregateBaseName(meta.name)}Bootstrap`)),
    ...(sagas.length > 0 ? [resolver.sagaCoordinatorBootstrap] : []),
    ...sagas.map(meta => resolver.bootstrap(`${meta.name}Bootstrap`)),
    ...projections.map(meta => resolver.bootstrap(ctx.conventions.getBootstrapNameFromProjectionName(meta.name))),
  ]);
  const roots = [...frameworkDeps, ...traits, ...repositoryTypes, ...importOnlyDeps,
    ...frameworkFields.map(field => field.typeRef)];
  const startupRefs = initCalls.flatMap(call => {
    switch (call.kind) {
      case 'saga-registration': return [call.definitionType];
      case 'saga-engine': return [call.contextType, call.repositoryType];
      case 'aggregate': return [call.aggregateType];
      case 'projection': return [call.projectionType, call.repositoryType];
      default: throw new TypeError(`unknown bootstrap startup kind: ${call.kind}`);
    }
  });
  return ClassicApplicationBootstrapModel({
    selfType, traits, initCalls, injectedFields, strictEntries,
    dependencies: bootstrapTypeSet(roots).filter(ref => shouldImport(ref, pkg)),
    references: collectDependencies([...roots, ...startupRefs]), retained: system,
  });
}
