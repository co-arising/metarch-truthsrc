import { at, array, escape, fail, object } from '../products/request.mjs';

// Constructor shapes, not a list of declarations observed in an example.
// Source: .rounds/f1-byte-parity-20261116/bc-source/src/main/scala/net/imadz/meta/ArchitectMetadata.scala.
// Wire representation: tools/codegen-parity/ClassicMetadataExport.scala (Option,
// Either, Tuple2 and exact numeric carriers). No source/code strings are executed.
const child = (source, key) => at(source.document, source.pointer + '/' + escape(String(key)));
const mismatch = (expected, source) => fail('CLASSIC_METADATA_TYPE', 'expected ' + expected, source);
function string(value, source) {
  if (typeof value !== 'string') mismatch('string', source);
}
function boolean(value, source) {
  if (typeof value !== 'boolean') mismatch('boolean', source);
}
const exactInteger = value => Number.isSafeInteger(value) && !Object.is(value, -0);
function int(value, source) {
  if (!exactInteger(value) || value < -2147483648 || value > 2147483647) mismatch('Scala Int', source);
}
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u;
function decimalText(value, source) {
  string(value, source);
  if (!decimalPattern.test(value)) mismatch('exact decimal string', source);
}
function doubleText(value, source) {
  string(value, source);
  if (!decimalPattern.test(value) && !['NaN', 'Infinity', '-Infinity'].includes(value))
    mismatch('exported Double string', source);
}
function longText(value, source) {
  string(value, source);
  if (!/^-?(?:0|[1-9]\d*)$/u.test(value)) mismatch('exact Long string', source);
  const number = BigInt(value);
  if (number < -9223372036854775808n || number > 9223372036854775807n) mismatch('Scala Long', source);
}
function long(value, source) {
  if (exactInteger(value)) return;
  product(value, ['Long'], source);
}
function double(value, source) {
  // The exporter emits integral, safe Doubles as JSON integers; all other
  // Doubles (including -0.0 and nonfinite values) retain their exact tagged text.
  // Do not weaken products/request.mjs's shared exact-number boundary.
  if (exactInteger(value)) return;
  product(value, ['Double'], source);
}
const optional = validate => (value, source) => {
  if (value !== null) validate(value, source);
};
const list = validate => (value, source) => {
  array(value, source).forEach((entry, index) => validate(entry, child(source, index)));
};
const p = (...tags) => (value, source) => product(value, tags, source);
const many = (...tags) => list(p(...tags));
const maybe = (...tags) => optional(p(...tags));
const strings = list(string), optionalString = optional(string);
function primitiveMap(value, source, validate) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) mismatch('string-keyed Scala Map', source);
  // Only the six declared primitive-valued Map fields use this path. In a Map,
  // even keys named _type/name are data, never a Product tag/declaration.
  for (const [key, entry] of Object.entries(value)) validate(entry, child(source, key));
}
const stringMap = (value, source) => primitiveMap(value, source, string);
const intMap = (value, source) => primitiveMap(value, source, int);

const primitiveTags = ['StringType', 'IntType', 'LongType', 'DoubleType', 'BooleanType', 'BigDecimalType', 'UnitType'];
const referenceTags = [
  'InvariantRuleRef', 'EntityRef', 'EventFamilyRef', 'EntityBehaviorRef', 'EventRef', 'EntityStateRef',
  'CommandRef', 'CommandFamilyRef', 'CommandReplyRef', 'AggregateRef', 'AggregateRepositoryRef',
  'ProjectionRepositoryRef', 'ApplicationServiceRef', 'QueryServiceRef', 'StructRef', 'SagaContextRef',
  'DomainServiceRef', 'ValueObjectRef', 'ControllerRef', 'UserRoleRef', 'ProjectionRef',
  'AggregateBehaviorRef', 'LifecycleStateRef', 'LifecycleRef',
];
const dataType = p(...primitiveTags, ...referenceTags, 'CustomType');
const metaRef = p(...referenceTags);
const commandReply = p('SubordinateCommandReplyMetadata', 'CommandReplyFamilyMetadata');
const repositories = many('AggregateRepositoryMetadata', 'ProjectionRepositoryMetadata');
const repositoryMethods = many('UpsertMethod', 'QueryMethod');
const storage = p('TableMetadata', 'EsIndexMetadata', 'RedisKeyMetadata', 'PgVectorTableMetadata', 'Neo4jGraphMetadata', 'MongoDocumentMetadata');
const derivation = p('DirectField', 'ComputedField', 'ConstantField', 'AggregateIdentity', 'UnresolvedField');
const onFailure = p('Abort', 'Soft', 'Resume');
function writeKind(value, source) {
  // Two Scala constructors have productPrefix "SideEffect": this case object
  // and the lifecycle case class. Their allowed fields depend on the slot.
  if (value?._type === 'SideEffect') object(value, ['_type'], source);
  else product(value, ['AggregateCommand'], source);
}
function metaType(value, source) {
  // Scala really declares MetaType (not DataType) for Field/Parameter types and
  // CustomType arguments. Admit only its closed constructor set, recursively;
  // do not turn those slots into an arbitrary-object or arbitrary-tag escape.
  if (value?._type === 'SideEffect' && Object.keys(value).length === 1) writeKind(value, source);
  else product(value, metaTypeTags, source);
}

// All constructors below extend MetaType in the pinned file. Explicit field
// schemas are also needed for compiler-owned constructors when they occur in
// retained queries, sagas, interface VOs, etc. Name/link/behavior semantics stay
// with the existing compiler and their respective (not emitted here) families.
const metaSchemas = {
  ...Object.fromEntries(primitiveTags.map(tag => [tag, {}])),
  ...Object.fromEntries(referenceTags.map(tag => [tag, { targetName: string }])),
  ...Object.fromEntries([
    'RetryIfOngoing', 'FailIfOngoing', 'MarkAsRetryable', 'MarkAsNonRetryable',
    'AggregateIdentity', 'Stay', 'Stop', 'NoBootstrap', 'GuiceModule', 'ReturnNone',
    'Generated', 'FromEntry', 'Context', 'Abort', 'Soft', 'Resume', 'AggregateCommand',
  ].map(tag => [tag, {}])),
  CustomType: { typeName: string, packagePath: string, typeParameters: list(metaType) },
  BusinessLogic: { intent: string, invariants: strings, referenceCode: optionalString },
  FieldMetadata: {
    name: string, fieldType: metaType, optional: boolean, defaultValue: optionalString,
    introducedIn: string, nature: string, noteId: optionalString, description: string, writtenBy: strings,
  },
  ParameterMetadata: {
    name: string, parameterType: metaType, optional: boolean, optionalWhen: string,
    noteId: optionalString, description: string,
  },
  ValueObjectMetadata: {
    name: string, fields: many('FieldMetadata'), description: string,
    logic: maybe('BusinessLogic'), noteIds: strings, ownNoteId: optionalString,
  },
  SubordinateDomainEventMetadata: {
    name: string, fields: many('FieldMetadata'), requiresProtobuf: boolean, description: string,
    protoFieldMapping: intMap, causedBy: many('EventCausalRef'), producedBy: many('CommandRef'), noteId: optionalString,
  },
  EventFamilyMetadata: {
    name: string, description: string, events: many('SubordinateDomainEventMetadata'),
    fields: many('FieldMetadata'), requiresProtobuf: boolean,
  },
  EntityBehaviorMetadata: {
    name: string, eventFamilyRef: p('EventFamilyRef'), handlers: many('EventStateMutation'),
    helperMethods: many('MethodMetadata'),
  },
  DomainEntityMetadata: {
    name: string, state: p('ValueObjectMetadata'), eventFamily: p('EventFamilyMetadata'), noteId: optionalString,
  },
  EventStateMutation: { eventRef: p('EventRef'), logic: p('BusinessLogic') },
  InvariantRuleMetadata: {
    name: string, description: string, subject: p('EntityStateRef'), trigger: dataType,
    output: p('EventFamilyRef'), conditions: many('InvariantCondition'),
  },
  InvariantCondition: { name: string, errorCode: string, logic: p('BusinessLogic') },
  PolicyMetadata: {
    name: string, description: string, sourceAggregate: string, triggerEvent: p('EventRef'),
    targetAggregate: string, command: p('CommandRef'), argumentMappings: stringMap,
    entityIdField: string, idempotencyKey: string, resilience: p('ResiliencePolicy'),
    logic: p('BusinessLogic'), noteId: optionalString,
  },
  DomainServiceMetadata: { name: string, description: string, methods: many('MethodMetadata') },
  MethodMetadata: {
    name: string, parameters: many('ParameterMetadata'), returnType: dataType,
    logic: p('Left', 'Right'), description: string, isPrivate: boolean,
  },
  SubordinateCommandReplyMetadata: { name: string, parameters: many('ParameterMetadata') },
  CommandReplyFamilyMetadata: { name: string, replies: many('SubordinateCommandReplyMetadata') },
  SubordinateCommandMetadata: {
    name: string, parameters: many('ParameterMetadata'), replyToType: maybe('CommandReplyRef'),
    isReadOnly: boolean, description: string, isSystemCommand: boolean, noteId: optionalString,
  },
  CommandFamilyMetadata: { name: string, description: string, commands: many('SubordinateCommandMetadata') },
  CommandHandlingFlow: {
    commandRef: p('CommandRef'), invariantRef: p('InvariantRuleRef'), replyMapping: p('ReplyMappingConfig'),
  },
  ReplyMappingConfig: { successReplyRef: p('CommandReplyRef'), failureReplyRef: p('CommandReplyRef') },
  AggregateCommandHandlersMetadata: { name: string, flows: many('CommandHandlingFlow') },
  AggregateBehaviorMetadata: { name: string, behaviors: many('AggregateCommandHandlersMetadata') },
  AggregateRootMetadata: {
    name: string, identifier: p('FieldMetadata'), entityRef: p('EntityRef'), stateRef: p('EntityStateRef'),
    eventFamilyRef: p('EventFamilyRef'), commandFamily: p('CommandFamilyMetadata'),
    replyFamily: p('CommandReplyFamilyMetadata'), behaviorRef: p('AggregateBehaviorRef'),
    persistenceConfig: p('PersistenceConfig'), repository: maybe('AggregateRepositoryRef'), description: string,
    implConfig: p('ImplementationConfig'), factoryMethods: many('MethodMetadata'), noteId: optionalString,
  },
  PersistenceConfig: { entityTypeKey: string, tagging: p('ShardedTags'), snapshotInterval: int, eventAdapter: boolean },
  ShardedTags: { baseName: string, numberOfShards: int },
  ApplicationServiceMetadata: {
    name: string, description: string, dependencies: list(dataType), methods: many('ServiceMethod'),
  },
  QueryServiceMetadata: {
    name: string, description: string, repositories: list(metaRef),
    structs: many('ValueObjectMetadata'), methods: many('ServiceMethod'),
  },
  ServiceMethod: {
    name: string, parameters: many('ParameterMetadata'), returnType: dataType,
    logic: p('BusinessLogic'), invokes: many('CommandRef'),
  },
  SagaContextMetadata: {
    name: string, fields: many('FieldMetadata'), description: string, logic: maybe('BusinessLogic'),
  },
  SagaArgsMetadata: { name: string, fields: many('FieldMetadata'), description: string },
  SagaTransactorMetadata: {
    name: string, commandFamily: p('CommandFamilyMetadata'), triggerCommandName: string,
    participants: many('SagaParticipantMetadata'), steps: many('SagaStepMetadata'),
    replyMetadata: optional(commandReply), version: int, args: maybe('SagaArgsMetadata'), context: maybe('SagaContextMetadata'),
  },
  SagaParticipantMetadata: {
    name: string, interactsWith: p('AggregateRef'), fields: many('FieldMetadata'), argMappings: stringMap,
  },
  SagaStepMetadata: {
    stepId: string, participantName: string, phaseLogic: p('SagaPhaseLogic'), resilience: p('ResiliencePolicy'), stepGroup: int,
  },
  CommandBinding: { commandRef: p('CommandRef'), mappings: stringMap },
  SagaPhaseLogic: {
    prepareCommand: maybe('CommandBinding'), commitCommand: maybe('CommandBinding'), compensateCommand: maybe('CommandBinding'),
  },
  ResiliencePolicy: {
    timeoutPerAttempt: string, retryStrategy: p('ExponentialBackoff'), circuitBreaker: maybe('CircuitBreakerConfig'),
    recoveryBehavior: p('RetryIfOngoing', 'FailIfOngoing'), errorRules: many('ErrorRule'),
  },
  ExponentialBackoff: { initialDelay: string, factor: double, maxRetries: int },
  CircuitBreakerConfig: { maxFailures: int, callTimeout: string, resetTimeout: string },
  ErrorRule: { errorType: string, codePattern: string, action: p('MarkAsRetryable', 'MarkAsNonRetryable') },
  DirectField: { eventName: string, sourceField: string },
  ComputedField: { expression: string, dependsOn: list(derivation) },
  ConstantField: { value: string },
  UnresolvedField: { origin: string },
  ReadModelField: {
    name: string, dataType, derivation, isKey: boolean, nullable: optional(boolean), noteId: optionalString, description: string,
  },
  ReadModelSchema: { fields: many('ReadModelField'), identityKeys: strings },
  ProjectionMetadata: {
    name: string, sourceAggregate: string, repositoryRef: optional(metaRef), handlers: many('ProjectionEventHandlerMetadata'),
    readModelSchema: maybe('ReadModelSchema'), decisionSupport: many('CommandRef'), sourceAggregates: strings,
    noteId: optionalString, updateOnlyEvents: strings, identityScheme: optionalString,
  },
  ProjectionEventHandlerMetadata: { name: string, eventName: string, logic: p('BusinessLogic') },
  TableMetadata: { tableName: string, columns: many('ColumnMetadata'), description: string },
  ColumnMetadata: { name: string, dataType: string, isPrimaryKey: boolean },
  EsIndexMetadata: { indexName: string, numberOfShards: int, numberOfReplicas: int, description: string },
  RedisKeyMetadata: { keyPattern: string, ttlSeconds: optional(int), description: string },
  EmbeddingConfigMetadata: { model: string, endpoint: string, timeoutMs: int },
  PgVectorTableMetadata: {
    tableName: string, columns: many('ColumnMetadata'), embeddingColumn: string, dims: int,
    indexType: string, distance: string, embedding: p('EmbeddingConfigMetadata'), description: string,
  },
  Neo4jGraphMetadata: {
    nodeLabel: string, nodeKey: string, keySpace: string, nodeProps: strings,
    edgeMappings: many('GraphEdgeMappingMetadata'), description: string,
  },
  MongoDocumentMetadata: { collection: string, keyField: string, kindValue: string, description: string },
  GraphEdgeMappingMetadata: {
    edgeType: string, fromLabel: string, toLabel: string, relationKey: string,
    toKeyId: string, toKeySpace: string, description: string,
  },
  AggregateRepositoryMetadata: {
    name: string, aggregate: p('AggregateRef'), methods: repositoryMethods, storage: optional(storage),
  },
  ProjectionRepositoryMetadata: { name: string, storageConfig: storage, methods: repositoryMethods },
  UpsertMethod: { name: string, parameters: many('ParameterMetadata'), logic: p('BusinessLogic') },
  QueryMethod: { name: string, parameters: many('ParameterMetadata'), returnType: dataType, logic: p('BusinessLogic') },
  ControllerMetadata: {
    name: string, basePath: string, description: string, dependencies: list(dataType), endpoints: many('EndpointMetadata'),
  },
  EndpointMetadata: {
    method: string, path: string, actionName: string, parameters: many('ParameterMetadata'),
    requestBody: optional(dataType), responseType: dataType, logic: p('BusinessLogic'), gate: maybe('GateRef'),
    serves: maybe('ServesCommand', 'ServesUseCase', 'ServesView'), errorPayloads: many('ErrorPayloadSpec'),
  },
  FiniteDurationMetadata: { length: long, unit: string },
  SideEffect: { name: string, description: string, invokes: list(metaRef), logic: p('BusinessLogic') },
  Goto: { targetState: p('LifecycleStateRef') },
  Behavior: {
    trigger: dataType, logic: p('BusinessLogic'), yields: many('EventRef'), sideEffects: many('SideEffect'),
    transitionsTo: p('Goto', 'Stay', 'Stop'), repliesWith: optional(dataType),
  },
  LifecycleState: {
    name: string, description: string, when: many('Behavior'), onEnter: maybe('SideEffect'),
    timeout: maybe('FiniteDurationMetadata'), onTimeout: maybe('Behavior'),
  },
  LifecycleMetadata: {
    name: string, stateDataType: p('ValueObjectRef'), initialStage: p('LifecycleStateRef'), initialDataLogic: p('BusinessLogic'),
    stages: many('LifecycleState'), commandFamily: p('CommandFamilyRef'), eventFamily: p('EventFamilyRef'),
    persistenceIdPattern: string, description: string,
  },
  SystemMetadata: {
    name: string, contextName: optionalString, domain: p('DomainLayer'), application: p('ApplicationLayer'),
    infrastructure: p('InfrastructureLayer'), interfaces: p('InterfaceLayer'), storyboard: p('StoryboardMetadata'),
    externalSystems: many('ExternalSystemMetadata'), timers: many('TimerMetadata'),
  },
  DomainLayer: {
    valueObjects: many('ValueObjectMetadata'), behaviors: many('EntityBehaviorMetadata'), entities: many('DomainEntityMetadata'),
    services: many('DomainServiceMetadata'), invariants: many('InvariantRuleMetadata'), policies: many('PolicyMetadata'),
  },
  ApplicationLayer: {
    valueObjects: many('ValueObjectMetadata'), behaviors: many('AggregateBehaviorMetadata'), aggregates: many('AggregateRootMetadata'),
    services: many('ApplicationServiceMetadata'), queries: many('QueryServiceMetadata'), sagas: many('SagaTransactorMetadata'),
    repositories, lifecycles: many('LifecycleMetadata'), useCases: many('UseCaseMetadata'),
    gates: many('GateDefinition'), viewKeys: many('ViewKeyDefinition'), connectors: many('ConnectorMetadata'),
  },
  InfrastructureLayer: {
    valueObjects: many('ValueObjectMetadata'), repositories, projections: many('ProjectionMetadata'),
    connectors: many('ConnectorImplMetadata'), handwritten: many('HandwrittenInfraMetadata'),
  },
  InterfaceLayer: { valueObjects: many('ValueObjectMetadata'), controllers: many('ControllerMetadata') },
  StoryboardMetadata: { roles: many('UserRoleMetadata'), stories: many('UserStoryMetadata') },
  UserRoleMetadata: { name: string, description: string, triggers: many('CommandRef'), noteId: optionalString },
  UserStorySliceMetadata: { commands: many('CommandRef'), events: many('EventRef'), readModels: many('ProjectionRef') },
  UserStoryMetadata: {
    name: string, role: p('UserRoleRef'), goal: string, soThat: string, acceptanceCriteria: strings,
    slices: p('UserStorySliceMetadata'), noteId: optionalString,
  },
  ExternalSystemMetadata: {
    name: string, description: string, contracts: many('ExternalContractMetadata'),
    triggers: many('ExternalTriggerRef'), noteId: optionalString,
  },
  ConnectorMetadata: {
    name: string, description: string, kind: string, methods: many('ConnectorMethodMetadata'),
    entryTemplate: optionalString, timeoutMs: optional(int), noteId: optionalString,
  },
  ConnectorImplMetadata: { name: string, connectorName: string, helperNames: strings, noteId: optionalString },
  HandwrittenInfraMetadata: { name: string, description: string, noteId: optionalString },
  TimerMetadata: { name: string, description: string, triggers: many('EventRef'), noteId: optionalString },
  ImplementationConfig: {
    protoConfig: maybe('ProtoConfig'), bootstrapStrategy: maybe('NoBootstrap', 'AkkaShardingBootstrap'), diStrategy: maybe('GuiceModule'),
  },
  ProtoConfig: { fileName: string, javaPackage: optionalString, javaOuterClass: optionalString, imports: strings },
  AkkaShardingBootstrap: { shardingTagName: string, shards: int },
  TestSuiteMetadata: {
    name: string, target: dataType, description: string, cases: many('UnitTestCase', 'BehaviorTestCase'),
  },
  UnitTestCase: {
    name: string, description: string, inputs: stringMap,
    assertions: many('ReturnEquals', 'ReturnSome', 'ReturnNone', 'ReturnLeft', 'ReturnRight'),
  },
  MockReply: { whenReceived: string, replyWith: string },
  BehaviorTestCase: {
    name: string, description: string, initialState: optionalString, initialStateModifications: stringMap,
    input: string, mockBehaviors: many('MockReply'), expectedEvents: strings, expectedState: optionalString, expectedError: optionalString,
  },
  ReturnEquals: { expectedCode: string },
  ReturnSome: { innerValueCheck: string },
  ReturnLeft: { errorCode: string },
  ReturnRight: { contentCheck: optionalString },
  GateDefinition: { name: string, requiresIdentity: boolean, requiresTenant: boolean, description: string },
  GateRef: { value: string },
  ViewKeyDefinition: { name: string, repository: p('ProjectionRepositoryRef'), singleKey: boolean, description: string },
  ServesCommand: { command: string },
  ServesUseCase: { useCase: string },
  ServesView: { viewKey: string },
  ErrorPayloadSpec: { errorCode: string, payloadFields: many('Tuple2') },
  CommandStep: {
    command: string, targetAggregate: string, idSource: p('Generated', 'FromEntry', 'Context'), kind: writeKind, onFailure,
  },
  Interaction: { step: int, text: string },
  Validation: { step: int, text: string, rules: strings },
  ComposedWrite: { step: int, text: string, commands: many('CommandStep'), idempotency: optionalString, publishes: strings },
  FlowExtension: {
    atStep: int, condition: string, response: string, stateEffect: optionalString, gotoPoint: optionalString, onFailure: optional(onFailure),
  },
  UseCaseMetadata: {
    name: string, mainFlow: many('Interaction', 'Validation', 'ComposedWrite'), actors: strings,
    trigger: string, preconditions: strings, postconditions: strings, realizes: strings, extensions: many('FlowExtension'),
    generatedIds: strings, optionalInputs: strings, flowRef: optionalString, flowMethod: optionalString, flowArgs: strings,
  },
};
const metaTypeTags = Object.keys(metaSchemas);
// These are Products/wire carriers but NOT MetaType. In particular, accepting a
// constructor globally must never make it valid in every retained field.
const schemas = {
  ...metaSchemas,
  Strong: {}, Eventual: {},
  EventCausalRef: { event: p('EventRef'), consistency: p('Strong', 'Eventual') },
  ExternalTriggerRef: { event: p('EventRef'), consistency: p('Strong', 'Eventual') },
  ExternalContractMetadata: { name: string, protocol: string, sync: boolean },
  ConnectorMethodMetadata: {
    name: string, returnTypeName: string, intent: string, script: optionalString,
    scriptParam: optionalString, anchoredTo: optionalString,
  },
  Left: { value: string },
  Right: { value: p('BusinessLogic') },
  Tuple2: { _1: string, _2: string },
  Long: { value: longText },
  Double: { value: doubleText },
  // Legitimate exporter scalar tag, not a declaration or a Double. The pinned
  // constructors have no BigDecimal-valued slot; BigDecimalType is a DataType.
  BigDecimal: { value: decimalText },
};
function product(value, tags, source) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value._type !== 'string')
    mismatch('Scala Product (' + tags.join(' | ') + ')', source);
  const tag = value._type;
  if (!Object.hasOwn(schemas, tag))
    fail('CLASSIC_RETAINED_UNSUPPORTED', 'unsupported retained Scala Product: ' + tag, source);
  if (!tags.includes(tag)) mismatch(tags.join(' | ') + ', not ' + tag, source);
  const fields = schemas[tag];
  object(value, ['_type', ...Object.keys(fields)], source);
  for (const [key, validate] of Object.entries(fields)) validate(value[key], child(source, key));
}

/** Structural guard before context's recursive registry/ownership scans.
 * source identifies the SystemMetadata node (normally document + /system).
 * Does not mutate, lower, resolve links, or claim retained families are emitted.
 * Constructor fields are exact, including explicit nulls for Scala None; future
 * tags fail closed. This does not repair raw reply/optional/generator semantics.
 */
export function validateRetainedMetadata(system, source) {
  product(system, ['SystemMetadata'], source);
}
