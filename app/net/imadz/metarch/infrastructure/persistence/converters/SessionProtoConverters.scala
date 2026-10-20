package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.SessionEntity.SessionState
import net.imadz.metarch.domain.entities.SessionEntity._
import net.imadz.metarch.infrastructure.proto._

trait SessionProtoConverters extends PrimitiveConverter {

  object SessionStateConv extends ProtoConverter[SessionState, SessionStatePO] {
    override def toProto(d: SessionState): SessionStatePO = SessionStatePO(
      tenantId = d.tenantId,
      status = d.status,
      stageId = d.stageId,
      participantUserIds = d.participantUserIds,
      observerUserIds = d.observerUserIds,
      openedAt = d.openedAt,
      preparedAt = d.preparedAt,
      closedAt = d.closedAt,
      participantRoles = d.participantRoles
    )

    override def fromProto(p: SessionStatePO): SessionState = SessionState(
      tenantId = p.tenantId,
      status = p.status,
      stageId = p.stageId,
      participantUserIds = p.participantUserIds,
      observerUserIds = p.observerUserIds,
      openedAt = p.openedAt,
      preparedAt = p.preparedAt,
      closedAt = p.closedAt,
      participantRoles = p.participantRoles
    )
  }


  object ObserverInvitedConv extends ProtoConverter[ObserverInvited, ObserverInvitedPO] {
    override def toProto(d: ObserverInvited): ObserverInvitedPO = ObserverInvitedPO(
      sessionId = d.sessionId,
      stageId = d.stageId,
      userId = d.userId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      displayName = d.displayName,
      email = d.email,
      phoneNumber = d.phoneNumber
    )

    override def fromProto(p: ObserverInvitedPO): ObserverInvited = ObserverInvited(
      sessionId = p.sessionId,
      stageId = p.stageId,
      userId = p.userId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      displayName = p.displayName,
      email = p.email,
      phoneNumber = p.phoneNumber
    )
  }


  object ParticipantInvitedConv extends ProtoConverter[ParticipantInvited, ParticipantInvitedPO] {
    override def toProto(d: ParticipantInvited): ParticipantInvitedPO = ParticipantInvitedPO(
      sessionId = d.sessionId,
      stageId = d.stageId,
      userId = d.userId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      displayName = d.displayName,
      email = d.email,
      phoneNumber = d.phoneNumber
    )

    override def fromProto(p: ParticipantInvitedPO): ParticipantInvited = ParticipantInvited(
      sessionId = p.sessionId,
      stageId = p.stageId,
      userId = p.userId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      displayName = p.displayName,
      email = p.email,
      phoneNumber = p.phoneNumber
    )
  }


  object SessionClosedConv extends ProtoConverter[SessionClosed, SessionClosedPO] {
    override def toProto(d: SessionClosed): SessionClosedPO = SessionClosedPO(
      sessionId = d.sessionId,
      stageId = d.stageId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: SessionClosedPO): SessionClosed = SessionClosed(
      sessionId = p.sessionId,
      stageId = p.stageId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object SessionCompletedConv extends ProtoConverter[SessionCompleted, SessionCompletedPO] {
    override def toProto(d: SessionCompleted): SessionCompletedPO = SessionCompletedPO(
      sessionId = d.sessionId,
      stageId = d.stageId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: SessionCompletedPO): SessionCompleted = SessionCompleted(
      sessionId = p.sessionId,
      stageId = p.stageId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object SessionOpenedConv extends ProtoConverter[SessionOpened, SessionOpenedPO] {
    override def toProto(d: SessionOpened): SessionOpenedPO = SessionOpenedPO(
      tenantId = d.tenantId,
      sessionId = d.sessionId,
      stageId = d.stageId,
      workshopId = d.workshopId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: SessionOpenedPO): SessionOpened = SessionOpened(
      tenantId = p.tenantId,
      sessionId = p.sessionId,
      stageId = p.stageId,
      workshopId = p.workshopId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object SessionPreparedConv extends ProtoConverter[SessionPrepared, SessionPreparedPO] {
    override def toProto(d: SessionPrepared): SessionPreparedPO = SessionPreparedPO(
      sessionId = d.sessionId,
      stageId = d.stageId,
      participantUserIds = d.participantUserIds,
      observerUserIds = d.observerUserIds,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: SessionPreparedPO): SessionPrepared = SessionPrepared(
      sessionId = p.sessionId,
      stageId = p.stageId,
      participantUserIds = p.participantUserIds,
      observerUserIds = p.observerUserIds,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object SessionRoleAssignedConv extends ProtoConverter[SessionRoleAssigned, SessionRoleAssignedPO] {
    override def toProto(d: SessionRoleAssigned): SessionRoleAssignedPO = SessionRoleAssignedPO(
      sessionId = d.sessionId,
      stageId = d.stageId,
      userId = d.userId,
      role = d.role,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: SessionRoleAssignedPO): SessionRoleAssigned = SessionRoleAssigned(
      sessionId = p.sessionId,
      stageId = p.stageId,
      userId = p.userId,
      role = p.role,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
