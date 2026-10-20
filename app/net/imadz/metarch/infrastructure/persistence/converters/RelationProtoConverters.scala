package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.RelationEntity.RelationState
import net.imadz.metarch.domain.entities.RelationEntity._
import net.imadz.metarch.infrastructure.proto._

trait RelationProtoConverters extends PrimitiveConverter {

  object RelationStateConv extends ProtoConverter[RelationState, RelationStatePO] {
    override def toProto(d: RelationState): RelationStatePO = RelationStatePO(
      tenantId = d.tenantId,
      sourceId = d.sourceId,
      targetId = d.targetId,
      relationType = d.relationType,
      condition = d.condition,
      mapping = d.mapping,
      order = d.order,
      metadata = d.metadata,
      createdAt = d.createdAt,
      createdBy = d.createdBy
    )

    override def fromProto(p: RelationStatePO): RelationState = RelationState(
      tenantId = p.tenantId,
      sourceId = p.sourceId,
      targetId = p.targetId,
      relationType = p.relationType,
      condition = p.condition,
      mapping = p.mapping,
      order = p.order,
      metadata = p.metadata,
      createdAt = p.createdAt,
      createdBy = p.createdBy
    )
  }


  object RelationCreatedConv extends ProtoConverter[RelationCreated, RelationCreatedPO] {
    override def toProto(d: RelationCreated): RelationCreatedPO = RelationCreatedPO(
      edgeId = d.edgeId,
      sourceId = d.sourceId,
      targetId = d.targetId,
      relationType = d.relationType,
      condition = d.condition,
      mapping = d.mapping,
      order = d.order,
      metadata = d.metadata,
      createdAt = d.createdAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: RelationCreatedPO): RelationCreated = RelationCreated(
      edgeId = p.edgeId,
      sourceId = p.sourceId,
      targetId = p.targetId,
      relationType = p.relationType,
      condition = p.condition,
      mapping = p.mapping,
      order = p.order,
      metadata = p.metadata,
      createdAt = p.createdAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object RelationRemovedConv extends ProtoConverter[RelationRemoved, RelationRemovedPO] {
    override def toProto(d: RelationRemoved): RelationRemovedPO = RelationRemovedPO(
      edgeId = d.edgeId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: RelationRemovedPO): RelationRemoved = RelationRemoved(
      edgeId = p.edgeId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object RelationUpdatedConv extends ProtoConverter[RelationUpdated, RelationUpdatedPO] {
    override def toProto(d: RelationUpdated): RelationUpdatedPO = RelationUpdatedPO(
      edgeId = d.edgeId,
      changedFields = d.changedFields,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: RelationUpdatedPO): RelationUpdated = RelationUpdated(
      edgeId = p.edgeId,
      changedFields = p.changedFields,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
