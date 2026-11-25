package example.bankwealth.infrastructure.persistence

import akka.persistence.typed.{EventAdapter, EventSeq}
import example.bankwealth.domain.entities.SipPlanEntity.Event
import example.bankwealth.infrastructure.persistence.converters.SipPlanProtoConverters
import example.bankwealth.infrastructure.{proto => pb}

class SipPlanEventAdapter extends EventAdapter[Event, pb.SipPlanEventPO] with SipPlanProtoConverters {
  override def manifest(event: Event): String = "SipPlanEventPO"

  override def toJournal(event: Event): pb.SipPlanEventPO =
    encodeSipPlanEventPO(event)

  override def fromJournal(envelope: pb.SipPlanEventPO, manifest: String): EventSeq[Event] =
    EventSeq.single(decodeSipPlanEventPO(envelope))
}
