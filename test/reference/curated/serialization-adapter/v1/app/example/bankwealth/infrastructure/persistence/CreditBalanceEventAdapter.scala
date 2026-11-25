package example.bankwealth.infrastructure.persistence

import akka.persistence.typed.{EventAdapter, EventSeq}
import example.bankwealth.domain.entities.CreditBalanceEntity.Event
import example.bankwealth.infrastructure.persistence.converters.CreditBalanceProtoConverters
import example.bankwealth.infrastructure.{proto => pb}

class CreditBalanceEventAdapter extends EventAdapter[Event, pb.CreditBalanceEventPO] with CreditBalanceProtoConverters {
  override def manifest(event: Event): String = "CreditBalanceEventPO"

  override def toJournal(event: Event): pb.CreditBalanceEventPO =
    encodeCreditBalanceEventPO(event)

  override def fromJournal(envelope: pb.CreditBalanceEventPO, manifest: String): EventSeq[Event] =
    EventSeq.single(decodeCreditBalanceEventPO(envelope))
}
