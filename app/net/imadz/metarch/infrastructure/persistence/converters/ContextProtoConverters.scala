package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.ContextEntity.ContextState
import net.imadz.metarch.domain.entities.ContextEntity._
import net.imadz.metarch.infrastructure.proto._

trait ContextProtoConverters extends PrimitiveConverter {

  object ContextStateConv extends ProtoConverter[ContextState, ContextStatePO] {
    override def toProto(d: ContextState): ContextStatePO = ContextStatePO(
      tenantId = d.tenantId,
      name = d.name,
      description = d.description,
      subdomainIds = d.subdomainIds,
      discoveredAt = d.discoveredAt,
      discoveredBy = d.discoveredBy
    )

    override def fromProto(p: ContextStatePO): ContextState = ContextState(
      tenantId = p.tenantId,
      name = p.name,
      description = p.description,
      subdomainIds = p.subdomainIds,
      discoveredAt = p.discoveredAt,
      discoveredBy = p.discoveredBy
    )
  }


  object ContextDiscoveredConv extends ProtoConverter[ContextDiscovered, ContextDiscoveredPO] {
    override def toProto(d: ContextDiscovered): ContextDiscoveredPO = ContextDiscoveredPO(
      tenantId = d.tenantId,
      contextId = d.contextId,
      name = d.name,
      description = d.description,
      subdomainIds = d.subdomainIds,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: ContextDiscoveredPO): ContextDiscovered = ContextDiscovered(
      tenantId = p.tenantId,
      contextId = p.contextId,
      name = p.name,
      description = p.description,
      subdomainIds = p.subdomainIds,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object ContextScopeUpdatedConv extends ProtoConverter[ContextScopeUpdated, ContextScopeUpdatedPO] {
    override def toProto(d: ContextScopeUpdated): ContextScopeUpdatedPO = ContextScopeUpdatedPO(
      contextId = d.contextId,
      subdomainIds = d.subdomainIds,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: ContextScopeUpdatedPO): ContextScopeUpdated = ContextScopeUpdated(
      contextId = p.contextId,
      subdomainIds = p.subdomainIds,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
