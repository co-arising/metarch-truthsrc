package example.bankwealth.infrastructure.serialization

import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
import example.bankwealth.domain._
import example.bankwealth.domain.FundOrderProtocol._
import example.bankwealth.infrastructure.{proto => pb}
import scalapb.GeneratedMessage

object FundOrderEventAdapter extends EventAdapter[Event, GeneratedMessage] {
  override def manifest(event: Event): String = "FundOrderEventPO"

  override def toJournal(event: Event): GeneratedMessage =
    DomainConverters.encodeFundOrderEventPO(event)

  override def fromJournal(event: GeneratedMessage, manifest: String): EventSeq[Event] = (event, manifest) match {
    case (envelope: pb.FundOrderEventPO, "FundOrderEventPO") =>
      EventSeq.single(DomainConverters.decodeFundOrderEventPO(envelope))
    case _ => throw new IllegalArgumentException("event manifest and payload mismatch")
  }
}

object FundOrderSnapshotAdapter extends SnapshotAdapter[FundOrderState] {
  override def toJournal(state: FundOrderState): Any = DomainConverters.encodeFundOrderStatePO(state)
  override def fromJournal(value: Any): FundOrderState = value match {
    case state: pb.FundOrderStatePO => DomainConverters.decodeFundOrderStatePO(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
