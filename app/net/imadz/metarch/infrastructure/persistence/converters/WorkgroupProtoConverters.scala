package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.WorkgroupEntity.WorkgroupState
import net.imadz.metarch.domain.entities.WorkgroupEntity._
import net.imadz.metarch.infrastructure.proto._

trait WorkgroupProtoConverters extends PrimitiveConverter {

  object WorkgroupStateConv extends ProtoConverter[WorkgroupState, WorkgroupStatePO] {
    override def toProto(d: WorkgroupState): WorkgroupStatePO = WorkgroupStatePO(
      tenantId = d.tenantId,
      status = d.status,
      name = d.name,
      ownerUserId = d.ownerUserId,
      memberUserIds = d.memberUserIds,
      invitedUserIds = d.invitedUserIds,
      createdAt = d.createdAt,
      createdBy = d.createdBy,
      archivedAt = d.archivedAt
    )

    override def fromProto(p: WorkgroupStatePO): WorkgroupState = WorkgroupState(
      tenantId = p.tenantId,
      status = p.status,
      name = p.name,
      ownerUserId = p.ownerUserId,
      memberUserIds = p.memberUserIds,
      invitedUserIds = p.invitedUserIds,
      createdAt = p.createdAt,
      createdBy = p.createdBy,
      archivedAt = p.archivedAt
    )
  }


  object WorkgroupFormedConv extends ProtoConverter[WorkgroupFormed, WorkgroupFormedPO] {
    override def toProto(d: WorkgroupFormed): WorkgroupFormedPO = WorkgroupFormedPO(
      workgroupId = d.workgroupId,
      tenantId = d.tenantId,
      name = d.name,
      ownerUserId = d.ownerUserId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: WorkgroupFormedPO): WorkgroupFormed = WorkgroupFormed(
      workgroupId = p.workgroupId,
      tenantId = p.tenantId,
      name = p.name,
      ownerUserId = p.ownerUserId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object WorkgroupOwnerAssignedConv extends ProtoConverter[WorkgroupOwnerAssigned, WorkgroupOwnerAssignedPO] {
    override def toProto(d: WorkgroupOwnerAssigned): WorkgroupOwnerAssignedPO = WorkgroupOwnerAssignedPO(
      workgroupId = d.workgroupId,
      ownerUserId = d.ownerUserId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: WorkgroupOwnerAssignedPO): WorkgroupOwnerAssigned = WorkgroupOwnerAssigned(
      workgroupId = p.workgroupId,
      ownerUserId = p.ownerUserId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object WorkgroupMemberInvitedConv extends ProtoConverter[WorkgroupMemberInvited, WorkgroupMemberInvitedPO] {
    override def toProto(d: WorkgroupMemberInvited): WorkgroupMemberInvitedPO = WorkgroupMemberInvitedPO(
      workgroupId = d.workgroupId,
      userId = d.userId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      displayName = d.displayName,
      email = d.email,
      phoneNumber = d.phoneNumber
    )

    override def fromProto(p: WorkgroupMemberInvitedPO): WorkgroupMemberInvited = WorkgroupMemberInvited(
      workgroupId = p.workgroupId,
      userId = p.userId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      displayName = p.displayName,
      email = p.email,
      phoneNumber = p.phoneNumber
    )
  }


  object WorkgroupMemberJoinedConv extends ProtoConverter[WorkgroupMemberJoined, WorkgroupMemberJoinedPO] {
    override def toProto(d: WorkgroupMemberJoined): WorkgroupMemberJoinedPO = WorkgroupMemberJoinedPO(
      workgroupId = d.workgroupId,
      userId = d.userId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: WorkgroupMemberJoinedPO): WorkgroupMemberJoined = WorkgroupMemberJoined(
      workgroupId = p.workgroupId,
      userId = p.userId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object WorkgroupMemberRemovedConv extends ProtoConverter[WorkgroupMemberRemoved, WorkgroupMemberRemovedPO] {
    override def toProto(d: WorkgroupMemberRemoved): WorkgroupMemberRemovedPO = WorkgroupMemberRemovedPO(
      workgroupId = d.workgroupId,
      userId = d.userId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: WorkgroupMemberRemovedPO): WorkgroupMemberRemoved = WorkgroupMemberRemoved(
      workgroupId = p.workgroupId,
      userId = p.userId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object WorkgroupArchivedConv extends ProtoConverter[WorkgroupArchived, WorkgroupArchivedPO] {
    override def toProto(d: WorkgroupArchived): WorkgroupArchivedPO = WorkgroupArchivedPO(
      workgroupId = d.workgroupId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: WorkgroupArchivedPO): WorkgroupArchived = WorkgroupArchived(
      workgroupId = p.workgroupId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object WorkgroupNameUpdatedConv extends ProtoConverter[WorkgroupNameUpdated, WorkgroupNameUpdatedPO] {
    override def toProto(d: WorkgroupNameUpdated): WorkgroupNameUpdatedPO = WorkgroupNameUpdatedPO(
      workgroupId = d.workgroupId,
      name = d.name,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: WorkgroupNameUpdatedPO): WorkgroupNameUpdated = WorkgroupNameUpdated(
      workgroupId = p.workgroupId,
      name = p.name,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
