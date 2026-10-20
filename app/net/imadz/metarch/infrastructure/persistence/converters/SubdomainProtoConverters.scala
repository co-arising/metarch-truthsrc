package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.SubdomainEntity.SubdomainState
import net.imadz.metarch.domain.entities.SubdomainEntity._
import net.imadz.metarch.infrastructure.proto._

trait SubdomainProtoConverters extends PrimitiveConverter {

  object SubdomainStateConv extends ProtoConverter[SubdomainState, SubdomainStatePO] {
    override def toProto(d: SubdomainState): SubdomainStatePO = SubdomainStatePO(
      tenantId = d.tenantId,
      name = d.name,
      description = d.description,
      kind = d.kind,
      buyOrBuild = d.buyOrBuild,
      aggregateIds = d.aggregateIds,
      classifiedAt = d.classifiedAt,
      classifiedBy = d.classifiedBy
    )

    override def fromProto(p: SubdomainStatePO): SubdomainState = SubdomainState(
      tenantId = p.tenantId,
      name = p.name,
      description = p.description,
      kind = p.kind,
      buyOrBuild = p.buyOrBuild,
      aggregateIds = p.aggregateIds,
      classifiedAt = p.classifiedAt,
      classifiedBy = p.classifiedBy
    )
  }


  object SubdomainClassifiedConv extends ProtoConverter[SubdomainClassified, SubdomainClassifiedPO] {
    override def toProto(d: SubdomainClassified): SubdomainClassifiedPO = SubdomainClassifiedPO(
      tenantId = d.tenantId,
      subdomainId = d.subdomainId,
      name = d.name,
      description = d.description,
      kind = d.kind,
      buyOrBuild = d.buyOrBuild,
      aggregateIds = d.aggregateIds,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: SubdomainClassifiedPO): SubdomainClassified = SubdomainClassified(
      tenantId = p.tenantId,
      subdomainId = p.subdomainId,
      name = p.name,
      description = p.description,
      kind = p.kind,
      buyOrBuild = p.buyOrBuild,
      aggregateIds = p.aggregateIds,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object SubdomainKindUpdatedConv extends ProtoConverter[SubdomainKindUpdated, SubdomainKindUpdatedPO] {
    override def toProto(d: SubdomainKindUpdated): SubdomainKindUpdatedPO = SubdomainKindUpdatedPO(
      subdomainId = d.subdomainId,
      kind = d.kind,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: SubdomainKindUpdatedPO): SubdomainKindUpdated = SubdomainKindUpdated(
      subdomainId = p.subdomainId,
      kind = p.kind,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
