import { collectDependencies, shouldImport, typeRef } from '../../../../lib/classic-architecture/types.mjs';
import {
  ParticipantCommandArgumentModel, ParticipantErrorRulesModel,
  ParticipantPhaseAskModel, SagaParticipantModel,
} from './models.mjs';
import { contextType, distinct, distinctTypes, duration, fields, isId, mapping, product, refuse, sequence, stepsFor, string } from './shared.mjs';

function repositoryFieldName(participant, ctx) {
  const aggregateType = ctx.typeResolver.resolve(product(participant.interactsWith, 'AggregateRef'));
  const base = ctx.conventions.getAggregateBaseName(aggregateType.name);
  const repositoryName = ctx.conventions.aggregateRepositoryInterfaceName(base);
  const repositoryType = ctx.typeResolver.resolve({ _type: 'AggregateRepositoryRef', targetName: repositoryName });
  return ctx.conventions.firstLower(repositoryType.name);
}

function isRepository(metaType) {
  // All field types first pass through the shared resolver; unknown MetaRefs
  // cannot disappear behind the repository filter. This is not an FQN resolver.
  if (typeof metaType.targetName === 'string') return metaType.targetName.endsWith('Repository');
  if (metaType._type === 'CustomType') {
    return metaType.typeParameters.length === 0 &&
      `${metaType.packagePath}.${metaType.typeName}`.endsWith('Repository');
  }
  return false;
}

function constructorParams(participant, ctx) {
  const resolved = fields(participant, ctx);
  return resolved.filter((_, index) => !isRepository(participant.fields[index].fieldType));
}

function firstBinding(steps, phase) {
  const bindings = steps.map(step => product(step.phaseLogic, 'SagaPhaseLogic')[phase]);
  const binding = bindings.find(value => value !== null);
  return binding === undefined && bindings.every(value => value === null)
    ? null : product(binding, 'CommandBinding');
}

function errorRules(steps) {
  const rules = steps.flatMap(step => sequence(product(step.resilience, 'ResiliencePolicy').errorRules, 'errorRules'));
  rules.forEach(rule => {
    product(rule, 'ErrorRule');
    if (!['MarkAsRetryable', 'MarkAsNonRetryable'].includes(rule.action?._type))
      refuse('Unknown participant ErrorAction');
    string(rule.errorType, 'errorType');
    string(rule.codePattern, 'codePattern');
  });
  const first = rules[0];
  return ParticipantErrorRulesModel(
    first?.errorType ?? 'iMadzError',
    distinct(rules.map(rule => rule.codePattern)),
    first?.action._type === 'MarkAsRetryable',
  );
}

function parameters(meta, ctx) {
  return sequence(meta.parameters, `${meta._type}.parameters`).map(parameter => {
    product(parameter, 'ParameterMetadata');
    string(parameter.name, 'parameter name');
    // Admission only; do not expand the original import dependency Set here.
    ctx.typeResolver.resolve(parameter.parameterType);
    return parameter;
  });
}

function commandArgument(parameter, binding) {
  const symbol = mapping(binding.mappings, parameter.name);
  return ParticipantCommandArgumentModel(
    symbol === 'transactionId' ? 'transaction-id' : 'symbol', symbol, isId(parameter.parameterType),
  );
}

function phaseAsk(binding, repoFieldName, ctx) {
  if (binding === null) return null;
  const ref = product(binding.commandRef, 'CommandRef');
  const commandType = ctx.typeResolver.command(ref);
  const command = ctx.metaRegistry.resolveByName('SubordinateCommandMetadata', ref.targetName);
  if (command === null || command === undefined)
    refuse(`Cannot find metadata for command: ${ref.targetName}`, 'CLASSIC_SAGA_COMMAND');
  product(command, 'SubordinateCommandMetadata');
  const args = parameters(command, ctx)
    .filter(parameter => parameter.name.toLowerCase() !== 'replyto')
    .map(parameter => commandArgument(parameter, binding));
  if (command.replyToType === null)
    refuse(`Command '${ref.targetName}' has no replyToType (H001 should have caught this)`, 'CLASSIC_SAGA_REPLY');
  const replyRef = product(command.replyToType, 'CommandReplyRef');
  const replyType = ctx.typeResolver.resolve(replyRef);
  const reply = ctx.metaRegistry.resolveByName('SubordinateCommandReplyMetadata', replyRef.targetName);
  const result = reply == null ? null : parameters(product(reply, 'SubordinateCommandReplyMetadata'), ctx)
    .find(parameter => parameter.name !== 'error');
  if (!result)
    refuse(`Reply of '${ref.targetName}' has no result field (H001 should have caught this)`, 'CLASSIC_SAGA_REPLY');
  return ParticipantPhaseAskModel(
    commandType, replyType, args, repoFieldName, result.name, result.parameterType._type === 'StringType',
  );
}

function dependencies(params, context, asks, ctx, pkg) {
  const base = [ctx.knownFrameworkTypes.ExecutionContext, typeRef('Scheduler', 'akka.actor.typed'), ctx.types.iMadzError, context];
  const actions = asks.filter(ask => ask !== null).flatMap(ask => [ask.commandType, ask.replyType]);
  const paramDeps = collectDependencies(params.map(param => param.typeRef));
  return distinctTypes([...base, ...actions, ...paramDeps]).filter(ref => shouldImport(ref, pkg));
}

/** Frozen SagaParticipantBuilder.build(participantMeta, transactorMeta, ctx).
 * First binding per phase, all relevant error rules, first timeout; no DSL
 * definition fusion, journaling, adapters or serialization output.
 */
export function buildClassicSagaParticipant(participant, saga, ctx) {
  product(participant, 'SagaParticipantMetadata');
  product(saga, 'SagaTransactorMetadata');
  const pkg = ctx.layout.application.services.transactor.root;
  const selfType = ctx.typeResolver.sagaParticipant(participant.name, pkg);
  const context = contextType(saga, ctx);
  const repository = repositoryFieldName(participant, ctx);
  const params = constructorParams(participant, ctx);
  const steps = stepsFor(participant, saga);
  const asks = ['prepareCommand', 'commitCommand', 'compensateCommand']
    .map(phase => phaseAsk(firstBinding(steps, phase), repository, ctx));
  const timeout = steps.length ? product(steps[0].resilience, 'ResiliencePolicy').timeoutPerAttempt : '5.seconds';
  return SagaParticipantModel(
    selfType, params, context, errorRules(steps), duration(timeout), ...asks,
    dependencies(params, context, asks, ctx, pkg),
  );
}
