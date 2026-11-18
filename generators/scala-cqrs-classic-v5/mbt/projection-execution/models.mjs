import { copyImmutableData } from '../../../../lib/immutable-data.mjs';

// ProjectionModel.scala: detached, immutable values. Code is confined to the
// original referenceCode/logicCode expression slots, never a whole source file.
export function ProjectionModel({
  selfType, sourceAggregate, sourceProtoEventType, repository, handlers, dependencies,
  aggregateSources = [], noteIds = [], applyEvents = [], identityScheme = null,
  sourceAggregateName = '', sourceAggregates = [], repositoryRef = null, readModelSchema = null,
  schemaFieldTypes = [], decisionSupport = [], decisionSupportTypes = [],
  updateOnlyEvents = [], multiProject = false,
}) {
  return copyImmutableData({
    selfType, sourceAggregate, sourceProtoEventType, repository, handlers, dependencies,
    aggregateSources, noteIds, applyEvents, identityScheme, sourceAggregateName,
    sourceAggregates, repositoryRef, readModelSchema, schemaFieldTypes,
    decisionSupport, decisionSupportTypes, updateOnlyEvents, multiProject,
  });
}

export function ProjectionAggregateSource(aggregate, protoEventType, handlers) {
  return copyImmutableData({ aggregate, protoEventType, handlers });
}

export function ProjectionHandlerModel({
  selfType, event, repository, logicCode, dependencies,
  eventCaseName = '', routable = true, viewName = '', concreteEventName = '',
  entityEventFqn = '', identityKeys = [], applyForm = 'create', noteIds = [],
  entityEventType = null, logic = null, sourceIndex = null, multiProject = false,
}) {
  return copyImmutableData({
    selfType, event, repository, logicCode, dependencies, eventCaseName, routable,
    viewName, concreteEventName, entityEventFqn, identityKeys, applyForm, noteIds,
    entityEventType, logic, sourceIndex, multiProject,
  });
}

// Structural custody only. There is no nonempty ApplyEvent builder or emitter
// until its separate public-main oracle is sealed. Defaults match the Scala IR.
export function ApplyEventFunction({
  eventName, eventFqn = '', applyExpr, bodyExpr = '', applyForm = 'create',
  fieldPairs, literalPairs, droppedColumns = [], deletePairs = [], viewColumns = [],
}) {
  return copyImmutableData({
    eventName, eventFqn, applyExpr, bodyExpr, applyForm, fieldPairs, literalPairs,
    droppedColumns, deletePairs, viewColumns,
  });
}
