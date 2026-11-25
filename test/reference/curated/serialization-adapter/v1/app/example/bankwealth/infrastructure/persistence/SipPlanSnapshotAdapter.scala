package example.bankwealth.infrastructure.persistence

import akka.persistence.typed.SnapshotAdapter
import example.bankwealth.domain.entities.SipPlanEntity.State
import example.bankwealth.infrastructure.persistence.converters.SipPlanProtoConverters
import example.bankwealth.infrastructure.{proto => pb}

class SipPlanSnapshotAdapter extends SnapshotAdapter[State] with SipPlanProtoConverters {
  override def toJournal(state: State): Any = encodeSipPlanStatePO(state)

  override def fromJournal(value: Any): State = value match {
    case state: pb.SipPlanStatePO => decodeSipPlanStatePO(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
