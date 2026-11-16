import { typeRef } from '../../../lib/classic-architecture/types.mjs';

// Fixed InvariantRuleModel.scala constructor fields only. No source/expected,
// business postconditions, knowledge attachments or writer stamps live here.
function record(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} requires a structured value`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (!fields.includes(key)) throw new TypeError(`${label} does not admit ${String(key)}`);
  }
}

function immutableType(ref) {
  record(ref, ['name', 'packageName', 'typeParams'], 'InvariantRule TypeRef');
  if (typeof ref.name !== 'string' || typeof ref.packageName !== 'string' || !Array.isArray(ref.typeParams)) {
    throw new TypeError('InvariantRule requires a structured TypeRef');
  }
  return typeRef(ref.name, ref.packageName, ref.typeParams.map(immutableType));
}

export function InvariantConditionModel(name, errorCode, errorMsg, logicDescription) {
  if (![name, errorCode, errorMsg, logicDescription].every(value => typeof value === 'string')) {
    throw new TypeError('InvariantConditionModel requires string constructor fields');
  }
  return Object.freeze({ name, errorCode, errorMsg, logicDescription });
}

export function InvariantRuleModel(
  selfType, outputType, subjectType, triggerType, superInterface, conditions, dependencies,
) {
  if (!Array.isArray(conditions) || !Array.isArray(dependencies)) {
    throw new TypeError('InvariantRuleModel conditions/dependencies must be arrays');
  }
  const copiedConditions = conditions.map(condition => {
    record(condition, ['name', 'errorCode', 'errorMsg', 'logicDescription'], 'InvariantConditionModel');
    return InvariantConditionModel(condition.name, condition.errorCode, condition.errorMsg, condition.logicDescription);
  });
  return Object.freeze({
    selfType: immutableType(selfType),
    outputType: immutableType(outputType),
    subjectType: immutableType(subjectType),
    triggerType: immutableType(triggerType),
    superInterface: immutableType(superInterface),
    conditions: Object.freeze(copiedConditions),
    dependencies: Object.freeze(dependencies.map(immutableType)),
  });
}
