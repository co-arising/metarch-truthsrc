package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.FsmDefinitionEntity.FsmDefinitionState
import net.imadz.metarch.domain.entities.FsmDefinitionEntity._
import net.imadz.metarch.infrastructure.proto._

trait FsmDefinitionProtoConverters extends PrimitiveConverter {

  object FsmDefinitionStateConv extends ProtoConverter[FsmDefinitionState, FsmDefinitionStatePO] {
    override def toProto(d: FsmDefinitionState): FsmDefinitionStatePO = FsmDefinitionStatePO(
      status = d.status,
      aggregateName = d.aggregateName,
      states = d.states,
      transitions = d.transitions,
      createdAt = d.createdAt,
      createdBy = d.createdBy
    )

    override def fromProto(p: FsmDefinitionStatePO): FsmDefinitionState = FsmDefinitionState(
      status = p.status,
      aggregateName = p.aggregateName,
      states = p.states,
      transitions = p.transitions,
      createdAt = p.createdAt,
      createdBy = p.createdBy
    )
  }


  object FsmDefinitionProposedConv extends ProtoConverter[FsmDefinitionProposed, FsmDefinitionProposedPO] {
    override def toProto(d: FsmDefinitionProposed): FsmDefinitionProposedPO = FsmDefinitionProposedPO(
      fsmId = d.fsmId,
      aggregateName = d.aggregateName,
      states = d.states,
      transitions = d.transitions,
      createdAt = d.createdAt,
      createdBy = d.createdBy,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: FsmDefinitionProposedPO): FsmDefinitionProposed = FsmDefinitionProposed(
      fsmId = p.fsmId,
      aggregateName = p.aggregateName,
      states = p.states,
      transitions = p.transitions,
      createdAt = p.createdAt,
      createdBy = p.createdBy,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object FsmElementsUpdatedConv extends ProtoConverter[FsmElementsUpdated, FsmElementsUpdatedPO] {
    override def toProto(d: FsmElementsUpdated): FsmElementsUpdatedPO = FsmElementsUpdatedPO(
      fsmId = d.fsmId,
      states = d.states,
      transitions = d.transitions,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: FsmElementsUpdatedPO): FsmElementsUpdated = FsmElementsUpdated(
      fsmId = p.fsmId,
      states = p.states,
      transitions = p.transitions,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }


  object FsmDefinitionEstablishedConv extends ProtoConverter[FsmDefinitionEstablished, FsmDefinitionEstablishedPO] {
    override def toProto(d: FsmDefinitionEstablished): FsmDefinitionEstablishedPO = FsmDefinitionEstablishedPO(
      fsmId = d.fsmId,
      confirmedBy = d.confirmedBy,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp
    )

    override def fromProto(p: FsmDefinitionEstablishedPO): FsmDefinitionEstablished = FsmDefinitionEstablished(
      fsmId = p.fsmId,
      confirmedBy = p.confirmedBy,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp
    )
  }

}
