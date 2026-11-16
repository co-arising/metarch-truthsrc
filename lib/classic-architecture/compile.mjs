import { at, array, escape, fail, object, text, unique } from '../products/request.mjs';
import { validateRetainedMetadata } from './retained.mjs';

export const CLASSIC_INPUT = 'truthsrc.classic-architecture-input/v1';
export const CLASSIC_FAMILIES = Object.freeze([
  'application-protocol', 'command-helper', 'aggregate-behavior', 'domain-entity',
]);
const primitives = new Set(['StringType', 'IntType', 'LongType', 'DoubleType', 'BooleanType', 'BigDecimalType', 'UnitType']);
const references = new Set([
  'StructRef', 'ValueObjectRef', 'EntityRef', 'EntityStateRef', 'EventRef', 'EventFamilyRef',
  'CommandRef', 'CommandFamilyRef', 'CommandReplyRef', 'InvariantRuleRef', 'AggregateRef',
  'AggregateBehaviorRef', 'AggregateRepositoryRef', 'DomainServiceRef', 'EntityBehaviorRef',
]);
const child = (source, key) => at(source.document, source.pointer + '/' + escape(String(key)));
function record(value, tag, keys, source) {
  object(value, ['_type', ...keys], source);
  if (value._type !== tag) fail('CLASSIC_METADATA_TYPE', 'expected ' + tag, source);
}
function bool(value, source) {
  if (typeof value !== 'boolean') fail('CLASSIC_METADATA_TYPE', 'expected boolean', source);
}
function name(value, source) {
  text(value, source);
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value)) fail('CLASSIC_NAME', 'classic source name must be an identifier', source);
}
function optionalText(value, source) {
  if (value !== null) text(value, source, true);
}
function texts(value, source) {
  array(value, source).forEach((v, i) => text(v, child(source, i), true));
}
function each(value, source, validate) {
  array(value, source).forEach((v, i) => validate(v, child(source, i)));
}
function named(value, source, validate) {
  each(value, source, validate);
  unique(value.map(v => v.name), 'CLASSIC_DUPLICATE', source);
}
function type(value, source, inlineMetadata = true) {
  if (inlineMetadata) {
    if (value?._type === 'ValueObjectMetadata') return valueObject(value, source);
    if (value?._type === 'DomainEntityMetadata') return entity(value, source);
    if (value?._type === 'AggregateRootMetadata') return aggregate(value, source);
  }
  if (primitives.has(value?._type)) return record(value, value._type, [], source);
  if (references.has(value?._type)) {
    record(value, value._type, ['targetName'], source);
    return name(value.targetName, child(source, 'targetName'));
  }
  record(value, 'CustomType', ['typeName', 'packagePath', 'typeParameters'], source);
  name(value.typeName, child(source, 'typeName'));
  text(value.packagePath, child(source, 'packagePath'), true);
  if (value.packagePath && !value.packagePath.split('.').every(p => /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(p)))
    fail('CLASSIC_PACKAGE', 'classic type package must be a dotted identifier', child(source, 'packagePath'));
  each(value.typeParameters, child(source, 'typeParameters'), type);
}
function ref(value, tag, source) {
  record(value, tag, ['targetName'], source);
  name(value.targetName, child(source, 'targetName'));
}
function field(value, source) {
  record(value, 'FieldMetadata', ['name', 'fieldType', 'optional', 'defaultValue', 'introducedIn', 'nature', 'noteId', 'description', 'writtenBy'], source);
  name(value.name, child(source, 'name')); type(value.fieldType, child(source, 'fieldType'));
  bool(value.optional, child(source, 'optional'));
  for (const key of ['defaultValue', 'noteId']) optionalText(value[key], child(source, key));
  for (const key of ['introducedIn', 'nature', 'description']) text(value[key], child(source, key), true);
  texts(value.writtenBy, child(source, 'writtenBy'));
}
function parameter(value, source) {
  record(value, 'ParameterMetadata', ['name', 'parameterType', 'optional', 'optionalWhen', 'noteId', 'description'], source);
  name(value.name, child(source, 'name')); type(value.parameterType, child(source, 'parameterType'));
  bool(value.optional, child(source, 'optional')); optionalText(value.noteId, child(source, 'noteId'));
  text(value.optionalWhen, child(source, 'optionalWhen'), true); text(value.description, child(source, 'description'), true);
}
function logic(value, source) {
  record(value, 'BusinessLogic', ['intent', 'invariants', 'referenceCode'], source);
  text(value.intent, child(source, 'intent'), true); texts(value.invariants, child(source, 'invariants'));
  optionalText(value.referenceCode, child(source, 'referenceCode'));
}
function valueObject(value, source) {
  record(value, 'ValueObjectMetadata', ['name', 'fields', 'description', 'logic', 'noteIds', 'ownNoteId'], source);
  name(value.name, child(source, 'name')); named(value.fields, child(source, 'fields'), field);
  text(value.description, child(source, 'description'), true); texts(value.noteIds, child(source, 'noteIds'));
  optionalText(value.ownNoteId, child(source, 'ownNoteId'));
  if (value.logic !== null) logic(value.logic, child(source, 'logic'));
}
function event(value, source) {
  record(value, 'SubordinateDomainEventMetadata', ['name', 'fields', 'requiresProtobuf', 'description', 'protoFieldMapping', 'causedBy', 'producedBy', 'noteId'], source);
  name(value.name, child(source, 'name')); named(value.fields, child(source, 'fields'), field);
  bool(value.requiresProtobuf, child(source, 'requiresProtobuf')); text(value.description, child(source, 'description'), true);
  optionalText(value.noteId, child(source, 'noteId'));
  object(value.protoFieldMapping, Object.keys(value.protoFieldMapping ?? {}), child(source, 'protoFieldMapping'));
  for (const [key, number] of Object.entries(value.protoFieldMapping)) {
    if (!value.fields.some(f => f.name === key) || !Number.isSafeInteger(number) || number < 1)
      fail('CLASSIC_PROTO_FIELD', 'proto field mapping must refer to a field with a positive integer number', child(source, 'protoFieldMapping'));
  }
  unique(Object.values(value.protoFieldMapping), 'CLASSIC_PROTO_FIELD', child(source, 'protoFieldMapping'));
  each(value.producedBy, child(source, 'producedBy'), (v, s) => ref(v, 'CommandRef', s));
  // Causal metadata is retained, not lowered by these four source families.
  array(value.causedBy, child(source, 'causedBy'));
}
function eventFamily(value, source) {
  record(value, 'EventFamilyMetadata', ['name', 'description', 'events', 'fields', 'requiresProtobuf'], source);
  name(value.name, child(source, 'name')); text(value.description, child(source, 'description'), true);
  named(value.events, child(source, 'events'), event); named(value.fields, child(source, 'fields'), field);
  bool(value.requiresProtobuf, child(source, 'requiresProtobuf'));
}
function entity(value, source) {
  record(value, 'DomainEntityMetadata', ['name', 'state', 'eventFamily', 'noteId'], source);
  name(value.name, child(source, 'name')); valueObject(value.state, child(source, 'state'));
  eventFamily(value.eventFamily, child(source, 'eventFamily')); optionalText(value.noteId, child(source, 'noteId'));
}
function command(value, source) {
  record(value, 'SubordinateCommandMetadata', ['name', 'parameters', 'replyToType', 'isReadOnly', 'description', 'isSystemCommand', 'noteId'], source);
  name(value.name, child(source, 'name')); named(value.parameters, child(source, 'parameters'), parameter);
  if (value.replyToType !== null) ref(value.replyToType, 'CommandReplyRef', child(source, 'replyToType'));
  bool(value.isReadOnly, child(source, 'isReadOnly')); bool(value.isSystemCommand, child(source, 'isSystemCommand'));
  text(value.description, child(source, 'description'), true); optionalText(value.noteId, child(source, 'noteId'));
  if (value.isReadOnly && value.replyToType === null) fail('CLASSIC_QUERY_REPLY', 'read-only command requires a reply type', source);
}
function reply(value, source) {
  record(value, 'SubordinateCommandReplyMetadata', ['name', 'parameters'], source);
  name(value.name, child(source, 'name')); named(value.parameters, child(source, 'parameters'), parameter);
}
function commandFamily(value, source) {
  record(value, 'CommandFamilyMetadata', ['name', 'description', 'commands'], source);
  name(value.name, child(source, 'name')); text(value.description, child(source, 'description'), true);
  named(value.commands, child(source, 'commands'), command);
}
function replyFamily(value, source) {
  record(value, 'CommandReplyFamilyMetadata', ['name', 'replies'], source);
  name(value.name, child(source, 'name')); named(value.replies, child(source, 'replies'), reply);
}
function flow(value, source) {
  record(value, 'CommandHandlingFlow', ['commandRef', 'invariantRef', 'replyMapping'], source);
  ref(value.commandRef, 'CommandRef', child(source, 'commandRef')); ref(value.invariantRef, 'InvariantRuleRef', child(source, 'invariantRef'));
  const mapping = child(source, 'replyMapping');
  record(value.replyMapping, 'ReplyMappingConfig', ['successReplyRef', 'failureReplyRef'], mapping);
  ref(value.replyMapping.successReplyRef, 'CommandReplyRef', child(mapping, 'successReplyRef'));
  ref(value.replyMapping.failureReplyRef, 'CommandReplyRef', child(mapping, 'failureReplyRef'));
}
function behavior(value, source) {
  record(value, 'AggregateBehaviorMetadata', ['name', 'behaviors'], source);
  name(value.name, child(source, 'name'));
  named(value.behaviors, child(source, 'behaviors'), (group, location) => {
    record(group, 'AggregateCommandHandlersMetadata', ['name', 'flows'], location);
    name(group.name, child(location, 'name')); each(group.flows, child(location, 'flows'), flow);
    unique(group.flows.map(f => f.commandRef.targetName), 'CLASSIC_DUPLICATE', location);
  });
}
function invariant(value, source) {
  record(value, 'InvariantRuleMetadata', ['name', 'description', 'subject', 'trigger', 'output', 'conditions'], source);
  name(value.name, child(source, 'name')); text(value.description, child(source, 'description'), true);
  ref(value.subject, 'EntityStateRef', child(source, 'subject')); type(value.trigger, child(source, 'trigger'), false);
  ref(value.output, 'EventFamilyRef', child(source, 'output'));
  named(value.conditions, child(source, 'conditions'), (condition, location) => {
    record(condition, 'InvariantCondition', ['name', 'errorCode', 'logic'], location);
    name(condition.name, child(location, 'name')); text(condition.errorCode, child(location, 'errorCode'));
    logic(condition.logic, child(location, 'logic'));
  });
}
function aggregate(value, source) {
  record(value, 'AggregateRootMetadata', ['name', 'identifier', 'entityRef', 'stateRef', 'eventFamilyRef', 'commandFamily', 'replyFamily', 'behaviorRef', 'persistenceConfig', 'repository', 'description', 'implConfig', 'factoryMethods', 'noteId'], source);
  name(value.name, child(source, 'name')); field(value.identifier, child(source, 'identifier'));
  for (const [key, tag] of [['entityRef', 'EntityRef'], ['stateRef', 'EntityStateRef'], ['eventFamilyRef', 'EventFamilyRef'], ['behaviorRef', 'AggregateBehaviorRef']]) ref(value[key], tag, child(source, key));
  commandFamily(value.commandFamily, child(source, 'commandFamily')); replyFamily(value.replyFamily, child(source, 'replyFamily'));
  if (value.repository !== null) ref(value.repository, 'AggregateRepositoryRef', child(source, 'repository'));
  text(value.description, child(source, 'description'), true); optionalText(value.noteId, child(source, 'noteId'));
  // Persistence, factory and bootstrap inputs remain intact for their own source families.
  array(value.factoryMethods, child(source, 'factoryMethods'));
  object(value.persistenceConfig, Object.keys(value.persistenceConfig ?? {}), child(source, 'persistenceConfig'));
  object(value.implConfig, Object.keys(value.implConfig ?? {}), child(source, 'implConfig'));
}
function indexByName(values, source) {
  const result = new Map();
  for (const value of values) {
    if (result.has(value.name)) fail('CLASSIC_DUPLICATE', 'ambiguous metadata name: ' + value.name, source);
    result.set(value.name, value);
  }
  return result;
}
function requireMember(index, target, source) {
  const value = index.get(target);
  if (!value) fail('CLASSIC_REFERENCE', 'reference must resolve exactly once: ' + target, source);
  return value;
}
function links(system, source) {
  const aggregates = system.application.aggregates;
  const entities = indexByName(system.domain.entities, at(source.document, source.pointer + '/domain/entities'));
  const behaviors = indexByName(system.application.behaviors, at(source.document, source.pointer + '/application/behaviors'));
  const invariants = indexByName(system.domain.invariants, at(source.document, source.pointer + '/domain/invariants'));
  const commands = indexByName(aggregates.flatMap(aggregate => aggregate.commandFamily.commands), source);
  const replies = indexByName(aggregates.flatMap(aggregate => [aggregate.replyFamily, ...aggregate.replyFamily.replies]), source);
  for (const [i, aggregate] of aggregates.entries()) {
    const location = child(child(child(source, 'application'), 'aggregates'), i);
    const entity = requireMember(entities, aggregate.entityRef.targetName, location);
    if (entity.state.name !== aggregate.stateRef.targetName || entity.eventFamily.name !== aggregate.eventFamilyRef.targetName)
      fail('CLASSIC_REFERENCE', 'aggregate state and event family must belong to its entity', location);
    const behavior = requireMember(behaviors, aggregate.behaviorRef.targetName, location);
    for (const command of aggregate.commandFamily.commands) if (command.replyToType) requireMember(replies, command.replyToType.targetName, location);
    for (const flow of behavior.behaviors.flatMap(group => group.flows)) {
      requireMember(commands, flow.commandRef.targetName, location);
      requireMember(invariants, flow.invariantRef.targetName, location);
      requireMember(replies, flow.replyMapping.successReplyRef.targetName, location);
      requireMember(replies, flow.replyMapping.failureReplyRef.targetName, location);
    }
  }
}

/** Lossless carrier of classic metadata; only the four named source families are lowered. */
export function compileClassicArchitecture(document) {
  const input = document.value, source = at(document.id);
  object(input, ['schemaVersion', 'system'], source);
  if (input.schemaVersion !== CLASSIC_INPUT) fail('CLASSIC_VERSION', 'unsupported classic input schema', source);
  const system = input.system, root = child(source, 'system');
  validateRetainedMetadata(system, root);
  record(system, 'SystemMetadata', ['name', 'contextName', 'domain', 'application', 'infrastructure', 'interfaces', 'storyboard', 'externalSystems', 'timers'], root);
  text(system.name, child(root, 'name')); optionalText(system.contextName, child(root, 'contextName'));
  const domain = child(root, 'domain'), application = child(root, 'application');
  record(system.domain, 'DomainLayer', ['valueObjects', 'behaviors', 'entities', 'services', 'invariants', 'policies'], domain);
  record(system.application, 'ApplicationLayer', ['valueObjects', 'behaviors', 'aggregates', 'services', 'queries', 'sagas', 'repositories', 'lifecycles', 'useCases', 'gates', 'viewKeys', 'connectors'], application);
  named(system.domain.entities, child(domain, 'entities'), entity);
  named(system.domain.valueObjects, child(domain, 'valueObjects'), valueObject);
  named(system.domain.invariants, child(domain, 'invariants'), invariant);
  named(system.application.valueObjects, child(application, 'valueObjects'), valueObject);
  named(system.application.aggregates, child(application, 'aggregates'), aggregate);
  named(system.application.behaviors, child(application, 'behaviors'), behavior);
  if (!system.domain.entities.length || !system.application.aggregates.length) fail('CLASSIC_EMPTY', 'classic aggregate scaffold requires entities and aggregates', root);
  const retained = [];
  for (const [layer, keys] of [['domain', ['behaviors', 'services', 'policies']], ['application', ['services', 'queries', 'sagas', 'repositories', 'lifecycles', 'useCases', 'gates', 'viewKeys', 'connectors']]]) {
    for (const key of keys) {
      const location = child(child(root, layer), key);
      array(system[layer][key], location);
      retained.push({ source: location, count: system[layer][key].length, lowering: 'retained-not-emitted' });
    }
  }
  for (const key of ['infrastructure', 'interfaces', 'storyboard', 'externalSystems', 'timers']) retained.push({ source: child(root, key), lowering: 'retained-not-emitted' });
  links(system, root);
  return { system, source: root, emittedFamilies: [...CLASSIC_FAMILIES], retained, readiness: { level: 'classic-scaffold-only', runnable: false } };
}
