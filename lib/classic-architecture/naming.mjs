import { ProductError } from '../products/request.mjs';

// Only naming operations used by the classic four-family slice and its type
// dependencies. Keep the pinned NamingConventions.scala quirks, not curated
// names: this is one ordered pass, and Rule/Protocol are NOT stripped.
const suffixes = Object.freeze([
  'Aggregate', 'Controller', 'Entity', 'DomainService', 'Service', 'Factory',
  'Behavior', 'Behaviors', 'RepositoryImpl', 'Policy', 'Handler', 'Adapter',
  'Converter', 'Strategy', 'Bootstrap', 'SagaTransactionRepository',
  'SagaTransactor', 'SagaTransaction', 'Repository', 'Query', 'Participant',
  'Participant', 'Event', 'State', 'Context',
]);

export const removeSuffix = (name, suffix) => name.endsWith(suffix)
  ? name.slice(0, name.length - suffix.length) : name;
function firstCase(name, upper) {
  if (typeof name !== 'string') throw new ProductError('CLASSIC_NAME', 'classic name must be a string');
  if (!name.length) return name;
  // This profile admits ASCII identifiers (compileClassicArchitecture.name).
  // JS full-string Unicode casing is not Java/Scala Char casing, nor is Node's
  // Unicode version pinned to JDK 11. Fail outside this admitted case-conversion
  // surface rather than expand İ/ß or invent a partial Unicode parity table.
  if (name.charCodeAt(0) > 0x7f)
    throw new ProductError('CLASSIC_NAME_UNSUPPORTED', 'non-ASCII first-character casing is not admitted by the classic profile');
  const initial = upper ? name[0].toUpperCase() : name[0].toLowerCase();
  return initial + name.slice(1);
}
export const firstLower = name => firstCase(name, false);
export const firstUpper = name => firstCase(name, true);

export function getBaseName(name) {
  let current = name;
  let lastNonEmpty = name;
  for (const suffix of suffixes) {
    const next = removeSuffix(current, suffix);
    if (!next.length) return lastNonEmpty;
    lastNonEmpty = next;
    current = next;
  }
  return current;
}

export const applicationServiceName = base => `${base}Service`;
export const controllerName = base => `${base}Controller`;
export const connectorImplName = name => `${name}Impl`;
export const projectionName = base => `${base}Projection`;
export const projectionHandlerName = base => `${base}Handler`;
export const projectionRepositoryInterfaceName = base => `${base}Repository`;
export const projectionRepositoryImplName = base => `${base}RepositoryImpl`;
export const sagaTransactorName = base => `${base}SagaTransactor`;
export const sagaParticipantName = base => `${base}Participant`;
export const sagaTransactionRepositoryName = base => `${base}SagaTransactionRepository`;
export const sagaTransactionRepositoryImplName = base => `${base}SagaTransactionRepositoryImpl`;
export const bootstrapName = base => `${base}Bootstrap`;
export const eventAdapterName = base => `${base}EventAdapter`;
export const snapshotAdapterName = base => `${base}SnapshotAdapter`;
export const converterName = base => `${base}ProtoConverters`;
export const converterTraitName = base => `${base}Converter`;
export const getSagaContextName = name => `${getSagaBaseName(name)}Context`;
export const getSagaTransactionEntityName = name => `${getSagaBaseName(name)}TransactionEntity`;
export const getSagaTransactionEventName = name => `${getSagaBaseName(name)}TransactionEvent`;
export const getProtoEventPOName = name => `${getBaseName(name)}EventPO`;
export const getProtoEventFamilyName = name => `${getProtoEventPOName(name)}.Event`;
export const getProtoStatePOName = name => `${getAggregateBaseName(name)}StatePO`;
export const getProtoValueObjectPOName = name => `${name}PO`;
export const getProtoEventItemPOName = name => `${name}PO`;
export const getProtoOneOfCaseName = name => name.split(/[-_]/u)
  .filter(segment => segment.length > 0).map(firstUpper).join('');
export const getConverterObjectName = name => `${name}Conv`;
export const getBootstrapNameFromProjectionName = name => `${removeSuffix(name, 'Projection')}Bootstrap`;
export const getProjectionInitMethodName = name => `init${removeSuffix(name, 'Projection')}Projection`;
export const getAggregateInitMethodNameFromAggregateName = name => `init${name}`;
export const getSagaInitMethodNameFromSagaName = name => `init${name}`;
export function toSnakeCase(name) {
  if (typeof name !== 'string') throw new ProductError('CLASSIC_NAME', 'classic name must be a string');
  if (!name.length) return name;
  if (!/^[\x00-\x7f]*$/u.test(name)) throw new ProductError('CLASSIC_NAME_UNSUPPORTED', 'non-ASCII snake casing is not admitted');
  return name[0].toLowerCase() + name.slice(1).replace(/[A-Z]/gu, char => '_' + char.toLowerCase());
}
export const getProtoFileName = name => toSnakeCase(getAggregateBaseName(name)) + '.proto';
export const getAggregateShardingTag = (name, index) => `${toSnakeCase(getAggregateBaseName(name))}${index}`;
export const getSagaShardingTag = index => `SagaTransactionCoordinator-${index}`;

export const aggregateRootName = base => `${base}Aggregate`;
export const aggregateFactoryName = base => `${base}AggregateFactory`;
export const aggregateBehaviorName = base => `${base}Behaviors`;
export const domainEntityName = base => `${base}Entity`;
export const domainValueObjectName = base => base;
export const invariantRuleName = base => `${base}Rule`;
export const domainServiceName = base => `${base}DomainService`;
export const queryServiceName = base => `${base}Query`;
export const aggregateRepositoryInterfaceName = base => `${base}Repository`;
export const aggregateRepositoryImplName = base => `${base}RepositoryImpl`;
export const getRepositoryImplNameFromInterfaceName = name => `${name}Impl`;
export const entityTypeKeyName = base => `${base}EntityTypeKey`;
export const commandHelperName = command => `${command}Helper`;
export const getAggregateBaseName = name => removeSuffix(name, 'Aggregate');
export const getFactoryNameFromAggregateName = name => aggregateFactoryName(getAggregateBaseName(name));
export const getSagaBaseName = name => removeSuffix(name, 'SagaTransactor');
export const getSagaTransactionStateName = name => `${getSagaBaseName(name)}TransactionState`;
export const getCommandHelperNameFromAggregateName = name => `${getAggregateBaseName(name)}CommandHelpers`;
export const getEntityNameFromStateName = name => domainEntityName(removeSuffix(removeSuffix(name, 'State'), 'Entity'));
export const getEventNameFromEntityName = name => `${removeSuffix(name, 'Entity')}Event`;
export const getEventHandlerNameFromEntityName = name => `${getEventNameFromEntityName(name)}Handler`;

const scalaKeywords = new Set([
  'type', 'object', 'class', 'trait', 'def', 'val', 'var', 'for', 'while', 'if', 'else',
  'match', 'case', 'import', 'package', 'extends', 'with', 'new', 'return', 'throw',
  'try', 'catch', 'finally', 'null', 'true', 'false', 'this', 'super', 'sealed',
  'implicit', 'lazy', 'override', 'private', 'protected', 'abstract', 'final', 'yield', 'do',
]);
export const scalaIdentifier = name => scalaKeywords.has(name) ? `\`${name}\`` : name;

const apiKeywords = new Set(['type', 'class', 'def', 'val', 'var', 'object', 'trait', 'package', 'import',
  'case', 'match', 'else', 'then', 'yield', 'while', 'return', 'throw', 'new', 'extends', 'with', 'final',
  'sealed', 'abstract', 'lazy', 'override', 'implicit', 'private', 'protected', 'this', 'super', 'try',
  'catch', 'finally', 'for', 'do']);
export const classicApiScalaId = name => apiKeywords.has(name) ? `\`${name}\`` : name;
export const classicApiNaming = Object.freeze({
  scalaId: classicApiScalaId,
  cidNameOf(name) { const base = name.replace(/[iI]d$/u, ''); return (base || name) + 'Cid'; },
  instantBindOf: name => (apiKeywords.has(name) ? name + 'Param' : name) + 'Instant',
  pascalCaseOf: code => code.split('_').filter(Boolean).map(part => firstUpper(part.toLowerCase())).join(''),
  viewConstName: key => key.split('-').filter(Boolean).map(firstUpper).join(''),
});

export const conventions = Object.freeze({
  removeSuffix, firstLower, firstUpper, getBaseName, aggregateRootName, aggregateFactoryName,
  aggregateBehaviorName, domainEntityName, domainValueObjectName, invariantRuleName,
  domainServiceName, queryServiceName, aggregateRepositoryInterfaceName, aggregateRepositoryImplName,
  getRepositoryImplNameFromInterfaceName, entityTypeKeyName,
  commandHelperName, getAggregateBaseName, getFactoryNameFromAggregateName, getSagaBaseName,
  getSagaTransactionStateName, getCommandHelperNameFromAggregateName,
  getEntityNameFromStateName, getEventNameFromEntityName,
  getEventHandlerNameFromEntityName, scalaIdentifier,
  applicationServiceName, controllerName, connectorImplName,
  projectionName, projectionHandlerName, projectionRepositoryInterfaceName, projectionRepositoryImplName,
  sagaTransactorName, sagaParticipantName, sagaTransactionRepositoryName, sagaTransactionRepositoryImplName,
  bootstrapName, eventAdapterName, snapshotAdapterName, converterName, converterTraitName,
  getSagaContextName, getSagaTransactionEntityName, getSagaTransactionEventName,
  getProtoEventPOName, getProtoEventFamilyName, getProtoStatePOName, getProtoValueObjectPOName,
  getProtoEventItemPOName, getProtoOneOfCaseName, getConverterObjectName, getBootstrapNameFromProjectionName,
  getProjectionInitMethodName, getAggregateInitMethodNameFromAggregateName, getSagaInitMethodNameFromSagaName,
  toSnakeCase, getProtoFileName, getAggregateShardingTag, getSagaShardingTag,
});
