import { at, array, equal, escape, fail, object, text, unique } from '../products/request.mjs';
import { validateRetainedMetadata } from './retained.mjs';
import { conventions as naming } from './naming.mjs';
import { createClassicContext } from './context.mjs';
import { classicTechnicalInputs } from './technical.mjs';

export const CLASSIC_INPUT = 'truthsrc.classic-architecture-input/v1';
export const CLASSIC_FAMILIES = Object.freeze([
  'application-protocol', 'command-helper', 'aggregate-behavior', 'domain-entity',
]);
export const CLASSIC_FAMILIES_V2 = Object.freeze([
  ...CLASSIC_FAMILIES, 'value-object', 'invariant-rule', 'event-handler',
]);
export const CLASSIC_FAMILIES_V3 = Object.freeze([
  ...CLASSIC_FAMILIES_V2, 'aggregate-root', 'aggregate-factory',
]);
export const CLASSIC_FAMILIES_V4 = Object.freeze([
  ...CLASSIC_FAMILIES_V3, 'aggregate-repository-port', 'aggregate-repository-implementation',
]);
export const CLASSIC_FAMILIES_V5 = Object.freeze([
  ...CLASSIC_FAMILIES_V4, 'domain-service', 'aggregate-rules-formal', 'external-connector-port',
  'application-service', 'query-service', 'saga-participant', 'saga-definition',
  'saga-trigger-protocol', 'saga-trigger-entity', 'saga-trigger-root', 'saga-trigger-behaviors',
  'projection-repository-port', 'projection-repository-implementation', 'connector-implementation',
  'projection-apply-event', 'projection', 'projection-handler', 'protobuf-schema', 'proto-converter',
  'event-adapter', 'snapshot-adapter', 'saga-context', 'aggregate-state-controller', 'http-controller',
  'command-endpoint-dsl', 'route-definition', 'bootstrap', 'application-bootstrap',
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
function method(value, source) {
  record(value, 'MethodMetadata', ['name', 'parameters', 'returnType', 'logic', 'description', 'isPrivate'], source);
  name(value.name, child(source, 'name')); named(value.parameters, child(source, 'parameters'), parameter);
  type(value.returnType, child(source, 'returnType'), false);
  text(value.description, child(source, 'description'), true); bool(value.isPrivate, child(source, 'isPrivate'));
  const location = child(source, 'logic');
  if (value.logic?._type === 'Left') {
    record(value.logic, 'Left', ['value'], location);
    text(value.logic.value, child(location, 'value'), true);
  } else {
    record(value.logic, 'Right', ['value'], location);
    logic(value.logic.value, child(location, 'value'));
  }
}
function entityBehavior(value, source) {
  record(value, 'EntityBehaviorMetadata', ['name', 'eventFamilyRef', 'handlers', 'helperMethods'], source);
  name(value.name, child(source, 'name')); ref(value.eventFamilyRef, 'EventFamilyRef', child(source, 'eventFamilyRef'));
  each(value.handlers, child(source, 'handlers'), (handler, location) => {
    record(handler, 'EventStateMutation', ['eventRef', 'logic'], location);
    ref(handler.eventRef, 'EventRef', child(location, 'eventRef'));
    logic(handler.logic, child(location, 'logic'));
  });
  each(value.helperMethods, child(source, 'helperMethods'), method);
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

function sourceLinks(system, source) {
  const entities = system.domain.entities;
  const states = indexByName(entities.map(entity => entity.state), source);
  const families = indexByName(entities.map(entity => entity.eventFamily), source);
  for (const [i, behavior] of system.domain.behaviors.entries()) {
    const location = child(child(child(source, 'domain'), 'behaviors'), i);
    const family = requireMember(families, behavior.eventFamilyRef.targetName, location);
    for (const [j, handler] of behavior.handlers.entries()) {
      if (!family.events.some(event => event.name === handler.eventRef.targetName))
        fail('CLASSIC_REFERENCE', 'mutation event must belong to the behavior event family: ' + handler.eventRef.targetName,
          child(child(location, 'handlers'), j));
    }
  }
  for (const [i, invariant] of system.domain.invariants.entries()) {
    const location = child(child(child(source, 'domain'), 'invariants'), i);
    requireMember(states, invariant.subject.targetName, child(location, 'subject'));
    requireMember(families, invariant.output.targetName, child(location, 'output'));
  }
}

function factoryLinks(system, source) {
  const replies = indexByName(system.application.aggregates.flatMap(aggregate =>
    [aggregate.replyFamily, ...aggregate.replyFamily.replies]), source);
  for (const [i, aggregate] of system.application.aggregates.entries()) {
    const location = child(child(child(source, 'application'), 'aggregates'), i);
    const command = aggregate.commandFamily.commands.find(command => !command.isReadOnly && command.parameters.length !== 0);
    if (!command) continue;
    if (command.replyToType === null) fail('CLASSIC_FACTORY_REPLY',
      `Command ${command.name} must specify a reply type for factory initialization.`, location);
    requireMember(replies, command.replyToType.targetName, location);
  }
}

/** @4 validates declared queries, never the raw builders' synthetic families. */
function repositoryQuery(query, aggregate, ctx, source) {
  name(query.name, child(source, 'name'));
  if (naming.scalaIdentifier(query.name) !== query.name || ['forSome', '_'].includes(query.name))
    fail('CLASSIC_REPOSITORY_QUERY', 'repository method must be a non-keyword identifier', source);
  if (query.parameters.length !== 1)
    fail('CLASSIC_REPOSITORY_QUERY', 'repository query requires exactly one parameter before entityRef filtering', source);
  const param = query.parameters[0], location = child(child(source, 'parameters'), 0);
  name(param.name, child(location, 'name'));
  if (param.optional || param.optionalWhen !== '' || naming.scalaIdentifier(param.name) !== param.name || ['forSome', '_'].includes(param.name))
    fail('CLASSIC_REPOSITORY_QUERY', 'repository parameter must be required and a non-keyword identifier', location);
  const resolved = ctx.typeResolver.parameterType(param.parameterType);
  if (resolved.typeParams.length !== 0)
    fail('CLASSIC_REPOSITORY_QUERY', 'repository implementation cannot preserve generic parameter signatures', location);
  const result = query.returnType, family = result.typeParameters?.[0];
  if (result._type !== 'CustomType' || result.typeName !== 'EntityRef' || result.typeParameters.length !== 1 ||
      family?._type !== 'CommandFamilyRef' || family.targetName !== aggregate.commandFamily.name)
    fail('CLASSIC_REPOSITORY_QUERY', 'repository query must return EntityRef of its aggregate declared command family', child(source, 'returnType'));
  ctx.typeResolver.resolve(result);
}
function repositoryLinks(system, source) {
  const aggregates = indexByName(system.application.aggregates, child(child(source, 'application'), 'aggregates'));
  const selected = layer => system[layer].repositories.flatMap((meta, i) => meta._type === 'AggregateRepositoryMetadata'
    ? [{ meta, layer, source: child(child(child(source, layer), 'repositories'), i) }] : []);
  const ports = selected('application'), implementations = selected('infrastructure');
  const declarations = [...ports, ...implementations];
  const byName = rows => indexByName(rows.map(row => row.meta), source);
  const portIndex = byName(ports), implementationIndex = byName(implementations);
  for (const { meta, layer, source: location } of declarations) {
    const peer = (layer === 'application' ? implementationIndex : portIndex).get(meta.name);
    if (!peer || !equal(meta, peer))
      fail('CLASSIC_REPOSITORY_PAIR', 'repository requires an identical unique declaration in the opposite layer', location);
  }
  // Admission needs type structure/ownership only. These private package labels
  // never enter the product or emitted source; the target supplies real options.
  const ctx = createClassicContext(system, { rootPackage: 'classic', frameworkPackage: 'classic', moduleName: 'admission' }, '4');
  const paths = [];
  for (const { meta, layer, source: location } of declarations) {
    name(meta.name, child(location, 'name'));
    const aggregate = requireMember(aggregates, meta.aggregate.targetName, child(location, 'aggregate'));
    if (meta.storage !== null) fail('CLASSIC_REPOSITORY_STORAGE', 'classic @4 repository storage must be null', child(location, 'storage'));
    for (const [i, query] of meta.methods.entries()) if (query._type === 'QueryMethod')
      repositoryQuery(query, aggregate, ctx, child(child(location, 'methods'), i));
    const iface = ctx.typeResolver.aggregateRepository(meta.name);
    const impl = ctx.typeResolver.aggregateRepositoryImpl(meta);
    const annotation = ctx.typeResolver.aggregateRepositoryImpl(naming.getRepositoryImplNameFromInterfaceName(meta.name));
    if (!equal(impl, annotation)) fail('CLASSIC_REPOSITORY_PAIR', 'repository overloads must identify the same implementation', location);
    paths.push({ layer, path: (layer === 'application' ? iface : impl).name.normalize('NFC').toLowerCase() });
  }
  for (const layer of ['application', 'infrastructure']) {
    const rows = paths.filter(row => row.layer === layer);
    if (new Set(rows.map(row => row.path)).size !== rows.length)
      fail('CLASSIC_REPOSITORY_PATH', 'repository names must resolve to unique source paths within each layer', source);
  }
  for (const [i, aggregate] of system.application.aggregates.entries()) if (aggregate.repository !== null) {
    const location = child(child(child(source, 'application'), 'aggregates'), i);
    const port = portIndex.get(aggregate.repository.targetName), impl = implementationIndex.get(aggregate.repository.targetName);
    if (!port || !impl || port.aggregate.targetName !== aggregate.name || impl.aggregate.targetName !== aggregate.name)
      fail('CLASSIC_REPOSITORY_PAIR', 'aggregate repository reference must identify its declared two-layer pair', child(location, 'repository'));
  }
}

/** Lossless metadata; each registered version names its lowered source families. */
export function compileClassicArchitecture(document, version = '1') {
  const input = document.value, source = at(document.id);
  if (!['1', '2', '3', '4', '5'].includes(version)) fail('CLASSIC_VERSION', 'unsupported classic product version', source);
  object(input, ['schemaVersion', 'system', ...(version === '5' && Object.hasOwn(input, 'technical') ? ['technical'] : [])], source);
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
  if (['2', '3', '4', '5'].includes(version)) named(system.domain.behaviors, child(domain, 'behaviors'), entityBehavior);
  named(system.application.valueObjects, child(application, 'valueObjects'), valueObject);
  named(system.application.aggregates, child(application, 'aggregates'), aggregate);
  named(system.application.behaviors, child(application, 'behaviors'), behavior);
  if (!system.domain.entities.length || !system.application.aggregates.length) fail('CLASSIC_EMPTY', 'classic aggregate scaffold requires entities and aggregates', root);
  const retained = [];
  const retainedLayers = version === '5'
    ? [['domain', ['policies']], ['application', ['repositories', 'lifecycles', 'useCases', 'gates', 'viewKeys']]]
    : [['domain', version === '1' ? ['behaviors', 'services', 'policies'] : ['services', 'policies']], ['application', ['services', 'queries', 'sagas', 'repositories', 'lifecycles', 'useCases', 'gates', 'viewKeys', 'connectors']]];
  for (const [layer, keys] of retainedLayers) {
    for (const key of keys) {
      const location = child(child(root, layer), key);
      array(system[layer][key], location);
      if (['4', '5'].includes(version) && layer === 'application' && key === 'repositories') {
        system[layer][key].forEach((meta, i) => {
          if (meta._type !== 'AggregateRepositoryMetadata') retained.push({ source: child(location, i), lowering: 'retained-not-emitted' });
        });
      } else retained.push({ source: location, count: system[layer][key].length, lowering: 'retained-not-emitted' });
    }
  }
  for (const key of ['infrastructure', 'interfaces', 'storyboard', 'externalSystems', 'timers']) {
    if (['4', '5'].includes(version) && key === 'infrastructure') {
      for (const [name, value] of Object.entries(system.infrastructure)) {
        if (name === '_type') continue;
        const location = child(child(root, key), name);
        if (name === 'repositories') value.forEach((meta, i) => {
          if (meta._type !== 'AggregateRepositoryMetadata' && !(version === '5' && meta._type === 'ProjectionRepositoryMetadata'))
            retained.push({ source: child(location, i), lowering: 'retained-not-emitted' });
        });
        else if (version !== '5' || !['projections', 'connectors'].includes(name))
          retained.push({ source: location, lowering: 'retained-not-emitted' });
      }
    } else if (version === '5' && key === 'interfaces') {
      for (const name of ['valueObjects']) retained.push({ source: child(child(root, key), name), lowering: 'retained-not-emitted' });
    } else retained.push({ source: child(root, key), lowering: 'retained-not-emitted' });
  }
  links(system, root);
  if (['2', '3', '4', '5'].includes(version)) sourceLinks(system, root);
  if (['3', '4', '5'].includes(version)) factoryLinks(system, root);
  if (['4', '5'].includes(version)) repositoryLinks(system, root);
  const families = version === '1' ? CLASSIC_FAMILIES : version === '2' ? CLASSIC_FAMILIES_V2 : version === '3' ? CLASSIC_FAMILIES_V3 : version === '4' ? CLASSIC_FAMILIES_V4 : CLASSIC_FAMILIES_V5;
  const technical = version === '5' && Object.hasOwn(input, 'technical')
    ? classicTechnicalInputs(input.technical, system, child(source, 'technical'))
    : null;
  return { system, source: root, emittedFamilies: [...families],
    ...(technical === null ? {} : { technical }),
    retained, readiness: { level: 'classic-scaffold-only', runnable: false } };
}
