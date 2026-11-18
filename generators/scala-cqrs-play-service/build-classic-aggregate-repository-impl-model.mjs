import { fail as failProductError } from '../../lib/products/request.mjs';
import { typeRef, collectDependencies, shouldImport } from '../../lib/classic-architecture/types.mjs';
import { removeSuffix } from '../../lib/classic-architecture/naming.mjs';
import { ClassicAggregateRepositoryImplModel, ShardedMethodModel } from './models/classic-aggregate-repository-impl.mjs';

function structuralTypeKey(ref) {
  return JSON.stringify([ref.name, ref.packageName, ref.typeParams.map(structuralTypeKey)]);
}

/** Build the fixed classic repository implementation using the context-v4 API. */
export function buildClassicAggregateRepositoryImpl(meta, ctx) {
  const pkg = ctx.layout.infrastructure.persistence.repositories.aggregate;
  // The metadata overload retains its double getBaseName operation in ctx.
  const selfType = ctx.typeResolver.aggregateRepositoryImpl(meta);
  const interfaceType = ctx.typeResolver.aggregateRepository(meta.name);
  const aggregateType = ctx.typeResolver.aggregateRoot(meta.aggregate.targetName);
  const entityTypeKey = ctx.conventions.entityTypeKeyName(aggregateType.name);

  // Strip only one trailing Aggregate from the resolved root. Retain the raw
  // protocol member, even when that CommandFamily is not actually declared.
  const aggBaseName = removeSuffix(aggregateType.name, 'Aggregate');
  const commandFamily = typeRef(
    `${aggBaseName}CommandFamily`,
    `${aggregateType.packageName}.${aggBaseName}Protocol`,
  );
  const entityRefMethod = ShardedMethodModel(
    'entityRef',
    'id',
    typeRef('String'),
    typeRef('EntityRef', 'akka.cluster.sharding.typed.scaladsl', [commandFamily]),
  );
  // Resolve each QueryMethod's head parameter and return before replacing a
  // declared entityRef. The public compiler admits only the single-param domain.
  const queryMethods = meta.methods.filter(method => method._type === 'QueryMethod').map(query => {
    const param = query.parameters?.[0];
    if (param == null) {
      failProductError('CLASSIC_REPOSITORY_QUERY', `Repository query '${query.name}' requires a first parameter`);
    }
    return ShardedMethodModel(
      query.name,
      param.name,
      ctx.typeResolver.resolve(param.parameterType),
      ctx.typeResolver.resolve(query.returnType),
    );
  }).filter(method => method.name !== 'entityRef');
  const methods = [entityRefMethod, ...queryMethods];

  // Framework/root/interface refs enter directly; only method types recurse.
  // Union is a structural Set[TypeRef], not an FQN or generic-signature set.
  const refs = [
    ctx.knownFrameworkTypes.Inject,
    ctx.knownFrameworkTypes.ClusterSharding,
    ctx.knownFrameworkTypes.EntityRef,
    aggregateType,
    interfaceType,
    ...collectDependencies(methods.flatMap(method => [method.paramType, method.returnType])),
  ];
  const dependencies = [...new Map(refs.map(ref => [structuralTypeKey(ref), ref])).values()]
    .filter(ref => shouldImport(ref, pkg));
  const aggregateMeta = ctx.metaRegistry.resolveByName('AggregateRootMetadata', meta.aggregate.targetName);

  return ClassicAggregateRepositoryImplModel({
    selfType,
    interfaceType,
    entityTypeKey,
    aggregateType,
    methods,
    dependencies,
    noteIds: aggregateMeta?.noteId == null ? [] : [aggregateMeta.noteId],
  });
}
