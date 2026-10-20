package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.QuestionEntity.QuestionState
import net.imadz.metarch.domain.entities.QuestionEntity._
import net.imadz.metarch.infrastructure.proto._

trait QuestionProtoConverters extends PrimitiveConverter {

  object QuestionStateConv extends ProtoConverter[QuestionState, QuestionStatePO] {
    override def toProto(d: QuestionState): QuestionStatePO = QuestionStatePO(
      tenantId = d.tenantId,
      status = d.status,
      externalId = d.externalId,
      boardId = d.boardId,
      sessionId = d.sessionId,
      content = d.content,
      linkedNoteIds = d.linkedNoteIds,
      raisedBy = d.raisedBy,
      raisedAt = d.raisedAt,
      answeredBy = d.answeredBy,
      answeredAt = d.answeredAt,
      answer = d.answer,
      dismissedBy = d.dismissedBy,
      dismissedAt = d.dismissedAt
    )

    override def fromProto(p: QuestionStatePO): QuestionState = QuestionState(
      tenantId = p.tenantId,
      status = p.status,
      externalId = p.externalId,
      boardId = p.boardId,
      sessionId = p.sessionId,
      content = p.content,
      linkedNoteIds = p.linkedNoteIds,
      raisedBy = p.raisedBy,
      raisedAt = p.raisedAt,
      answeredBy = p.answeredBy,
      answeredAt = p.answeredAt,
      answer = p.answer,
      dismissedBy = p.dismissedBy,
      dismissedAt = p.dismissedAt
    )
  }


  object QuestionRaisedConv extends ProtoConverter[QuestionRaised, QuestionRaisedPO] {
    override def toProto(d: QuestionRaised): QuestionRaisedPO = QuestionRaisedPO(
      questionId = d.questionId,
      tenantId = d.tenantId,
      sessionId = d.sessionId,
      externalId = d.externalId,
      boardId = d.boardId,
      content = d.content,
      linkedNoteIds = d.linkedNoteIds,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: QuestionRaisedPO): QuestionRaised = QuestionRaised(
      questionId = p.questionId,
      tenantId = p.tenantId,
      sessionId = p.sessionId,
      externalId = p.externalId,
      boardId = p.boardId,
      content = p.content,
      linkedNoteIds = p.linkedNoteIds,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object QuestionAnsweredConv extends ProtoConverter[QuestionAnswered, QuestionAnsweredPO] {
    override def toProto(d: QuestionAnswered): QuestionAnsweredPO = QuestionAnsweredPO(
      questionId = d.questionId,
      answer = d.answer,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: QuestionAnsweredPO): QuestionAnswered = QuestionAnswered(
      questionId = p.questionId,
      answer = p.answer,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object QuestionDismissedConv extends ProtoConverter[QuestionDismissed, QuestionDismissedPO] {
    override def toProto(d: QuestionDismissed): QuestionDismissedPO = QuestionDismissedPO(
      questionId = d.questionId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: QuestionDismissedPO): QuestionDismissed = QuestionDismissed(
      questionId = p.questionId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object QuestionReopenedConv extends ProtoConverter[QuestionReopened, QuestionReopenedPO] {
    override def toProto(d: QuestionReopened): QuestionReopenedPO = QuestionReopenedPO(
      questionId = d.questionId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: QuestionReopenedPO): QuestionReopened = QuestionReopened(
      questionId = p.questionId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
