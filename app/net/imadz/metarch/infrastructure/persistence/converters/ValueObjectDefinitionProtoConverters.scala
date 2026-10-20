package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.ValueObjectDefinitionEntity.ValueObjectDefinitionState
import net.imadz.metarch.domain.entities.ValueObjectDefinitionEntity._
import net.imadz.metarch.infrastructure.proto._

trait ValueObjectDefinitionProtoConverters extends PrimitiveConverter {

  object ValueObjectDefinitionStateConv extends ProtoConverter[ValueObjectDefinitionState, ValueObjectDefinitionStatePO] {
    override def toProto(d: ValueObjectDefinitionState): ValueObjectDefinitionStatePO = ValueObjectDefinitionStatePO(
      tenantId = d.tenantId,
      voName = d.voName,
      members = d.members,
      declaredAt = d.declaredAt,
      declaredBy = d.declaredBy,
      removedAt = d.removedAt,
      removedBy = d.removedBy
    )

    override def fromProto(p: ValueObjectDefinitionStatePO): ValueObjectDefinitionState = ValueObjectDefinitionState(
      tenantId = p.tenantId,
      voName = p.voName,
      members = p.members,
      declaredAt = p.declaredAt,
      declaredBy = p.declaredBy,
      removedAt = p.removedAt,
      removedBy = p.removedBy
    )
  }


  object ValueObjectDeclaredConv extends ProtoConverter[ValueObjectDeclared, ValueObjectDeclaredPO] {
    override def toProto(d: ValueObjectDeclared): ValueObjectDeclaredPO = ValueObjectDeclaredPO(
      definitionId = d.definitionId,
      voName = d.voName,
      members = d.members,
      declaredBy = d.declaredBy,
      tenantId = d.tenantId,
      declaredAt = d.declaredAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: ValueObjectDeclaredPO): ValueObjectDeclared = ValueObjectDeclared(
      definitionId = p.definitionId,
      voName = p.voName,
      members = p.members,
      declaredBy = p.declaredBy,
      tenantId = p.tenantId,
      declaredAt = p.declaredAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object ValueObjectRemovedConv extends ProtoConverter[ValueObjectRemoved, ValueObjectRemovedPO] {
    override def toProto(d: ValueObjectRemoved): ValueObjectRemovedPO = ValueObjectRemovedPO(
      definitionId = d.definitionId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ValueObjectRemovedPO): ValueObjectRemoved = ValueObjectRemoved(
      definitionId = p.definitionId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
