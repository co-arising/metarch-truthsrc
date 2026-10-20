package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.FieldModelDefinitionEntity.FieldModelDefinitionState
import net.imadz.metarch.domain.entities.FieldModelDefinitionEntity._
import net.imadz.metarch.infrastructure.proto._

trait FieldModelDefinitionProtoConverters extends PrimitiveConverter {

  object FieldModelDefinitionStateConv extends ProtoConverter[FieldModelDefinitionState, FieldModelDefinitionStatePO] {
    override def toProto(d: FieldModelDefinitionState): FieldModelDefinitionStatePO = FieldModelDefinitionStatePO(
      tenantId = d.tenantId,
      aggregateName = d.aggregateName,
      entityName = d.entityName,
      description = d.description,
      identifierName = d.identifierName,
      identifierType = d.identifierType,
      identifierOrigin = d.identifierOrigin,
      identifierDescription = d.identifierDescription,
      tenantScoped = d.tenantScoped,
      statusEnumValues = d.statusEnumValues,
      statusTransitions = d.statusTransitions,
      stateFields = d.stateFields,
      commands = d.commands,
      events = d.events,
      relations = d.relations,
      stateGates = d.stateGates,
      declaredAt = d.declaredAt,
      declaredBy = d.declaredBy,
      terminalStates = d.terminalStates,
      removedAt = d.removedAt,
      aggregateRuleRefs = d.aggregateRuleRefs
    )

    override def fromProto(p: FieldModelDefinitionStatePO): FieldModelDefinitionState = FieldModelDefinitionState(
      tenantId = p.tenantId,
      aggregateName = p.aggregateName,
      entityName = p.entityName,
      description = p.description,
      identifierName = p.identifierName,
      identifierType = p.identifierType,
      identifierOrigin = p.identifierOrigin,
      identifierDescription = p.identifierDescription,
      tenantScoped = p.tenantScoped,
      statusEnumValues = p.statusEnumValues,
      statusTransitions = p.statusTransitions,
      stateFields = p.stateFields,
      commands = p.commands,
      events = p.events,
      relations = p.relations,
      stateGates = p.stateGates,
      declaredAt = p.declaredAt,
      declaredBy = p.declaredBy,
      terminalStates = p.terminalStates,
      removedAt = p.removedAt,
      aggregateRuleRefs = p.aggregateRuleRefs
    )
  }


  object FieldModelDeclaredConv extends ProtoConverter[FieldModelDeclared, FieldModelDeclaredPO] {
    override def toProto(d: FieldModelDeclared): FieldModelDeclaredPO = FieldModelDeclaredPO(
      definitionId = d.definitionId,
      aggregateName = d.aggregateName,
      entityName = d.entityName,
      description = d.description,
      identifierName = d.identifierName,
      identifierType = d.identifierType,
      identifierOrigin = d.identifierOrigin,
      identifierDescription = d.identifierDescription,
      tenantScoped = d.tenantScoped,
      declaredBy = d.declaredBy,
      tenantId = d.tenantId,
      declaredAt = d.declaredAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      aggregateRuleRefs = d.aggregateRuleRefs
    )

    override def fromProto(p: FieldModelDeclaredPO): FieldModelDeclared = FieldModelDeclared(
      definitionId = p.definitionId,
      aggregateName = p.aggregateName,
      entityName = p.entityName,
      description = p.description,
      identifierName = p.identifierName,
      identifierType = p.identifierType,
      identifierOrigin = p.identifierOrigin,
      identifierDescription = p.identifierDescription,
      tenantScoped = p.tenantScoped,
      declaredBy = p.declaredBy,
      tenantId = p.tenantId,
      declaredAt = p.declaredAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      aggregateRuleRefs = p.aggregateRuleRefs
    )
  }


  object StateFieldDeclaredConv extends ProtoConverter[StateFieldDeclared, StateFieldDeclaredPO] {
    override def toProto(d: StateFieldDeclared): StateFieldDeclaredPO = StateFieldDeclaredPO(
      definitionId = d.definitionId,
      fieldSpec = d.fieldSpec,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: StateFieldDeclaredPO): StateFieldDeclared = StateFieldDeclared(
      definitionId = p.definitionId,
      fieldSpec = p.fieldSpec,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object WrittenByAddedConv extends ProtoConverter[WrittenByAdded, WrittenByAddedPO] {
    override def toProto(d: WrittenByAdded): WrittenByAddedPO = WrittenByAddedPO(
      definitionId = d.definitionId,
      fieldName = d.fieldName,
      writtenBy = d.writtenBy,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: WrittenByAddedPO): WrittenByAdded = WrittenByAdded(
      definitionId = p.definitionId,
      fieldName = p.fieldName,
      writtenBy = p.writtenBy,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object WrittenByReplacedConv extends ProtoConverter[WrittenByReplaced, WrittenByReplacedPO] {
    override def toProto(d: WrittenByReplaced): WrittenByReplacedPO = WrittenByReplacedPO(
      definitionId = d.definitionId,
      fieldName = d.fieldName,
      writtenBy = d.writtenBy,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: WrittenByReplacedPO): WrittenByReplaced = WrittenByReplaced(
      definitionId = p.definitionId,
      fieldName = p.fieldName,
      writtenBy = p.writtenBy,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object WrittenByCutConv extends ProtoConverter[WrittenByCut, WrittenByCutPO] {
    override def toProto(d: WrittenByCut): WrittenByCutPO = WrittenByCutPO(
      definitionId = d.definitionId,
      fieldName = d.fieldName,
      writtenBy = d.writtenBy,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: WrittenByCutPO): WrittenByCut = WrittenByCut(
      definitionId = p.definitionId,
      fieldName = p.fieldName,
      writtenBy = p.writtenBy,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object CommandDeclaredConv extends ProtoConverter[CommandDeclared, CommandDeclaredPO] {
    override def toProto(d: CommandDeclared): CommandDeclaredPO = CommandDeclaredPO(
      definitionId = d.definitionId,
      commandSpec = d.commandSpec,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: CommandDeclaredPO): CommandDeclared = CommandDeclared(
      definitionId = p.definitionId,
      commandSpec = p.commandSpec,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object CommandParameterAddedConv extends ProtoConverter[CommandParameterAdded, CommandParameterAddedPO] {
    override def toProto(d: CommandParameterAdded): CommandParameterAddedPO = CommandParameterAddedPO(
      definitionId = d.definitionId,
      commandName = d.commandName,
      paramSpec = d.paramSpec,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: CommandParameterAddedPO): CommandParameterAdded = CommandParameterAdded(
      definitionId = p.definitionId,
      commandName = p.commandName,
      paramSpec = p.paramSpec,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object EventDeclaredConv extends ProtoConverter[EventDeclared, EventDeclaredPO] {
    override def toProto(d: EventDeclared): EventDeclaredPO = EventDeclaredPO(
      definitionId = d.definitionId,
      eventSpec = d.eventSpec,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: EventDeclaredPO): EventDeclared = EventDeclared(
      definitionId = p.definitionId,
      eventSpec = p.eventSpec,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object EventPayloadAddedConv extends ProtoConverter[EventPayloadAdded, EventPayloadAddedPO] {
    override def toProto(d: EventPayloadAdded): EventPayloadAddedPO = EventPayloadAddedPO(
      definitionId = d.definitionId,
      eventName = d.eventName,
      payloadSpec = d.payloadSpec,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: EventPayloadAddedPO): EventPayloadAdded = EventPayloadAdded(
      definitionId = p.definitionId,
      eventName = p.eventName,
      payloadSpec = p.payloadSpec,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object AggregateStatusPatchedConv extends ProtoConverter[AggregateStatusPatched, AggregateStatusPatchedPO] {
    override def toProto(d: AggregateStatusPatched): AggregateStatusPatchedPO = AggregateStatusPatchedPO(
      definitionId = d.definitionId,
      statusEnumValues = d.statusEnumValues,
      statusTransitions = d.statusTransitions,
      changedFields = d.changedFields,
      terminalStates = d.terminalStates,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: AggregateStatusPatchedPO): AggregateStatusPatched = AggregateStatusPatched(
      definitionId = p.definitionId,
      statusEnumValues = p.statusEnumValues,
      statusTransitions = p.statusTransitions,
      changedFields = p.changedFields,
      terminalStates = p.terminalStates,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object RelationDeclaredConv extends ProtoConverter[RelationDeclared, RelationDeclaredPO] {
    override def toProto(d: RelationDeclared): RelationDeclaredPO = RelationDeclaredPO(
      definitionId = d.definitionId,
      relationSpec = d.relationSpec,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: RelationDeclaredPO): RelationDeclared = RelationDeclared(
      definitionId = p.definitionId,
      relationSpec = p.relationSpec,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object StateGateDeclaredConv extends ProtoConverter[StateGateDeclared, StateGateDeclaredPO] {
    override def toProto(d: StateGateDeclared): StateGateDeclaredPO = StateGateDeclaredPO(
      definitionId = d.definitionId,
      gateSpec = d.gateSpec,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: StateGateDeclaredPO): StateGateDeclared = StateGateDeclared(
      definitionId = p.definitionId,
      gateSpec = p.gateSpec,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object DescriptionRenamedConv extends ProtoConverter[DescriptionRenamed, DescriptionRenamedPO] {
    override def toProto(d: DescriptionRenamed): DescriptionRenamedPO = DescriptionRenamedPO(
      definitionId = d.definitionId,
      description = d.description,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: DescriptionRenamedPO): DescriptionRenamed = DescriptionRenamed(
      definitionId = p.definitionId,
      description = p.description,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object StateFieldRemovedConv extends ProtoConverter[StateFieldRemoved, StateFieldRemovedPO] {
    override def toProto(d: StateFieldRemoved): StateFieldRemovedPO = StateFieldRemovedPO(
      definitionId = d.definitionId,
      fieldName = d.fieldName,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: StateFieldRemovedPO): StateFieldRemoved = StateFieldRemoved(
      definitionId = p.definitionId,
      fieldName = p.fieldName,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object CommandRemovedConv extends ProtoConverter[CommandRemoved, CommandRemovedPO] {
    override def toProto(d: CommandRemoved): CommandRemovedPO = CommandRemovedPO(
      definitionId = d.definitionId,
      commandName = d.commandName,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: CommandRemovedPO): CommandRemoved = CommandRemoved(
      definitionId = p.definitionId,
      commandName = p.commandName,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object EventRemovedConv extends ProtoConverter[EventRemoved, EventRemovedPO] {
    override def toProto(d: EventRemoved): EventRemovedPO = EventRemovedPO(
      definitionId = d.definitionId,
      eventName = d.eventName,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: EventRemovedPO): EventRemoved = EventRemoved(
      definitionId = p.definitionId,
      eventName = p.eventName,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object AggregateRelationRemovedConv extends ProtoConverter[AggregateRelationRemoved, AggregateRelationRemovedPO] {
    override def toProto(d: AggregateRelationRemoved): AggregateRelationRemovedPO = AggregateRelationRemovedPO(
      definitionId = d.definitionId,
      toAggregate = d.toAggregate,
      foreignKey = d.foreignKey,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: AggregateRelationRemovedPO): AggregateRelationRemoved = AggregateRelationRemoved(
      definitionId = p.definitionId,
      toAggregate = p.toAggregate,
      foreignKey = p.foreignKey,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object StateGateRemovedConv extends ProtoConverter[StateGateRemoved, StateGateRemovedPO] {
    override def toProto(d: StateGateRemoved): StateGateRemovedPO = StateGateRemovedPO(
      definitionId = d.definitionId,
      commandName = d.commandName,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: StateGateRemovedPO): StateGateRemoved = StateGateRemoved(
      definitionId = p.definitionId,
      commandName = p.commandName,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object FieldModelRemovedConv extends ProtoConverter[FieldModelRemoved, FieldModelRemovedPO] {
    override def toProto(d: FieldModelRemoved): FieldModelRemovedPO = FieldModelRemovedPO(
      definitionId = d.definitionId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: FieldModelRemovedPO): FieldModelRemoved = FieldModelRemoved(
      definitionId = p.definitionId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
