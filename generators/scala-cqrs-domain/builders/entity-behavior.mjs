import { collectDependencies, shouldImport, typeRef } from '../../../lib/classic-architecture/types.mjs';
import { FieldDef } from '../models/domain-entity.mjs';
import { stripMargin } from '../../../lib/classic-architecture/text.mjs';
import { EntityBehaviorModel, MethodModel, StateMutationModel } from '../models/entity-behavior.mjs';

function resolveOwningEntity(meta, ctx) {
  // compileClassicArchitecture owns the unique-family admission check. Preserve
  // the fixed builder's exact lookup, not a name-derived implementation owner.
  const entity = ctx.metaRegistry.resolveAll('DomainEntityMetadata')
    .find(candidate => candidate.eventFamily.name === meta.eventFamilyRef.targetName);
  if (!entity) {
    throw new Error(`Cannot find owning DomainEntity for behavior: ${meta.name} (EventFamily: ${meta.eventFamilyRef.targetName})`);
  }
  return entity;
}

function mutationLogicCode(logic) {
  // Scala Option.getOrElse preserves Some(""); keep the fallback's final newline.
  return logic.referenceCode === null
    ? stripMargin(`// TODO: ${logic.intent}\n      state\n`)
    : logic.referenceCode;
}

function helperLogicCode(logic) {
  // MethodMetadata.logic is Either[String, BusinessLogic], never a bare logic
  // object, an alternate wrapper, or a truthy-reference-code shortcut.
  switch (logic?._type) {
    case 'Left':
      if (typeof logic.value !== 'string') {
        throw new TypeError('EntityBehavior helper Left requires a string value');
      }
      return `// Error: ${logic.value}`;
    case 'Right': {
      const value = logic.value;
      if (value?._type !== 'BusinessLogic') {
        throw new TypeError('EntityBehavior helper Right requires BusinessLogic');
      }
      return value.referenceCode === null ? `// TODO: ${value.intent}` : value.referenceCode;
    }
    default:
      throw new TypeError('EntityBehavior helper logic requires Left or Right');
  }
}

function buildHelperMethods(meta, ctx) {
  return meta.helperMethods.map(method => MethodModel(
    method.name,
    method.parameters.map(param => FieldDef(
      param.name, ctx.resolve(param.parameterType), null, null, param.noteId, param.description,
    )),
    ctx.typeResolver.resolve(method.returnType),
    helperLogicCode(method.logic),
  ));
}

function dependenciesOf(handlerAlias, stateType, eventFamilyType, mutations, helpers, pkg) {
  const roots = [
    handlerAlias,
    stateType,
    eventFamilyType,
    ...mutations.map(mutation => mutation.eventType),
    ...helpers.flatMap(helper => [helper.returnType, ...helper.params.map(param => param.typeRef)]),
  ];
  // Match the fixed filtered Set[TypeRef], with structural (not FQN) equality.
  // Unfiltered roots also remain in the model's typed slots for the assembler.
  return collectDependencies(roots).filter(ref => shouldImport(ref, pkg));
}

export function buildEntityBehavior(meta, ctx) {
  if (meta?._type !== 'EntityBehaviorMetadata') {
    throw new TypeError('buildEntityBehavior requires raw EntityBehaviorMetadata');
  }
  const behaviorPkg = ctx.layout.domain.entities.behaviors;
  const entity = resolveOwningEntity(meta, ctx);
  const selfType = ctx.typeResolver.entityBehaviorSelf(meta.name, behaviorPkg);
  const familyName = meta.eventFamilyRef.targetName;
  const baseName = familyName.endsWith('Event') ? familyName.slice(0, -5) : familyName;
  const handlerAlias = typeRef(`${baseName}EventHandler`, ctx.typeResolver.entityObjectPath(entity.name));
  // The fixed builder derives both types from the owning entity. It does not
  // inspect a behavior stateRef or change the state/handler body based on it.
  const stateType = ctx.typeResolver.entityState({ _type: 'EntityStateRef', targetName: entity.state.name });
  const eventFamilyType = ctx.typeResolver.eventFamily({ _type: 'EventFamilyRef', targetName: entity.eventFamily.name });
  const mutations = meta.handlers.map(handler => StateMutationModel(
    // classic@2's resolver admits StructRef here only for a declared event owner.
    ctx.typeResolver.resolve({ _type: 'StructRef', targetName: handler.eventRef.targetName }),
    mutationLogicCode(handler.logic),
  ));
  // Parameter optional/isPrivate flags are intentionally ignored by the fixed
  // builder/template: parameter types stay resolved as-is; every helper is private.
  const helpers = buildHelperMethods(meta, ctx);
  return EntityBehaviorModel(
    selfType,
    handlerAlias,
    stateType,
    eventFamilyType,
    mutations,
    helpers,
    dependenciesOf(handlerAlias, stateType, eventFamilyType, mutations, helpers, behaviorPkg),
  );
}
