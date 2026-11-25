package example.bankwealth.infrastructure.persistence

import akka.persistence.typed.SnapshotAdapter
import example.bankwealth.domain.entities.FundOrderEntity.State
import example.bankwealth.infrastructure.persistence.converters.FundOrderProtoConverters
import example.bankwealth.infrastructure.{proto => pb}

class FundOrderSnapshotAdapter extends SnapshotAdapter[State] with FundOrderProtoConverters {
  override def toJournal(state: State): Any = encodeFundOrderStatePO(state)

  override def fromJournal(value: Any): State = value match {
    case state: pb.FundOrderStatePO => decodeFundOrderStatePO(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
