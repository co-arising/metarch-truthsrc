package example.bankwealth.infrastructure.serialization

import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
import example.bankwealth.domain._
import example.bankwealth.domain.CreditBalanceProtocol._
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

object CreditBalanceSnapshotAdapter extends SnapshotAdapter[CreditBalanceState] {
  override def toJournal(state: CreditBalanceState): Any = DomainConverters.encodeCreditBalanceStatePO(state)
  override def fromJournal(value: Any): CreditBalanceState = value match {
    case state: pb.CreditBalanceStatePO => DomainConverters.decodeCreditBalanceStatePO(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
