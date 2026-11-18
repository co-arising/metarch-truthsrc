import { collectDependencies } from '../../../../lib/classic-architecture/types.mjs';
import { FieldDef } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { SagaContextModel } from './models.mjs';
import { distinct, distinctTypes, fields, product, refuse, sequence } from './shared.mjs';

function repositoryType(participant, ctx) {
  product(participant, 'SagaParticipantMetadata');
  const aggregateName = product(participant.interactsWith, 'AggregateRef').targetName;
  const aggregate = ctx.metaRegistry.resolveByName('AggregateRootMetadata', aggregateName);
  if (!aggregate || aggregate.repository == null)
    refuse(`No repository for ${aggregateName}`, 'CLASSIC_SAGA_REPOSITORY');
  return ctx.typeResolver.resolve(aggregate.repository);
}

/** Frozen SagaContextBuilder: the output name comes from meta.name, even when
 * the explicitly named Context consumed by participant/definition differs.
 * No auto ClusterSharding; merge repositories by simple type name only.
 */
export function buildClassicSagaContext(meta, ctx) {
  product(meta, 'SagaTransactorMetadata');
  const selfType = ctx.typeResolver.sagaContext(meta.name);
  const userFields = meta.context === null ? [] : fields(product(meta.context, 'SagaContextMetadata'), ctx);
  const repositories = distinctTypes(sequence(meta.participants, 'SagaTransactorMetadata.participants')
    .map(participant => repositoryType(participant, ctx)));
  const missing = repositories.filter(repo => !userFields.some(field => field.typeRef.name === repo.name))
    .map(repo => FieldDef(ctx.conventions.firstLower(repo.name), repo));
  const allFields = distinct([...userFields, ...missing]);
  // Intentionally unfiltered: Scala imports same-package and root types here.
  const dependencies = distinctTypes([
    ...repositories, ...collectDependencies(userFields.map(field => field.typeRef)),
  ]);
  return SagaContextModel(selfType, allFields, dependencies);
}
