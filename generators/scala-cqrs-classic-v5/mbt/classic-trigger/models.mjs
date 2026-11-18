import { copyImmutableData } from '../../../../lib/immutable-data.mjs';

// SagaTriggerModels.scala: ordered constructor fields, with detached immutable
// TypeRefs/FieldDefs/sequences. The only source-code slot is argsCtorExpr.
export function SagaTriggerCommandModel(name, params, handlerArgs) {
  return copyImmutableData({ name, params, handlerArgs });
}

export function SagaTriggerProtocolModel(
  selfType, triggerCommands, confirmationType, statusCommandType,
  transactionResultType, tracingStepType, dependencies,
) {
  return copyImmutableData({
    selfType, triggerCommands, confirmationType, statusCommandType,
    transactionResultType, tracingStepType, dependencies,
  });
}

export function SagaTriggerEntityModel(selfType, stateType, argsFields, statusType, dependencies) {
  return copyImmutableData({ selfType, stateType, argsFields, statusType, dependencies });
}

export function SagaTriggerRootModel(
  selfType, entityName, tagPrefix, commandType, coordinatorType,
  contextType, behaviorsType, dependencies,
) {
  return copyImmutableData({
    selfType, entityName, tagPrefix, commandType, coordinatorType,
    contextType, behaviorsType, dependencies,
  });
}

export function SagaTriggerBehaviorsModel(
  selfType, entityName, stateType, eventType, commandType, definitionType,
  argsType, argsFields, triggerCommands, argsCtorExpr, confirmationType,
  statusCommandType, coordinatorType, contextType, transactionResultType, dependencies,
) {
  return copyImmutableData({
    selfType, entityName, stateType, eventType, commandType, definitionType,
    argsType, argsFields, triggerCommands, argsCtorExpr, confirmationType,
    statusCommandType, coordinatorType, contextType, transactionResultType, dependencies,
  });
}
