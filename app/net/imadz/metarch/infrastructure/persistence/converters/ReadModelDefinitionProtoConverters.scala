package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.ReadModelDefinitionEntity.ReadModelDefinitionState
import net.imadz.metarch.domain.entities.ReadModelDefinitionEntity._
import net.imadz.metarch.infrastructure.proto._

trait ReadModelDefinitionProtoConverters extends PrimitiveConverter {

  object ReadModelDefinitionStateConv extends ProtoConverter[ReadModelDefinitionState, ReadModelDefinitionStatePO] {
    override def toProto(d: ReadModelDefinitionState): ReadModelDefinitionStatePO = ReadModelDefinitionStatePO(
      tenantId = d.tenantId,
      viewName = d.viewName,
      parentAggregate = d.parentAggregate,
      viewId = d.viewId,
      sourceAggregates = d.sourceAggregates,
      consumesEvents = d.consumesEvents,
      linkedStories = d.linkedStories,
      description = d.description,
      fields = d.fields,
      decisionCommands = d.decisionCommands,
      declaredAt = d.declaredAt,
      declaredBy = d.declaredBy,
      removedAt = d.removedAt,
      removedBy = d.removedBy
    )

    override def fromProto(p: ReadModelDefinitionStatePO): ReadModelDefinitionState = ReadModelDefinitionState(
      tenantId = p.tenantId,
      viewName = p.viewName,
      parentAggregate = p.parentAggregate,
      viewId = p.viewId,
      sourceAggregates = p.sourceAggregates,
      consumesEvents = p.consumesEvents,
      linkedStories = p.linkedStories,
      description = p.description,
      fields = p.fields,
      decisionCommands = p.decisionCommands,
      declaredAt = p.declaredAt,
      declaredBy = p.declaredBy,
      removedAt = p.removedAt,
      removedBy = p.removedBy
    )
  }


  object ReadModelDeclaredConv extends ProtoConverter[ReadModelDeclared, ReadModelDeclaredPO] {
    override def toProto(d: ReadModelDeclared): ReadModelDeclaredPO = ReadModelDeclaredPO(
      definitionId = d.definitionId,
      viewName = d.viewName,
      parentAggregate = d.parentAggregate,
      viewId = d.viewId,
      sourceAggregates = d.sourceAggregates,
      consumesEvents = d.consumesEvents,
      linkedStories = d.linkedStories,
      description = d.description,
      fields = d.fields,
      decisionCommands = d.decisionCommands,
      declaredBy = d.declaredBy,
      tenantId = d.tenantId,
      declaredAt = d.declaredAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: ReadModelDeclaredPO): ReadModelDeclared = ReadModelDeclared(
      definitionId = p.definitionId,
      viewName = p.viewName,
      parentAggregate = p.parentAggregate,
      viewId = p.viewId,
      sourceAggregates = p.sourceAggregates,
      consumesEvents = p.consumesEvents,
      linkedStories = p.linkedStories,
      description = p.description,
      fields = p.fields,
      decisionCommands = p.decisionCommands,
      declaredBy = p.declaredBy,
      tenantId = p.tenantId,
      declaredAt = p.declaredAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object ReadModelFieldPatchedConv extends ProtoConverter[ReadModelFieldPatched, ReadModelFieldPatchedPO] {
    override def toProto(d: ReadModelFieldPatched): ReadModelFieldPatchedPO = ReadModelFieldPatchedPO(
      definitionId = d.definitionId,
      changedFields = d.changedFields,
      fieldSpec = d.fieldSpec,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: ReadModelFieldPatchedPO): ReadModelFieldPatched = ReadModelFieldPatched(
      definitionId = p.definitionId,
      changedFields = p.changedFields,
      fieldSpec = p.fieldSpec,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object ReadModelRemovedConv extends ProtoConverter[ReadModelRemoved, ReadModelRemovedPO] {
    override def toProto(d: ReadModelRemoved): ReadModelRemovedPO = ReadModelRemovedPO(
      definitionId = d.definitionId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ReadModelRemovedPO): ReadModelRemoved = ReadModelRemoved(
      definitionId = p.definitionId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
