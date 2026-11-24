package example.bankwealth.infrastructure.persistence

import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.infrastructure.persistence.converters.DomainConverters
import example.bankwealth.infrastructure.{proto => pb}
import scalapb.GeneratedMessage

object CreditBalanceEventAdapter extends EventAdapter[Event, GeneratedMessage] {
  override def manifest(event: Event): String = "CreditBalanceEventPO"

  override def toJournal(event: Event): GeneratedMessage =
    DomainConverters.encodeCreditBalanceEventPO(event)

  override def fromJournal(event: GeneratedMessage, manifest: String): EventSeq[Event] = (event, manifest) match {
    case (envelope: pb.CreditBalanceEventPO, "CreditBalanceEventPO") =>
      EventSeq.single(DomainConverters.decodeCreditBalanceEventPO(envelope))
    case _ => throw new IllegalArgumentException("event manifest and payload mismatch")
  }
}

object CreditBalanceSnapshotAdapter extends SnapshotAdapter[State] {
  override def toJournal(state: State): Any = DomainConverters.encodeCreditBalanceStatePO(state)
  override def fromJournal(value: Any): State = value match {
    case state: pb.CreditBalanceStatePO => DomainConverters.decodeCreditBalanceStatePO(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
