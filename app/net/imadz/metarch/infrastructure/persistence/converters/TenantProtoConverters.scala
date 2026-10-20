package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.TenantEntity.TenantState
import net.imadz.metarch.domain.entities.TenantEntity._
import net.imadz.metarch.infrastructure.proto._

trait TenantProtoConverters extends PrimitiveConverter {

  object TenantStateConv extends ProtoConverter[TenantState, TenantStatePO] {
    override def toProto(d: TenantState): TenantStatePO = TenantStatePO(
      status = d.status,
      name = d.name,
      ownerUserId = d.ownerUserId,
      orgMemberIds = d.orgMemberIds,
      createdAt = d.createdAt,
      createdBy = d.createdBy,
      suspendedAt = d.suspendedAt,
      archivedAt = d.archivedAt
    )

    override def fromProto(p: TenantStatePO): TenantState = TenantState(
      status = p.status,
      name = p.name,
      ownerUserId = p.ownerUserId,
      orgMemberIds = p.orgMemberIds,
      createdAt = p.createdAt,
      createdBy = p.createdBy,
      suspendedAt = p.suspendedAt,
      archivedAt = p.archivedAt
    )
  }


  object TenantOnboardedConv extends ProtoConverter[TenantOnboarded, TenantOnboardedPO] {
    override def toProto(d: TenantOnboarded): TenantOnboardedPO = TenantOnboardedPO(
      tenantId = d.tenantId,
      name = d.name,
      ownerUserId = d.ownerUserId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: TenantOnboardedPO): TenantOnboarded = TenantOnboarded(
      tenantId = p.tenantId,
      name = p.name,
      ownerUserId = p.ownerUserId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object TenantOwnerChangedConv extends ProtoConverter[TenantOwnerChanged, TenantOwnerChangedPO] {
    override def toProto(d: TenantOwnerChanged): TenantOwnerChangedPO = TenantOwnerChangedPO(
      tenantId = d.tenantId,
      oldOwnerUserId = d.oldOwnerUserId,
      newOwnerUserId = d.newOwnerUserId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: TenantOwnerChangedPO): TenantOwnerChanged = TenantOwnerChanged(
      tenantId = p.tenantId,
      oldOwnerUserId = p.oldOwnerUserId,
      newOwnerUserId = p.newOwnerUserId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object TenantSuspendedConv extends ProtoConverter[TenantSuspended, TenantSuspendedPO] {
    override def toProto(d: TenantSuspended): TenantSuspendedPO = TenantSuspendedPO(
      tenantId = d.tenantId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: TenantSuspendedPO): TenantSuspended = TenantSuspended(
      tenantId = p.tenantId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object TenantResumedConv extends ProtoConverter[TenantResumed, TenantResumedPO] {
    override def toProto(d: TenantResumed): TenantResumedPO = TenantResumedPO(
      tenantId = d.tenantId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: TenantResumedPO): TenantResumed = TenantResumed(
      tenantId = p.tenantId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object TenantArchivedConv extends ProtoConverter[TenantArchived, TenantArchivedPO] {
    override def toProto(d: TenantArchived): TenantArchivedPO = TenantArchivedPO(
      tenantId = d.tenantId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: TenantArchivedPO): TenantArchived = TenantArchived(
      tenantId = p.tenantId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object TenantMemberRosterUpdatedConv extends ProtoConverter[TenantMemberRosterUpdated, TenantMemberRosterUpdatedPO] {
    override def toProto(d: TenantMemberRosterUpdated): TenantMemberRosterUpdatedPO = TenantMemberRosterUpdatedPO(
      tenantId = d.tenantId,
      userId = d.userId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      orgMemberId = d.orgMemberId
    )

    override def fromProto(p: TenantMemberRosterUpdatedPO): TenantMemberRosterUpdated = TenantMemberRosterUpdated(
      tenantId = p.tenantId,
      userId = p.userId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      orgMemberId = p.orgMemberId
    )
  }

}
