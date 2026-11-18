import { copyImmutableData } from '../../../../lib/immutable-data.mjs';

// These are bootstrap-owned startup facts, not Scala statement strings and not
// partial patches to a global file. Full classic metadata supplies every fact.
export function SagaRegistrationStartupModel(sagaName, definitionType) {
  return copyImmutableData({ kind: 'saga-registration', sagaName, definitionType });
}

export function SagaEngineStartupModel(contextType, contextName, repositoryType, repositoryParam) {
  // contextName is the original inline constructor spelling. It deliberately
  // need not equal the resolver's normalized contextType.name.
  return copyImmutableData({ kind: 'saga-engine', contextType, contextName, repositoryType, repositoryParam });
}

export function AggregateStartupModel(aggregateName, methodName, aggregateType) {
  return copyImmutableData({ kind: 'aggregate', aggregateName, methodName, aggregateType });
}

export function ProjectionStartupModel(projectionName, methodName, projectionType, repositoryType, repositoryParam) {
  return copyImmutableData({ kind: 'projection', projectionName, methodName, projectionType, repositoryType, repositoryParam });
}
