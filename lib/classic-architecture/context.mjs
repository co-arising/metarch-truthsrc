import { ProductError } from '../products/request.mjs';
import { typeRef, fqn } from './types.mjs';
import { conventions as naming } from './naming.mjs';

// These are metadata classifications, NOT additional emitted artifact families.
// ArchitectMetadata.scala: DomainDrivenMetadata and its concrete subclasses.
const categories = Object.freeze({
  ValueObjectMetadata: 'domain.values',
  SubordinateDomainEventMetadata: 'domain.events',
  EventFamilyMetadata: 'domain.events',
  EntityBehaviorMetadata: 'domain.entities.behaviors',
  DomainEntityMetadata: 'domain.entities',
  InvariantRuleMetadata: 'domain.invariant',
  PolicyMetadata: 'domain.policies',
  DomainServiceMetadata: 'domain.services',
  MethodMetadata: 'methods',
  SubordinateCommandReplyMetadata: 'application.commands.reply',
  CommandReplyFamilyMetadata: 'application.commands.reply',
  SubordinateCommandMetadata: 'application.commands',
  CommandFamilyMetadata: 'application.commands',
  AggregateCommandHandlersMetadata: 'application.aggregates.behaviors',
  AggregateBehaviorMetadata: 'application.aggregates.behaviors',
  AggregateRootMetadata: 'application.aggregates',
  ApplicationServiceMetadata: 'application.services',
  QueryServiceMetadata: 'application.queries',
  ServiceMethod: 'service.methods',
  SagaContextMetadata: 'application.services.transactor.context',
  SagaTransactorMetadata: 'application.services.transactor',
  SagaParticipantMetadata: 'application.services.transactor.participant',
  ProjectionMetadata: 'application.projection',
  ProjectionEventHandlerMetadata: 'application.projection.handlers',
  AggregateRepositoryMetadata: 'application.aggregates.repository',
  ProjectionRepositoryMetadata: 'application.projection.repository',
  UpsertMethod: 'Repo.Upsert',
  QueryMethod: 'Repo.Query',
  ControllerMetadata: 'controllers',
  LifecycleMetadata: 'application.lifecycle',
  UserRoleMetadata: 'userRole',
  UserStoryMetadata: 'userStory',
  ExternalSystemMetadata: 'externalSystem',
  ConnectorMetadata: 'application.connectors',
  ConnectorImplMetadata: 'infrastructure.connectors',
  HandwrittenInfraMetadata: 'infrastructure.handwritten',
  TimerMetadata: 'timer',
  GateDefinition: 'application.gates',
  ViewKeyDefinition: 'application.viewKeys',
  UseCaseMetadata: 'application.useCases',
  UnitTestCase: 'test.case',
  BehaviorTestCase: 'test.case',
});
const subtypes = Object.freeze({
  DomainEventMetadata: ['EventFamilyMetadata', 'SubordinateDomainEventMetadata'],
  CommandMetadata: ['CommandFamilyMetadata', 'SubordinateCommandMetadata'],
  CommandReplyMetadata: ['CommandReplyFamilyMetadata', 'SubordinateCommandReplyMetadata'],
  RepositoryMetadata: ['AggregateRepositoryMetadata', 'ProjectionRepositoryMetadata'],
  RepositoryMethod: ['UpsertMethod', 'QueryMethod'],
  TestCaseMetadata: ['UnitTestCase', 'BehaviorTestCase'],
});
const primitives = Object.freeze({
  StringType: typeRef('String'), IntType: typeRef('Int'), LongType: typeRef('Long'),
  DoubleType: typeRef('Double'), BooleanType: typeRef('Boolean'),
  BigDecimalType: typeRef('BigDecimal', 'scala.math'), UnitType: typeRef('Unit'),
});
// Public lowering deliberately admits only the slice's reference variants.
const referenceKinds = Object.freeze({
  EntityRef: 'DomainEntityMetadata', EntityStateRef: 'ValueObjectMetadata',
  EventRef: 'DomainEventMetadata', EventFamilyRef: 'EventFamilyMetadata',
  EntityBehaviorRef: 'EntityBehaviorMetadata',
  CommandRef: 'CommandMetadata', CommandFamilyRef: 'CommandFamilyMetadata',
  CommandReplyRef: 'CommandReplyMetadata', AggregateRef: 'AggregateRootMetadata',
  AggregateBehaviorRef: 'AggregateBehaviorMetadata',
  AggregateRepositoryRef: 'AggregateRepositoryMetadata',
  InvariantRuleRef: 'InvariantRuleMetadata', DomainServiceRef: 'DomainServiceMetadata',
  ValueObjectRef: 'ValueObjectMetadata',
});
// Retained query return types need their original metadata FQN for SymbolTable
// collection. Recognizing a retained ref here does not admit it for lowering.
const rawRefKinds = new Set([
  ...Object.keys(referenceKinds), 'StructRef', 'ProjectionRepositoryRef',
  'ApplicationServiceRef', 'QueryServiceRef', 'SagaContextRef', 'ControllerRef',
  'UserRoleRef', 'ProjectionRef', 'LifecycleStateRef', 'LifecycleRef',
]);
const primitiveFqns = Object.freeze({
  StringType: 'java.lang.String', IntType: 'scala.Int', LongType: 'scala.Long',
  DoubleType: 'scala.Double', BooleanType: 'scala.Boolean',
  BigDecimalType: 'scala.math.BigDecimal', UnitType: 'scala.Unit',
});

// Product field order, not JSON key order, drives the original flatten scan.
// Other records retain their exported productElementNames order.
const layerFields = Object.freeze({
  SystemMetadata: ['name', 'contextName', 'domain', 'application', 'infrastructure', 'interfaces', 'storyboard', 'externalSystems', 'timers'],
  DomainLayer: ['valueObjects', 'behaviors', 'entities', 'services', 'invariants', 'policies'],
  ApplicationLayer: ['valueObjects', 'behaviors', 'aggregates', 'services', 'queries', 'sagas', 'repositories', 'lifecycles', 'useCases', 'gates', 'viewKeys', 'connectors'],
  InfrastructureLayer: ['valueObjects', 'repositories', 'projections', 'connectors', 'handwritten'],
  InterfaceLayer: ['valueObjects', 'controllers'],
});
// Scala maps and Products both export as JSON objects. These are all Map fields
// in the pinned ArchitectMetadata.scala, and their values are primitive. Never
// inspect a map's own `_type`/`name` keys as though it were a Product declaration.
const mapFields = Object.freeze({
  SubordinateDomainEventMetadata: { protoFieldMapping: 'number' },
  PolicyMetadata: { argumentMappings: 'string' },
  SagaParticipantMetadata: { argMappings: 'string' },
  CommandBinding: { mappings: 'string' },
  UnitTestCase: { inputs: 'string' },
  BehaviorTestCase: { initialStateModifications: 'string' },
});
function children(value) {
  const keys = layerFields[value._type] ?? Object.keys(value);
  return keys.filter(key => key !== '_type' && Object.hasOwn(value, key)).flatMap(key => {
    const child = value[key];
    const fields = Object.hasOwn(mapFields, value._type) ? mapFields[value._type] : null;
    const valueType = fields && Object.hasOwn(fields, key) ? fields[key] : null;
    if (!valueType) return [child];
    if (!child || typeof child !== 'object' || Array.isArray(child) ||
        Object.values(child).some(entry => typeof entry !== valueType))
      error('CLASSIC_METADATA_TYPE', `${value._type}.${key} must be a string-keyed map of ${valueType} values`);
    return []; // No metadata can occur in a well-typed primitive-valued Scala Map.
  });
}
function metadataFqn(meta) {
  if (meta._type === 'MethodMetadata') return `${meta.name}(...)`;
  if (meta._type === 'ServiceMethod') return `AppService.${meta.name}`;
  return `${categories[meta._type]}.${meta.name}`;
}
function matches(meta, kind) {
  if (kind === 'DomainDrivenMetadata') return Object.hasOwn(categories, meta._type);
  return meta._type === kind || (subtypes[kind]?.includes(meta._type) ?? false);
}
function error(code, message) {
  throw new ProductError(code, message, { document: 'classic-architecture', pointer: '/system' });
}
function text(value, label, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.length))
    error('CLASSIC_METADATA_TYPE', `${label} must be ${allowEmpty ? 'a' : 'a nonempty'} string`);
  return value;
}
function sequence(value, label) {
  if (!Array.isArray(value)) error('CLASSIC_METADATA_TYPE', `${label} must be an array`);
  return value;
}
function product(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value._type !== 'string')
    error('CLASSIC_METADATA_TYPE', `${label} must be an original Scala Product with _type`);
  return value;
}
function named(value, label) {
  product(value, label);
  return text(value.name, `${label}.name`);
}

/** Full typed lookup, separate from flattenAllComponents' FQN deduplication.
 * Keep every original named Product, including nested state/reply/behavior
 * metadata and retained layers. In particular, a role and aggregate with the
 * same name do not overwrite one another. No inferred metadata shapes.
 */
function collectRegistry(system) {
  const records = [];
  const byKind = new Map();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (typeof value._type === 'string' && typeof value.name === 'string') {
      records.push(value);
      if (!byKind.has(value._type)) byKind.set(value._type, new Map());
      const names = byKind.get(value._type);
      if (!names.has(value.name)) names.set(value.name, []);
      names.get(value.name).push(value);
    }
    children(value).forEach(visit);
  }
  visit(system);
  return Object.freeze({
    resolveByName(kind, name) {
      text(kind, 'metadata category'); text(name, 'metadata name');
      if (kind === 'DomainDrivenMetadata' || Object.hasOwn(subtypes, kind))
        return records.find(meta => meta.name === name && matches(meta, kind)) ?? null;
      return byKind.get(kind)?.get(name)?.[0] ?? null;
    },
    resolveAll(kind) { return Object.freeze(records.filter(meta => matches(meta, kind))); },
    all: Object.freeze(records),
  });
}

// EnhancedDependencyGraphBuilder.flattenAllComponents: pre-order Product walk,
// first metadata FQN wins and its duplicate subtree is not scanned. The frozen
// full-source round supplies this helper omitted from the small docs baseline.
function flattenedMetadata(system) {
  const result = [];
  const seen = new Set();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (Object.hasOwn(categories, value._type)) {
      named(value, value._type);
      const key = metadataFqn(value);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(value);
    }
    if (value._type === 'CustomType') sequence(value.typeParameters, 'CustomType.typeParameters').forEach(visit);
    else children(value).forEach(visit);
  }
  visit(system);
  return result;
}

function rawTypeFqn(value) {
  product(value, 'query return type');
  if (Object.hasOwn(primitiveFqns, value._type)) return primitiveFqns[value._type];
  if (rawRefKinds.has(value._type)) return `Ref(${text(value.targetName, 'ref.targetName')})`;
  if (value._type === 'CustomType') {
    const args = sequence(value.typeParameters, 'CustomType.typeParameters').map(rawTypeFqn);
    const base = `${text(value.packagePath, 'CustomType.packagePath', true)}.${text(value.typeName, 'CustomType.typeName')}`;
    return args.length ? `${base}[${args.join(', ')}]` : base;
  }
  error('CLASSIC_TYPE_UNSUPPORTED', `unsupported retained query DataType: ${value._type}`);
}

// GeneratorContext.collectOwnedTypeNames + SymbolTable.of. Symbols store their
// originating metadata kind as well as name, so typed collisions are not lost
// to Scala's erased generic isInstanceOf[T] lookup.
const sagaEvents = Object.freeze([
  'TransactionInitiated', 'TransactionPrepared', 'TransactionCompleted', 'TransactionFailed',
]);
function collectOwners(system) {
  const owners = new Map();
  const syntheticRefs = new Map();
  function synthetic(kind, name) {
    if (!syntheticRefs.has(name)) syntheticRefs.set(name, new Set());
    syntheticRefs.get(name).add(kind);
  }
  function add(name, owner) {
    text(name, 'nested type name');
    if (owners.has(name)) error('CLASSIC_NESTED_TYPE_DUPLICATE',
      `Duplicate nested types defined in SymbolTable: ${name} (${owners.get(name)._type} ${owners.get(name).name}; ${owner._type} ${owner.name})`);
    owners.set(name, owner);
  }
  for (const meta of flattenedMetadata(system)) {
    let names = [];
    switch (meta._type) {
      case 'DomainEntityMetadata':
        names = [named(meta.state, 'entity.state'), named(meta.eventFamily, 'entity.eventFamily'),
          `${meta.eventFamily.name}Handler`,
          ...sequence(meta.eventFamily.events, 'entity.eventFamily.events').map(event => named(event, 'event'))];
        break;
      case 'AggregateRootMetadata':
        names = [
          ...sequence(meta.commandFamily?.commands, 'aggregate.commandFamily.commands').map(command => named(command, 'command')),
          ...sequence(meta.replyFamily?.replies, 'aggregate.replyFamily.replies').map(reply => named(reply, 'reply')),
          named(meta.commandFamily, 'aggregate.commandFamily'), named(meta.replyFamily, 'aggregate.replyFamily'),
        ];
        break;
      case 'SagaTransactorMetadata':
        // GeneratorContext explicitly registers these symbols without creating
        // standalone DomainEventMetadata/ValueObjectMetadata Products for them.
        sagaEvents.forEach(name => synthetic('EventRef', name));
        synthetic('EntityStateRef', naming.getSagaTransactionStateName(meta.name));
        names = [
          ...sequence(meta.commandFamily?.commands, 'saga.commandFamily.commands').map(command => named(command, 'command')),
          named(meta.commandFamily, 'saga.commandFamily'),
          ...(meta.replyMetadata === null ? [] : [named(meta.replyMetadata, 'saga.replyMetadata')]),
          ...sagaEvents,
          naming.getSagaTransactionStateName(meta.name),
        ];
        break;
      case 'QueryServiceMetadata':
        names = [
          ...sequence(meta.structs, 'query.structs').map(struct => named(struct, 'query struct')),
          // Deliberately includes the raw generic FQN tail (even its brackets),
          // rather than interpreting a query return value as a nested struct.
          ...sequence(meta.methods, 'query.methods').map(method => rawTypeFqn(method.returnType).split('.').at(-1)),
        ];
        break;
    }
    names.forEach(name => add(name, meta));
  }
  return { owners, syntheticRefs };
}

function packageLayout(base) {
  const domain = `${base}.domain`, application = `${base}.application`;
  return Object.freeze({
    domain: Object.freeze({
      values: `${domain}.values`,
      entities: Object.freeze({ root: `${domain}.entities`, behaviors: `${domain}.entities.behaviors` }),
      invariants: Object.freeze({ root: `${domain}.invariant` }),
      services: `${domain}.services`,
    }),
    application: Object.freeze({
      aggregates: Object.freeze({ root: `${application}.aggregates`, behaviors: `${application}.aggregates.behaviors` }),
    }),
  });
}

function frameworkTypes(frameworkPackage) {
  const common = `${frameworkPackage}.common`;
  return Object.freeze({
    CborSerializable: typeRef('CborSerializable', common),
    Id: typeRef('Id', `${common}.CommonTypes`), UUID: typeRef('UUID', 'java.util'),
    InvariantRule: typeRef('InvariantRule', `${common}.CommonTypes`),
    iMadzError: typeRef('iMadzError', `${common}.CommonTypes`),
    DomainService: typeRef('DomainService', `${common}.CommonTypes`),
    CommandHelper: typeRef('CommandHelper', `${common}.application.CommandHandlerReplyingBehavior`),
  });
}

// GeneratorContext.knownFrameworkTypes is a name override for CustomType, not
// an assertion that its corresponding framework/artifact is generated here.
function knownTypes(types, frameworkPackage) {
  const result = {
    Id: types.Id, CborSerializable: types.CborSerializable,
    iMadzError: types.iMadzError, InvariantRule: types.InvariantRule,
    CommandHelper: types.CommandHelper,
  };
  const groups = [
    ['scala.concurrent', ['Future', 'ExecutionContext']],
    ['scala', ['Either', 'Option']],
    ['scala.collection.immutable', ['List', 'Map']],
    ['scala.math', ['BigDecimal']],
    ['javax.inject', ['Inject', 'Singleton']],
    ['com.google.inject', ['ImplementedBy']],
    ['play.api.mvc', ['ControllerComponents', 'BaseController', 'Action', 'AnyContent', 'Request']],
    ['play.api.libs.json', ['Json', 'OWrites']],
    ['akka.actor.typed', ['ActorRef', 'ActorSystem', 'Scheduler', 'Behavior', 'LogOptions', 'SupervisorStrategy']],
    ['akka.actor.typed.scaladsl', ['Behaviors', 'ActorContext', 'adapter']],
    ['akka.cluster.sharding.typed.scaladsl', ['ClusterSharding', 'Entity', 'EntityContext', 'EntityTypeKey', 'EntityRef']],
    ['akka.persistence.typed', ['PersistenceId']],
    ['akka.persistence.typed.scaladsl', ['Effect', 'RetentionCriteria']],
    ['akka.util', ['Timeout']],
    ['akka.projection', ['Projection', 'ProjectionId']],
    ['akka.persistence.query', ['Offset']],
    ['akka.projection.eventsourced', ['EventEnvelope']],
    ['akka.projection.eventsourced.scaladsl', ['EventSourcedProvider']],
    ['akka.projection.scaladsl', ['SourceProvider', 'ExactlyOnceProjection']],
    ['akka.projection.jdbc.scaladsl', ['JdbcProjection', 'JdbcHandler']],
    ['akka.contrib.persistence.mongodb', ['MongoReadJournal']],
    ['net.imadz.common.application.projection', ['ScalikeJdbcSession', 'ScalikeJdbcSetup']],
    // This literal is intentionally NOT frameworkPackage: the Scala map fixes it.
    ['net.imadz.common.application.CommandHandlerReplyingBehavior', ['runReplyingPolicy']],
    ['net.imadz.infra.saga', ['SagaTransactionCoordinator', 'SagaStep', 'SagaTransactionStep', 'SagaParticipant', 'StepExecutor', 'ForSaga']],
    ['net.imadz.infra.saga.SagaPhase', ['PreparePhase', 'CommitPhase', 'CompensatePhase']],
    ['net.imadz.infra.saga.SagaTransactionCoordinator', ['TransactionResult', 'TracingStep']],
    ['net.imadz.infra.saga.SagaParticipant', ['ParticipantEffect', 'SagaResult']],
    ['net.imadz.infra.saga.serialization', ['AkkaSerializationWrapper']],
    ['org.slf4j', ['LoggerFactory']], ['org.slf4j.event', ['Level']],
    [`${frameworkPackage}.common.CommonTypes`, ['ReadModel']],
  ];
  for (const [pkg, names] of groups) for (const name of names) result[name] = typeRef(name, pkg);
  return Object.freeze(result);
}

/** Raw classic metadata only. No files, fixture names, expected-output maps,
 * generation or module-global mutable registries participate in resolution.
 */
export function createClassicContext(system, options, version = '1') {
  if (!['1', '2'].includes(version)) error('CLASSIC_VERSION', 'unsupported classic context version');
  if (product(system, 'system')._type !== 'SystemMetadata')
    error('CLASSIC_METADATA_TYPE', 'expected SystemMetadata');
  if (!options || typeof options !== 'object' || Array.isArray(options))
    error('CLASSIC_OPTIONS', 'explicit rootPackage, frameworkPackage and moduleName are required');
  const allowed = new Set(['rootPackage', 'frameworkPackage', 'moduleName', 'excludedStateFieldNatures', 'formalSemantics']);
  for (const key of Object.keys(options)) if (!allowed.has(key))
    error('CLASSIC_OPTIONS', `unsupported classic context option: ${key}`);
  const rootPackage = text(options.rootPackage, 'rootPackage');
  const frameworkPackage = text(options.frameworkPackage, 'frameworkPackage');
  const moduleName = text(options.moduleName, 'moduleName');
  if (Object.hasOwn(options, 'excludedStateFieldNatures')) {
    const excluded = options.excludedStateFieldNatures;
    if (!(Array.isArray(excluded) && excluded.length === 0) && !(excluded instanceof Set && excluded.size === 0))
      error('CLASSIC_STATE_EXCLUSIONS_UNSUPPORTED', 'classic profile does not support excluded-state configuration');
  }
  if (Object.hasOwn(options, 'formalSemantics') && options.formalSemantics !== null)
    error('CLASSIC_FORMAL_UNSUPPORTED', 'classic metadata has no formal semantics attachment');

  const basePackage = `${rootPackage}.${moduleName}`;
  const layout = packageLayout(basePackage);
  const types = frameworkTypes(frameworkPackage);
  const knownFrameworkTypes = knownTypes(types, frameworkPackage);
  const metaRegistry = collectRegistry(system);
  const { owners, syntheticRefs } = collectOwners(system);
  const queryPackage = `${basePackage}.application.queries`;
  const transactorPackage = `${basePackage}.application.services.transactor`;

  function requireMetadata(kind, name) {
    text(name, 'ref.targetName');
    const meta = metaRegistry.resolveByName(kind, name);
    if (meta === null) error('CLASSIC_REFERENCE', `unresolved ${kind} reference: ${name}`);
    return meta;
  }
  function ownerOf(name) {
    text(name, 'nested type name');
    const owner = owners.get(name);
    if (!owner) error('CLASSIC_OWNER_MISSING', `no declared nested owner for ${name}`);
    return owner;
  }
  function nameOfAggregate(value) {
    if (typeof value === 'string') return text(value, 'aggregate name');
    if (product(value, 'aggregate')._type !== 'AggregateRootMetadata')
      error('CLASSIC_METADATA_TYPE', 'expected AggregateRootMetadata or a name');
    return named(value, 'aggregate');
  }
  function aggregateProtocol(value) {
    return typeRef(`${naming.getBaseName(nameOfAggregate(value))}Protocol`, layout.application.aggregates.root);
  }
  // TypeResolverDSL.command/commandFamily/commandReply have identical owner
  // dispatch, but this is NOT the Event/Struct nested dispatch below.
  function commandType(name) {
    text(name, 'command type name');
    const owner = owners.get(name);
    // The String overload is a naming operation with an explicit root-package
    // fallback. Structured refs must pass the declaration check in resolve().
    if (!owner) return typeRef(name, layout.application.aggregates.root);
    let pkg;
    switch (owner._type) {
      case 'AggregateRootMetadata': pkg = fqn(aggregateProtocol(owner.name)); break;
      case 'SagaTransactorMetadata': pkg = `${transactorPackage}.${naming.getBaseName(owner.name)}Protocol`; break;
      case 'DomainEntityMetadata': pkg = `${layout.domain.entities.root}.${owner.name}`; break;
      case 'QueryServiceMetadata': pkg = `${queryPackage}.${owner.name}`; break;
      default: error('CLASSIC_OWNER_UNSUPPORTED', `unsupported command owner: ${owner._type} ${owner.name}`);
    }
    return typeRef(name, pkg);
  }
  function nestedType(name) {
    const owner = ownerOf(name);
    const base = naming.getBaseName(owner.name);
    switch (owner._type) {
      case 'AggregateRootMetadata': return typeRef(name, `${layout.application.aggregates.root}.${naming.aggregateRootName(base)}`);
      case 'SagaTransactorMetadata': return typeRef(name, `${transactorPackage}.${base}`);
      case 'DomainEntityMetadata': return typeRef(name, `${layout.domain.entities.root}.${naming.domainEntityName(base)}`);
      case 'QueryServiceMetadata': return typeRef(name, `${queryPackage}.${naming.queryServiceName(base)}`);
      default: error('CLASSIC_OWNER_UNSUPPORTED', `unsupported nested owner: ${owner._type} ${owner.name}`);
    }
  }
  function entityState(name) {
    return typeRef(text(name, 'state name'), `${layout.domain.entities.root}.${naming.getEntityNameFromStateName(name)}`);
  }
  function entity(name) {
    return typeRef(naming.domainEntityName(naming.getBaseName(text(name, 'entity name'))), layout.domain.entities.root);
  }
  function invariantRule(name) {
    // getBaseName does NOT strip Rule; retain RuleRule if present in raw input.
    return typeRef(naming.invariantRuleName(naming.getBaseName(text(name, 'invariant name'))), layout.domain.invariants.root);
  }
  function valueObject(name) {
    return typeRef(naming.domainValueObjectName(naming.getBaseName(name)), layout.domain.values);
  }
  function aggregateBehavior(value) {
    const name = nameOfAggregate(value);
    // The metadata overload removes Aggregate before calling the string one.
    const base = typeof value === 'string' ? name : naming.getAggregateBaseName(name);
    return typeRef(naming.aggregateBehaviorName(naming.getBaseName(base)), layout.application.aggregates.behaviors);
  }
  function resolve(metaType) {
    const kind = product(metaType, 'metaType')._type;
    if (Object.hasOwn(primitives, kind)) return primitives[kind];
    if (kind === 'CustomType') {
      const name = text(metaType.typeName, 'CustomType.typeName');
      const pkg = text(metaType.packagePath, 'CustomType.packagePath', true);
      const args = sequence(metaType.typeParameters, 'CustomType.typeParameters').map(resolve);
      const known = Object.hasOwn(knownFrameworkTypes, name) ? knownFrameworkTypes[name] : null;
      // Seq/Set/Vector are deliberately not invented framework overrides.
      return typeRef(known?.name ?? name, known?.packageName ?? (pkg === 'net.imadz.domain.values' ? layout.domain.values : pkg), args);
    }
    if (kind === 'DomainEntityMetadata') return resolve({ _type: 'EntityRef', targetName: metaType.name });
    if (kind === 'AggregateRootMetadata') return resolve({ _type: 'AggregateRef', targetName: metaType.name });
    if (kind === 'ValueObjectMetadata') return resolve({ _type: 'ValueObjectRef', targetName: metaType.name });
    if (kind === 'StructRef') {
      const name = text(metaType.targetName, 'StructRef.targetName');
      const event = version === '2' ? metaRegistry.resolveByName('SubordinateDomainEventMetadata', name) : null;
      if (event !== null) {
        const owner = ownerOf(name);
        if (owner._type !== 'DomainEntityMetadata' || !owner.eventFamily.events.some(member => member.name === name))
          error('CLASSIC_REFERENCE', `StructRef event requires a declared entity owner: ${name}`);
        return nestedType(name);
      }
      requireMetadata('ValueObjectMetadata', name);
      if (owners.has(name)) return nestedType(name);
      // StructRef keeps its raw name; ValueObjectRef strips suffixes.
      return typeRef(name, layout.domain.values);
    }
    if (!Object.hasOwn(referenceKinds, kind))
      error('CLASSIC_TYPE_UNSUPPORTED', `MetaType is not admitted by the classic four-family slice: ${kind}`);
    const name = text(metaType.targetName, `${kind}.targetName`);
    if (!syntheticRefs.get(name)?.has(kind)) requireMetadata(referenceKinds[kind], name);
    switch (kind) {
      case 'EntityStateRef': return entityState(name);
      case 'EventRef': case 'EventFamilyRef': return nestedType(name);
      case 'CommandRef': case 'CommandFamilyRef': case 'CommandReplyRef': return commandType(name);
      case 'EntityBehaviorRef': return typeRef(name, layout.domain.entities.behaviors);
      case 'EntityRef': return entity(name);
      case 'AggregateRef': return typeRef(naming.aggregateRootName(naming.getBaseName(name)), layout.application.aggregates.root);
      case 'InvariantRuleRef': return invariantRule(name);
      case 'AggregateBehaviorRef': return aggregateBehavior(name);
      case 'AggregateRepositoryRef': return typeRef(naming.aggregateRepositoryInterfaceName(naming.getBaseName(name)), `${basePackage}.application.aggregates.repository`);
      case 'DomainServiceRef': return typeRef(naming.domainServiceName(naming.getBaseName(name)), layout.domain.services);
      case 'ValueObjectRef': return valueObject(name);
      default: error('CLASSIC_TYPE_UNSUPPORTED', `unsupported reference: ${kind}`);
    }
  }
  const nameOrRef = stringResolver => value => typeof value === 'string' ? stringResolver(value) : resolve(value);
  const typeResolver = Object.freeze({
    resolve,
    entity: nameOrRef(entity), entityState: nameOrRef(entityState),
    eventFamily: nameOrRef(name => typeRef(text(name, 'event family name'), layout.domain.entities.root)),
    command: nameOrRef(commandType), commandFamily: nameOrRef(commandType), commandReply: nameOrRef(commandType),
    aggregateProtocol, aggregateBehavior,
    commandHelper(value) {
      const name = typeof value === 'string' ? text(value, 'command helper name')
        : naming.getCommandHelperNameFromAggregateName(nameOfAggregate(value));
      return typeRef(name, layout.application.aggregates.behaviors);
    },
    invariantRule, parameterType: resolve,
    tuple(refs) {
      sequence(refs, 'tuple parameters');
      return refs.length ? typeRef(`Tuple${refs.length}`, 'scala', refs) : typeRef('Unit', 'scala');
    },
    unit: primitives.UnitType, any: typeRef('Any'),
    ...(version === '2' ? {
      valueObject,
      entityBehaviorSelf: (name, pkg) => typeRef(text(name, 'entity behavior name'), text(pkg, 'entity behavior package')),
      entityObjectPath: name => `${layout.domain.entities.root}.${text(name, 'entity object name')}`,
    } : {}),
  });

  // Read-only projection of DomainEntityModel.registerTo during collection of
  // the four families. It is intentionally separate from SymbolTable: event
  // artifacts are registered under the family selfType, while imports use the
  // entity owner. AggregateProtocolModel has NO command/reply registerNested.
  const nested = new Map();
  function registerNested(selfType, ownerType) {
    nested.set(fqn(selfType), Object.freeze({ selfType, ownerType }));
  }
  for (const meta of sequence(system.domain?.entities, 'system.domain.entities')) {
    const selfType = entity(named(meta, 'entity'));
    const familyName = named(meta.eventFamily, 'entity.eventFamily');
    const familyType = typeResolver.eventFamily(familyName);
    registerNested(familyType, selfType);
    for (const event of sequence(meta.eventFamily.events, 'entity.eventFamily.events')) {
      const name = named(event, 'event');
      if (name !== familyName) registerNested(typeRef(name, fqn(familyType)), familyType);
    }
    registerNested(entityState(named(meta.state, 'entity.state')), selfType);
  }
  const nestedArtifacts = Object.freeze({
    allNested: Object.freeze([...nested.values()]), nestedSize: nested.size,
    resolveNestedByFqn: name => nested.get(name) ?? null,
    resolveNestedByTypeRef: ref => nested.get(fqn(ref)) ?? null,
    resolveNestedByOwner: owner => Object.freeze([...nested.values()].filter(entry => fqn(entry.ownerType) === fqn(owner))),
  });
  return Object.freeze({
    system, rootPackage, frameworkPackage, moduleName, basePackage, layout,
    types, knownFrameworkTypes, conventions: naming, metaRegistry, typeResolver, resolve,
    symbolTable: Object.freeze({
      resolve(value) {
        const name = typeof value === 'string' ? value : value?.name;
        const owner = owners.get(name);
        return owner ? Object.freeze({ name: owner.name }) : null;
      },
      resolveOwner: name => owners.get(name) ?? null,
    }),
    nestedArtifacts,
    isStateFieldExcluded: () => false,
    formalSemantics: null,
  });
}
