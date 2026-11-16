import { copyImmutableData } from '../../../lib/immutable-data.mjs';

/**
 * Plain-data counterparts of the fixed Scala AggregateBehaviorModel.scala.
 * Type references are shared { name, packageName, typeParams } records; Scala
 * Option is null and Seq/Set are arrays. Dependencies are a structural Set,
 * not a recursive dependency closure. No model field contains a whole file.
 */
export function AggregateBehaviorModel({
  selfType,
  aggregateType,
  stateType,
  eventType,
  commandType,
  commandHelpers,
  behaviorGroups,
  dependencies,
  noteIds = [],
  contextType = null,
}) {
  return copyImmutableData({
    selfType,
    aggregateType,
    stateType,
    eventType,
    commandType,
    commandHelpers,
    behaviorGroups,
    dependencies,
    noteIds,
    contextType,
  });
}

export function BehaviorGroupModel(name, handlers) {
  return copyImmutableData({ name, handlers });
}

export function CommandHandlerModel(commandType, logic, groupName = 'default') {
  if (!['PolicyBasedLogic', 'ReadOnlyLogic', 'TransientCommandLogic'].includes(logic?._type)) {
    throw new TypeError(`Unsupported classic aggregate handler logic '${logic?._type}'`);
  }
  return copyImmutableData({ commandType, logic, groupName });
}

// _type is only the JS discriminant for Scala's sealed HandlerLogic variants.
export function PolicyBasedLogic(policy, helper) {
  return copyImmutableData({ _type: 'PolicyBasedLogic', policy, helper });
}

export function ReadOnlyLogic(replyType) {
  return copyImmutableData({ _type: 'ReadOnlyLogic', replyType });
}

/** eventArgs is the original Scala model's explicit expression-source slot. */
export function TransientCommandLogic(eventName, eventArgs) {
  if (typeof eventName !== 'string' || typeof eventArgs !== 'string') {
    throw new TypeError('TransientCommandLogic requires eventName and eventArgs strings');
  }
  return copyImmutableData({ _type: 'TransientCommandLogic', eventName, eventArgs });
}

/** Original formal-path intermediate only; the classic builder never creates it. */
export function EmittedEvent(name, args) {
  return copyImmutableData({ name, args });
}
