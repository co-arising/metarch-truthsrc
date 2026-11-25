package example.bankwealth.infrastructure.persistence

import akka.persistence.typed.SnapshotAdapter
import example.bankwealth.domain.entities.CreditBalanceEntity.State
import example.bankwealth.infrastructure.persistence.converters.CreditBalanceProtoConverters
import example.bankwealth.infrastructure.{proto => pb}

class CreditBalanceSnapshotAdapter extends SnapshotAdapter[State] with CreditBalanceProtoConverters {
  override def toJournal(state: State): Any = encodeCreditBalanceStatePO(state)

  override def fromJournal(value: Any): State = value match {
    case state: pb.CreditBalanceStatePO => decodeCreditBalanceStatePO(state)
    case _ => throw new IllegalArgumentException("snapshot type mismatch")
  }
}
