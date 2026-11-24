package example.bankwealth.infrastructure.persistence

import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
import example.bankwealth.domain.entities.SipPlanEntity.State
import example.bankwealth.domain.events.SipPlanEvents.Event
import example.bankwealth.infrastructure.persistence.converters.DomainConverters
import example.bankwealth.infrastructure.{proto => pb}
import scalapb.GeneratedMessage

object SipPlanEventAdapter extends EventAdapter[Event, GeneratedMessage] {
  override def manifest(event: Event): String = "SipPlanEventPO"

  override def toJournal(event: Event): GeneratedMessage =
    DomainConverters.encodeSipPlanEventPO(event)

  override def fromJournal(event: GeneratedMessage, manifest: String): EventSeq[Event] = (event, manifest) match {
    case (envelope: pb.SipPlanEventPO, "SipPlanEventPO") =>
      EventSeq.single(DomainConverters.decodeSipPlanEventPO(envelope))
    case _ => throw new IllegalArgumentException("event manifest and payload mismatch")
  }
}

object SipPlanSnapshotAdapter extends SnapshotAdapter[State] {
  override def toJournal(state: State): Any = DomainConverters.encodeSipPlanStatePO(state)
  override def fromJournal(value: Any): State = value match {
    case state: pb.SipPlanStatePO => DomainConverters.decodeSipPlanStatePO(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
