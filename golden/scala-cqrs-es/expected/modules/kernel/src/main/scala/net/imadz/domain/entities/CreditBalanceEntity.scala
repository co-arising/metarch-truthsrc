package net.imadz..domain.entities

import net.imadz..domain.values.Money
import net.imadz.framework.common.CborSerializable
import net.imadz.framework.common.CommonTypes.Id
import scala.collection.immutable.Map
import scala.collection.immutable.Map

object CreditBalanceEntity {
  case class CreditBalanceState(userId: Id, accountBalance: Map[String, Money] = Map.empty, reservedAmount: Map[Id, Money] = Map.empty, incomingCredits: Map[Id, Money] = Map.empty)

  def empty(userId: Id): CreditBalanceState = CreditBalanceState(userId, Map.empty, Map.empty, Map.empty)

  sealed trait CreditBalanceEvent extends CborSerializable

  case class BalanceChanged(update: Money, timestamp: Long) extends CreditBalanceEvent
  case class FundsReserved(transferId: Id, amount: Money) extends CreditBalanceEvent
  case class FundsDeducted(transferId: Id, amount: Money) extends CreditBalanceEvent
  case class ReservationReleased(transferId: Id, amount: Money) extends CreditBalanceEvent
  case class IncomingCreditsRecorded(transferId: Id, amount: Money) extends CreditBalanceEvent
  case class IncomingCreditsCommited(transferId: Id) extends CreditBalanceEvent
  case class IncomingCreditsCanceled(transferId: Id) extends CreditBalanceEvent

  type CreditBalanceEventHandler = (CreditBalanceState, CreditBalanceEvent) => CreditBalanceState
}
