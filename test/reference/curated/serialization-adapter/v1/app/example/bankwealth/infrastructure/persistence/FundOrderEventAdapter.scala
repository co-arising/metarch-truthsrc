package example.bankwealth.infrastructure.persistence

import akka.persistence.typed.{EventAdapter, EventSeq}
import example.bankwealth.domain.entities.FundOrderEntity.Event
import example.bankwealth.infrastructure.persistence.converters.FundOrderProtoConverters
import example.bankwealth.infrastructure.{proto => pb}

class FundOrderEventAdapter extends EventAdapter[Event, pb.FundOrderEventPO] with FundOrderProtoConverters {
  override def manifest(event: Event): String = "FundOrderEventPO"

  override def toJournal(event: Event): pb.FundOrderEventPO =
    encodeFundOrderEventPO(event)

  override def fromJournal(envelope: pb.FundOrderEventPO, manifest: String): EventSeq[Event] =
    EventSeq.single(decodeFundOrderEventPO(envelope))
}
