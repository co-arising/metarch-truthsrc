import { collectDependencies, shouldImport, typeRef } from '../../../lib/classic-architecture/types.mjs';
import { InvariantConditionModel, InvariantRuleModel } from '../models/invariant-rule.mjs';

function rawRecord(value, tag, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Classic InvariantRule requires ${tag}`);
  }
  if (Object.hasOwn(value, '_type') && value._type !== tag) {
    throw new TypeError(`Classic InvariantRule requires ${tag}`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key !== '_type' && !fields.includes(key)) {
      throw new TypeError(`Classic ${tag} does not admit ${String(key)}`);
    }
  }
}

function conditionModel(condition) {
  rawRecord(condition, 'InvariantCondition', ['name', 'errorCode', 'logic']);
  rawRecord(condition.logic, 'BusinessLogic', ['intent', 'invariants', 'referenceCode']);
  const logic = condition.logic;
  if (logic.invariants !== undefined &&
      (!Array.isArray(logic.invariants) || !logic.invariants.every(value => typeof value === 'string'))) {
    throw new TypeError('Classic BusinessLogic invariants must be strings');
  }
  if (logic.referenceCode != null && typeof logic.referenceCode !== 'string') {
    throw new TypeError('Classic BusinessLogic referenceCode must be a string or absent');
  }
  // Raw builder uses intent for the error and only referenceCode for the logic.
  // Empty referenceCode is Some(""); only absent values fall back to "true".
  return InvariantConditionModel(
    condition.name, condition.errorCode, logic.intent, logic.referenceCode ?? 'true',
  );
}

function dependenciesOf(superInterface, errorType, entityDeps, pkg) {
  // Only the implemented interface is recursively expanded. The fixed builder
  // unions iMadzError and the owner Entity as direct Set members, not new roots.
  const roots = [...collectDependencies([superInterface]), errorType, ...entityDeps];
  const seen = new Set();
  const dependencies = [];
  for (const ref of roots) {
    const importable = shouldImport(ref, pkg);
    const copy = typeRef(ref.name, ref.packageName, ref.typeParams);
    // Scala Set equality is structural, NOT FQN equality. Preserve different
    // type arguments even if the eventual import lines have identical FQNs.
    const key = JSON.stringify(copy);
    if (!seen.has(key)) {
      seen.add(key);
      if (importable) dependencies.push(copy);
    }
  }
  return dependencies;
}

export function buildInvariantRule(meta, ctx) {
  rawRecord(meta, 'InvariantRuleMetadata', ['name', 'description', 'subject', 'trigger', 'output', 'conditions']);
  if (meta._type !== 'InvariantRuleMetadata' || typeof meta.name !== 'string' || !Array.isArray(meta.conditions)) {
    throw new TypeError('buildInvariantRule requires raw InvariantRuleMetadata');
  }
  if (meta.description !== undefined && typeof meta.description !== 'string') {
    throw new TypeError('Classic InvariantRule description must be a string');
  }
  rawRecord(meta.subject, 'EntityStateRef', ['targetName']);
  rawRecord(meta.output, 'EventFamilyRef', ['targetName']);
  if (typeof meta.subject.targetName !== 'string' || typeof meta.output.targetName !== 'string') {
    throw new TypeError('Classic InvariantRule subject/output require targetName strings');
  }
  if (!meta.trigger || typeof meta.trigger !== 'object' || Array.isArray(meta.trigger)) {
    throw new TypeError('Classic InvariantRule trigger requires a raw DataType');
  }
  for (const key of ['elementHashById', 'elementHashes']) {
    if (Object.hasOwn(ctx, key)) throw new TypeError(`Classic InvariantRule does not admit ${key}`);
  }
  if (ctx.formalSemantics != null) {
    throw new TypeError('Classic InvariantRule does not admit formal semantics attachments');
  }
  const pkg = ctx.layout.domain.invariants.root;
  if (typeof pkg !== 'string') {
    throw new TypeError('Classic InvariantRule requires a string ctx.layout.domain.invariants.root');
  }

  // Do not strip Rule or otherwise curate the name: the resolver owns the raw
  // naming convention, including an already-suffixed name becoming RuleRule.
  const selfType = ctx.typeResolver.invariantRule(meta.name);
  const subjectType = ctx.typeResolver.resolve(meta.subject);
  const triggerType = ctx.typeResolver.resolve(meta.trigger);
  const outputType = ctx.typeResolver.resolve(meta.output);
  const baseRuleType = ctx.types.InvariantRule;
  if (!baseRuleType || typeof baseRuleType.name !== 'string' ||
      typeof baseRuleType.packageName !== 'string' || !Array.isArray(baseRuleType.typeParams)) {
    throw new TypeError('Classic InvariantRule requires ctx.types.InvariantRule as a TypeRef');
  }
  const superInterface = typeRef(baseRuleType.name, baseRuleType.packageName, [outputType, subjectType, triggerType]);
  const conditions = meta.conditions.map(conditionModel);

  // No owner-name inference and no fallback to a state/event package heuristic.
  const owner = ctx.symbolTable.resolve({ name: meta.subject.targetName });
  if (owner != null && (typeof owner !== 'object' || Array.isArray(owner) || typeof owner.name !== 'string')) {
    throw new TypeError('Classic InvariantRule owner resolution requires { name: owner } or an absent value');
  }
  const entityDeps = owner == null ? [] : [ctx.typeResolver.entity(owner.name)];
  return InvariantRuleModel(
    selfType, outputType, subjectType, triggerType, superInterface, conditions,
    dependenciesOf(superInterface, ctx.types.iMadzError, entityDeps, pkg),
  );
}
