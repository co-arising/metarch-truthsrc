import { shouldImport, typeRef } from '../../../../lib/classic-architecture/types.mjs';
import {
  CircuitBreakerModel, DefinitionParticipantArgumentModel, DefinitionResilienceModel,
  DefinitionStepModel, SagaDefinitionModel,
} from './models.mjs';
import { contextType, distinctTypes, duration, fields, integer, isId, isMoney, mapping, product, refuse, sequence, stepsFor, string } from './shared.mjs';

function resilience(meta) {
  product(meta, 'ResiliencePolicy');
  // The original wildcard uses 3, but ExponentialBackoff is the only frozen
  // RetryStrategy constructor. Unknown execution products are not admitted.
  product(meta.retryStrategy, 'ExponentialBackoff');
  const maxRetries = meta.retryStrategy._type === 'ExponentialBackoff'
    ? integer(meta.retryStrategy.maxRetries, 'maxRetries') : 3;
  const recovery = meta.recoveryBehavior?._type;
  if (!['RetryIfOngoing', 'FailIfOngoing'].includes(recovery)) refuse('Unknown RecoveryBehavior');
  const breaker = meta.circuitBreaker;
  if (breaker !== null) product(breaker, 'CircuitBreakerConfig');
  const circuitBreaker = breaker === null ? null : CircuitBreakerModel(
    integer(breaker.maxFailures, 'maxFailures'), duration(breaker.callTimeout), duration(breaker.resetTimeout),
  );
  return DefinitionResilienceModel(maxRetries, duration(meta.timeoutPerAttempt), recovery, circuitBreaker);
}

function participantArgument(field, participant, argsTypes) {
  const symbol = mapping(participant.argMappings, field.name);
  if (isMoney(field.fieldType)) return DefinitionParticipantArgumentModel('money');
  if (isId(field.fieldType) && argsTypes.get(symbol)?._type === 'StringType')
    return DefinitionParticipantArgumentModel('id-from-args', symbol);
  return DefinitionParticipantArgumentModel('args-field', symbol);
}

function definitionStep(participant, saga, argsTypes, ctx, pkg) {
  product(participant, 'SagaParticipantMetadata');
  const steps = stepsFor(participant, saga);
  const first = steps[0];
  const stepId = first ? first.stepId : participant.name;
  if (!first) refuse(`Participant '${participant.name}' has no steps`, 'CLASSIC_SAGA_STEP');
  const args = sequence(participant.fields, 'SagaParticipantMetadata.fields')
    .map(field => participantArgument(product(field, 'FieldMetadata'), participant, argsTypes));
  return DefinitionStepModel(
    string(stepId, 'stepId'), ctx.typeResolver.sagaParticipant(participant.name, pkg), args,
    resilience(first.resilience), integer(first.stepGroup, 'stepGroup'),
  );
}

function needsMoneyHelper(participants, argsTypes) {
  return participants.some(participant => participant.fields.some(field => isMoney(field.fieldType))) &&
    argsTypes.has('amount') && argsTypes.has('currency');
}

function participantValueDeps(participants, ctx) {
  // Keep repository fields too, unlike the participant constructor filter.
  return participants.flatMap(participant => fields(participant, ctx).map(field => field.typeRef));
}

function kebab(name) {
  string(name, 'saga base name');
  if (/[^\x00-\x7f]/u.test(name)) refuse('Non-ASCII saga name casing requires a pinned Scala locale contract');
  // Private SagaDefinitionBuilder.kebab: [a-z][A-Z], not the strict/prose rule.
  return name.replace(/([a-z])([A-Z])/gu, '$1-$2').toLowerCase();
}

/** One ordered logical step per participant, not one step per metadata phase.
 * All argument conversions and Money detection retain the original algorithms.
 */
export function buildClassicSagaDefinition(meta, ctx) {
  product(meta, 'SagaTransactorMetadata');
  const pkg = ctx.layout.application.services.transactor.root;
  const baseName = string(meta.name, 'saga name').replaceAll('SagaTransactor', '');
  const selfType = typeRef(`${baseName}SagaDefinition`, pkg);
  const context = contextType(meta, ctx);
  if (meta.args === null)
    refuse(`Saga '${meta.name}' has no args metadata (saga_v3 requires SagaArgsMetadata)`, 'CLASSIC_SAGA_ARGS');
  const args = product(meta.args, 'SagaArgsMetadata');
  const argsType = typeRef(string(args.name, 'args name'), pkg);
  const argsFields = fields(args, ctx);
  const argsTypes = new Map(args.fields.map(field => [field.name, field.fieldType]));
  const participants = sequence(meta.participants, 'SagaTransactorMetadata.participants');
  const steps = participants.map(participant => definitionStep(participant, meta, argsTypes, ctx, pkg));
  const dependencies = distinctTypes([
    ...steps.map(step => step.participantType), context, ...participantValueDeps(participants, ctx),
  ]).filter(ref => shouldImport(ref, pkg));
  return SagaDefinitionModel(
    selfType, kebab(baseName), integer(meta.version, 'version'), argsType, argsFields,
    context, steps, needsMoneyHelper(participants, argsTypes), dependencies,
  );
}
