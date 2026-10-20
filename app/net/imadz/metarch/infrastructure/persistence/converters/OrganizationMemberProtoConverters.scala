package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.OrganizationMemberEntity.OrganizationMemberState
import net.imadz.metarch.domain.entities.OrganizationMemberEntity._
import net.imadz.metarch.infrastructure.proto._

trait OrganizationMemberProtoConverters extends PrimitiveConverter {

  object OrganizationMemberStateConv extends ProtoConverter[OrganizationMemberState, OrganizationMemberStatePO] {
    override def toProto(d: OrganizationMemberState): OrganizationMemberStatePO = OrganizationMemberStatePO(
      tenantId = d.tenantId,
      status = d.status,
      userId = d.userId,
      department = d.department,
      jobTitle = d.jobTitle,
      displayName = d.displayName,
      email = d.email,
      phoneNumber = d.phoneNumber,
      joinedAt = d.joinedAt,
      removedAt = d.removedAt
    )

    override def fromProto(p: OrganizationMemberStatePO): OrganizationMemberState = OrganizationMemberState(
      tenantId = p.tenantId,
      status = p.status,
      userId = p.userId,
      department = p.department,
      jobTitle = p.jobTitle,
      displayName = p.displayName,
      email = p.email,
      phoneNumber = p.phoneNumber,
      joinedAt = p.joinedAt,
      removedAt = p.removedAt
    )
  }


  object TenantMemberInvitedConv extends ProtoConverter[TenantMemberInvited, TenantMemberInvitedPO] {
    override def toProto(d: TenantMemberInvited): TenantMemberInvitedPO = TenantMemberInvitedPO(
      tenantId = d.tenantId,
      userId = d.userId,
      department = d.department,
      jobTitle = d.jobTitle,
      invitedBy = d.invitedBy,
      expiresAt = d.expiresAt,
      timestamp = d.timestamp,
      triggeredBy = d.triggeredBy,
      displayName = d.displayName,
      email = d.email,
      phoneNumber = d.phoneNumber
    )

    override def fromProto(p: TenantMemberInvitedPO): TenantMemberInvited = TenantMemberInvited(
      tenantId = p.tenantId,
      userId = p.userId,
      department = p.department,
      jobTitle = p.jobTitle,
      invitedBy = p.invitedBy,
      expiresAt = p.expiresAt,
      timestamp = p.timestamp,
      triggeredBy = p.triggeredBy,
      displayName = p.displayName,
      email = p.email,
      phoneNumber = p.phoneNumber
    )
  }


  object TenantMemberInvitationAcceptedConv extends ProtoConverter[TenantMemberInvitationAccepted, TenantMemberInvitationAcceptedPO] {
    override def toProto(d: TenantMemberInvitationAccepted): TenantMemberInvitationAcceptedPO = TenantMemberInvitationAcceptedPO(
      tenantId = d.tenantId,
      userId = d.userId,
      timestamp = d.timestamp,
      triggeredBy = d.triggeredBy
    )

    override def fromProto(p: TenantMemberInvitationAcceptedPO): TenantMemberInvitationAccepted = TenantMemberInvitationAccepted(
      tenantId = p.tenantId,
      userId = p.userId,
      timestamp = p.timestamp,
      triggeredBy = p.triggeredBy
    )
  }


  object TenantMemberJoinedConv extends ProtoConverter[TenantMemberJoined, TenantMemberJoinedPO] {
    override def toProto(d: TenantMemberJoined): TenantMemberJoinedPO = TenantMemberJoinedPO(
      tenantId = d.tenantId,
      userId = d.userId,
      timestamp = d.timestamp,
      triggeredBy = d.triggeredBy,
      orgMemberId = d.orgMemberId
    )

    override def fromProto(p: TenantMemberJoinedPO): TenantMemberJoined = TenantMemberJoined(
      tenantId = p.tenantId,
      userId = p.userId,
      timestamp = p.timestamp,
      triggeredBy = p.triggeredBy,
      orgMemberId = p.orgMemberId
    )
  }


  object TenantMemberInvitationRevokedConv extends ProtoConverter[TenantMemberInvitationRevoked, TenantMemberInvitationRevokedPO] {
    override def toProto(d: TenantMemberInvitationRevoked): TenantMemberInvitationRevokedPO = TenantMemberInvitationRevokedPO(
      tenantId = d.tenantId,
      userId = d.userId,
      timestamp = d.timestamp,
      triggeredBy = d.triggeredBy
    )

    override def fromProto(p: TenantMemberInvitationRevokedPO): TenantMemberInvitationRevoked = TenantMemberInvitationRevoked(
      tenantId = p.tenantId,
      userId = p.userId,
      timestamp = p.timestamp,
      triggeredBy = p.triggeredBy
    )
  }


  object TenantMemberInvitationExpiredConv extends ProtoConverter[TenantMemberInvitationExpired, TenantMemberInvitationExpiredPO] {
    override def toProto(d: TenantMemberInvitationExpired): TenantMemberInvitationExpiredPO = TenantMemberInvitationExpiredPO(
      tenantId = d.tenantId,
      userId = d.userId,
      timestamp = d.timestamp,
      triggeredBy = d.triggeredBy
    )

    override def fromProto(p: TenantMemberInvitationExpiredPO): TenantMemberInvitationExpired = TenantMemberInvitationExpired(
      tenantId = p.tenantId,
      userId = p.userId,
      timestamp = p.timestamp,
      triggeredBy = p.triggeredBy
    )
  }


  object TenantMemberInvitationResentConv extends ProtoConverter[TenantMemberInvitationResent, TenantMemberInvitationResentPO] {
    override def toProto(d: TenantMemberInvitationResent): TenantMemberInvitationResentPO = TenantMemberInvitationResentPO(
      tenantId = d.tenantId,
      userId = d.userId,
      newExpiresAt = d.newExpiresAt,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: TenantMemberInvitationResentPO): TenantMemberInvitationResent = TenantMemberInvitationResent(
      tenantId = p.tenantId,
      userId = p.userId,
      newExpiresAt = p.newExpiresAt,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object TenantMemberRemovedConv extends ProtoConverter[TenantMemberRemoved, TenantMemberRemovedPO] {
    override def toProto(d: TenantMemberRemoved): TenantMemberRemovedPO = TenantMemberRemovedPO(
      tenantId = d.tenantId,
      userId = d.userId,
      reason = d.reason,
      timestamp = d.timestamp,
      triggeredBy = d.triggeredBy,
      orgMemberId = d.orgMemberId
    )

    override def fromProto(p: TenantMemberRemovedPO): TenantMemberRemoved = TenantMemberRemoved(
      tenantId = p.tenantId,
      userId = p.userId,
      reason = p.reason,
      timestamp = p.timestamp,
      triggeredBy = p.triggeredBy,
      orgMemberId = p.orgMemberId
    )
  }

}
