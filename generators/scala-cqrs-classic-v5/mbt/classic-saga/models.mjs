import { copyImmutableData } from '../../../../lib/immutable-data.mjs';
import { fqn } from '../../../../lib/classic-architecture/types.mjs';

// Detached plain data only. Scala Options are null and structural Sets are
// arrays. No complete-file content, clock, registry mutation or I/O lives here.
const immutable = value => copyImmutableData(value);

export function DurationModel(raw, amount = null, unit = null) {
  return immutable({ raw, amount, unit });
}

export function CircuitBreakerModel(maxFailures, callTimeout, resetTimeout) {
  return immutable({ maxFailures, callTimeout, resetTimeout });
}

export function DefinitionResilienceModel(maxRetries, timeoutPerAttempt, recovery, circuitBreaker) {
  return immutable({ maxRetries, timeoutPerAttempt, recovery, circuitBreaker });
}

export function ParticipantErrorRulesModel(errorType, codes, retryable) {
  return immutable({ errorType, codes, retryable });
}

// The original Seq[String] command/participant argument code slots are lowered
// to explicit expression variants. Syntax is supplied only by the template.
export function ParticipantCommandArgumentModel(kind, symbol, asId = false) {
  return immutable({ kind, symbol, asId });
}

export function DefinitionParticipantArgumentModel(kind, symbol = null) {
  return immutable({ kind, symbol });
}

export function ParticipantPhaseAskModel(
  commandType, replyType, commandArgs, repositoryFieldName, resultField, resultFieldIsString,
) {
  return immutable({
    commandType, replyType, commandArgs, repositoryFieldName, resultField, resultFieldIsString,
  });
}

export function SagaParticipantModel(
  selfType, constructorParams, contextType, rules, askTimeout,
  prepareBinding, commitBinding, compensateBinding, dependencies,
) {
  return immutable({
    selfType, constructorParams, contextType, rules, askTimeout,
    prepareBinding, commitBinding, compensateBinding, dependencies, fqn: fqn(selfType),
  });
}

// resilience is the structured counterpart of Scala's resilienceCode slot.
export function DefinitionStepModel(stepId, participantType, participantArgs, resilience, stepGroup) {
  return immutable({ stepId, participantType, participantArgs, resilience, stepGroup });
}

export function SagaDefinitionModel(
  selfType, sagaName, version, argsType, argsFields, contextType, steps, needsMoneyHelper, dependencies,
) {
  return immutable({
    selfType, sagaName, version, argsType, argsFields, contextType, steps, needsMoneyHelper,
    dependencies, fqn: fqn(selfType),
  });
}

export function SagaContextModel(selfType, fields, dependencies) {
  return immutable({ selfType, fields, dependencies, fqn: fqn(selfType) });
}
