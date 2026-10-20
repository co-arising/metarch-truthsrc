package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.WorkTicketEntity.WorkTicketState
import net.imadz.metarch.domain.entities.WorkTicketEntity._
import net.imadz.metarch.infrastructure.proto._

trait WorkTicketProtoConverters extends PrimitiveConverter {

  object WorkTicketStateConv extends ProtoConverter[WorkTicketState, WorkTicketStatePO] {
    override def toProto(d: WorkTicketState): WorkTicketStatePO = WorkTicketStatePO(
      status = d.status,
      subjectType = d.subjectType,
      subjectId = d.subjectId,
      stage = d.stage,
      ticketType = d.ticketType,
      title = d.title,
      checklist = d.checklist,
      createdAt = d.createdAt,
      createdBy = d.createdBy
    )

    override def fromProto(p: WorkTicketStatePO): WorkTicketState = WorkTicketState(
      status = p.status,
      subjectType = p.subjectType,
      subjectId = p.subjectId,
      stage = p.stage,
      ticketType = p.ticketType,
      title = p.title,
      checklist = p.checklist,
      createdAt = p.createdAt,
      createdBy = p.createdBy
    )
  }


  object WorkTicketCreatedConv extends ProtoConverter[WorkTicketCreated, WorkTicketCreatedPO] {
    override def toProto(d: WorkTicketCreated): WorkTicketCreatedPO = WorkTicketCreatedPO(
      ticketId = d.ticketId,
      subjectType = d.subjectType,
      subjectId = d.subjectId,
      stage = d.stage,
      ticketType = d.ticketType,
      title = d.title,
      checklist = d.checklist,
      createdAt = d.createdAt,
      createdBy = d.createdBy,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: WorkTicketCreatedPO): WorkTicketCreated = WorkTicketCreated(
      ticketId = p.ticketId,
      subjectType = p.subjectType,
      subjectId = p.subjectId,
      stage = p.stage,
      ticketType = p.ticketType,
      title = p.title,
      checklist = p.checklist,
      createdAt = p.createdAt,
      createdBy = p.createdBy,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object WorkTicketItemsUpdatedConv extends ProtoConverter[WorkTicketItemsUpdated, WorkTicketItemsUpdatedPO] {
    override def toProto(d: WorkTicketItemsUpdated): WorkTicketItemsUpdatedPO = WorkTicketItemsUpdatedPO(
      ticketId = d.ticketId,
      items = d.items,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: WorkTicketItemsUpdatedPO): WorkTicketItemsUpdated = WorkTicketItemsUpdated(
      ticketId = p.ticketId,
      items = p.items,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object WorkTicketApprovedConv extends ProtoConverter[WorkTicketApproved, WorkTicketApprovedPO] {
    override def toProto(d: WorkTicketApproved): WorkTicketApprovedPO = WorkTicketApprovedPO(
      ticketId = d.ticketId,
      approvedBy = d.approvedBy,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: WorkTicketApprovedPO): WorkTicketApproved = WorkTicketApproved(
      ticketId = p.ticketId,
      approvedBy = p.approvedBy,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }

}
