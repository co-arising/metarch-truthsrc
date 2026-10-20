package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.CemEdgeEntity.CemEdgeState
import net.imadz.metarch.domain.entities.CemEdgeEntity._
import net.imadz.metarch.infrastructure.proto._

trait CemEdgeProtoConverters extends PrimitiveConverter {

  object CemEdgeStateConv extends ProtoConverter[CemEdgeState, CemEdgeStatePO] {
    override def toProto(d: CemEdgeState): CemEdgeStatePO = CemEdgeStatePO(
      tenantId = d.tenantId,
      commandName = d.commandName,
      eventName = d.eventName,
      aggregateName = d.aggregateName,
      sources = d.sources,
      confidence = d.confidence,
      status = d.status,
      declaredAt = d.declaredAt,
      declaredBy = d.declaredBy,
      retiredAt = d.retiredAt,
      retiredReason = d.retiredReason
    )

    override def fromProto(p: CemEdgeStatePO): CemEdgeState = CemEdgeState(
      tenantId = p.tenantId,
      commandName = p.commandName,
      eventName = p.eventName,
      aggregateName = p.aggregateName,
      sources = p.sources,
      confidence = p.confidence,
      status = p.status,
      declaredAt = p.declaredAt,
      declaredBy = p.declaredBy,
      retiredAt = p.retiredAt,
      retiredReason = p.retiredReason
    )
  }


  object EdgeDeclaredConv extends ProtoConverter[EdgeDeclared, EdgeDeclaredPO] {
    override def toProto(d: EdgeDeclared): EdgeDeclaredPO = EdgeDeclaredPO(
      edgeId = d.edgeId,
      commandName = d.commandName,
      eventName = d.eventName,
      aggregateName = d.aggregateName,
      sources = d.sources,
      confidence = d.confidence,
      declaredBy = d.declaredBy,
      tenantId = d.tenantId,
      declaredAt = d.declaredAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: EdgeDeclaredPO): EdgeDeclared = EdgeDeclared(
      edgeId = p.edgeId,
      commandName = p.commandName,
      eventName = p.eventName,
      aggregateName = p.aggregateName,
      sources = p.sources,
      confidence = p.confidence,
      declaredBy = p.declaredBy,
      tenantId = p.tenantId,
      declaredAt = p.declaredAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object EdgePatchedConv extends ProtoConverter[EdgePatched, EdgePatchedPO] {
    override def toProto(d: EdgePatched): EdgePatchedPO = EdgePatchedPO(
      edgeId = d.edgeId,
      aggregateName = d.aggregateName,
      sources = d.sources,
      confidence = d.confidence,
      changedFields = d.changedFields,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: EdgePatchedPO): EdgePatched = EdgePatched(
      edgeId = p.edgeId,
      aggregateName = p.aggregateName,
      sources = p.sources,
      confidence = p.confidence,
      changedFields = p.changedFields,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object EdgeRetiredConv extends ProtoConverter[EdgeRetired, EdgeRetiredPO] {
    override def toProto(d: EdgeRetired): EdgeRetiredPO = EdgeRetiredPO(
      edgeId = d.edgeId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      retiredAt = d.retiredAt,
      timestamp = d.timestamp
    )

    override def fromProto(p: EdgeRetiredPO): EdgeRetired = EdgeRetired(
      edgeId = p.edgeId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      retiredAt = p.retiredAt,
      timestamp = p.timestamp
    )
  }

}
