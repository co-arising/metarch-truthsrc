package net.imadz.metarch.infrastructure.persistence

import akka.persistence.typed.EventAdapter
import akka.persistence.typed.EventSeq
import net.imadz.metarch.domain.entities.FsmDefinitionEntity.FsmDefinitionProposed
import net.imadz.metarch.domain.entities.FsmDefinitionEntity.FsmElementsUpdated
import net.imadz.metarch.domain.entities.FsmDefinitionEntity.FsmDefinitionEstablished
import net.imadz.metarch.infrastructure.persistence.converters.FsmDefinitionProtoConverters
import net.imadz.metarch.infrastructure.proto.FsmDefinitionEventPO

/**
 * FsmDefinitionEventAdapter: 事件适配器，负责在领域事件和protobuf事件之间进行转换
 */
class FsmDefinitionEventAdapter extends EventAdapter[FsmDefinitionEvent, FsmDefinitionEventPO.Event] with FsmDefinitionProtoConverters {

  override def manifest(event: FsmDefinitionEvent): String = event.getClass.getName

  override def toJournal(e: FsmDefinitionEvent): FsmDefinitionEventPO.Event = {
    val eventUnion = e match {

      case evt: FsmDefinitionProposed =>
        FsmDefinitionEventPO.Event.FsmDefinitionProposed(FsmDefinitionProposedConv.toProto(evt))


      case evt: FsmElementsUpdated =>
        FsmDefinitionEventPO.Event.FsmElementsUpdated(FsmElementsUpdatedConv.toProto(evt))


      case evt: FsmDefinitionEstablished =>
        FsmDefinitionEventPO.Event.FsmDefinitionEstablished(FsmDefinitionEstablishedConv.toProto(evt))

    }
    eventUnion
  }

  override def fromJournal(p: FsmDefinitionEventPO.Event, manifest: String): EventSeq[FsmDefinitionEvent] = {
    p match {

      case FsmDefinitionEventPO.Event.FsmDefinitionProposed(po) =>
        EventSeq.single(FsmDefinitionProposedConv.fromProto(po))


      case FsmDefinitionEventPO.Event.FsmElementsUpdated(po) =>
        EventSeq.single(FsmElementsUpdatedConv.fromProto(po))


      case FsmDefinitionEventPO.Event.FsmDefinitionEstablished(po) =>
        EventSeq.single(FsmDefinitionEstablishedConv.fromProto(po))

      case FsmDefinitionEventPO.Event.Empty =>
        EventSeq.empty
    }
  }

}
