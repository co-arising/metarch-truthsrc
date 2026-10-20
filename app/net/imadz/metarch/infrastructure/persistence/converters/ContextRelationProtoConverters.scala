package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.ContextRelationEntity.ContextRelationState
import net.imadz.metarch.domain.entities.ContextRelationEntity._
import net.imadz.metarch.infrastructure.proto._

trait ContextRelationProtoConverters extends PrimitiveConverter {

  object ContextRelationStateConv extends ProtoConverter[ContextRelationState, ContextRelationStatePO] {
    override def toProto(d: ContextRelationState): ContextRelationStatePO = ContextRelationStatePO(
      tenantId = d.tenantId,
      upstreamContextId = d.upstreamContextId,
      downstreamContextId = d.downstreamContextId,
      kind = d.kind,
      integration = d.integration,
      description = d.description,
      createdAt = d.createdAt,
      createdBy = d.createdBy
    )

    override def fromProto(p: ContextRelationStatePO): ContextRelationState = ContextRelationState(
      tenantId = p.tenantId,
      upstreamContextId = p.upstreamContextId,
      downstreamContextId = p.downstreamContextId,
      kind = p.kind,
      integration = p.integration,
      description = p.description,
      createdAt = p.createdAt,
      createdBy = p.createdBy
    )
  }


  object ContextRelationDefinedConv extends ProtoConverter[ContextRelationDefined, ContextRelationDefinedPO] {
    override def toProto(d: ContextRelationDefined): ContextRelationDefinedPO = ContextRelationDefinedPO(
      tenantId = d.tenantId,
      relationId = d.relationId,
      upstreamContextId = d.upstreamContextId,
      downstreamContextId = d.downstreamContextId,
      kind = d.kind,
      integration = d.integration,
      description = d.description,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: ContextRelationDefinedPO): ContextRelationDefined = ContextRelationDefined(
      tenantId = p.tenantId,
      relationId = p.relationId,
      upstreamContextId = p.upstreamContextId,
      downstreamContextId = p.downstreamContextId,
      kind = p.kind,
      integration = p.integration,
      description = p.description,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object ContextRelationUpdatedConv extends ProtoConverter[ContextRelationUpdated, ContextRelationUpdatedPO] {
    override def toProto(d: ContextRelationUpdated): ContextRelationUpdatedPO = ContextRelationUpdatedPO(
      relationId = d.relationId,
      kind = d.kind,
      integration = d.integration,
      description = d.description,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ContextRelationUpdatedPO): ContextRelationUpdated = ContextRelationUpdated(
      relationId = p.relationId,
      kind = p.kind,
      integration = p.integration,
      description = p.description,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
