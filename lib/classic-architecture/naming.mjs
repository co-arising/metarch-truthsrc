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

export const aggregateRootName = base => `${base}Aggregate`;
export const aggregateBehaviorName = base => `${base}Behaviors`;
export const domainEntityName = base => `${base}Entity`;
export const domainValueObjectName = base => base;
export const invariantRuleName = base => `${base}Rule`;
export const domainServiceName = base => `${base}DomainService`;
export const queryServiceName = base => `${base}Query`;
export const aggregateRepositoryInterfaceName = base => `${base}Repository`;
export const commandHelperName = command => `${command}Helper`;
export const getAggregateBaseName = name => removeSuffix(name, 'Aggregate');
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

export const conventions = Object.freeze({
  removeSuffix, firstLower, firstUpper, getBaseName, aggregateRootName,
  aggregateBehaviorName, domainEntityName, domainValueObjectName, invariantRuleName,
  domainServiceName, queryServiceName, aggregateRepositoryInterfaceName,
  commandHelperName, getAggregateBaseName, getSagaBaseName,
  getSagaTransactionStateName, getCommandHelperNameFromAggregateName,
  getEntityNameFromStateName, getEventNameFromEntityName,
  getEventHandlerNameFromEntityName, scalaIdentifier,
});
