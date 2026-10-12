package net.imadz..domain.entities.behaviors

import java.util.Currency
import net.imadz..domain.entities.CreditBalanceEntity.CreditBalanceEventHandler
import net.imadz..domain.entities.CreditBalanceEntity.CreditBalanceEventHandler
import net.imadz..domain.entities.CreditBalanceEntity.CreditBalanceState
import net.imadz..domain.values.BalanceChanged
import net.imadz..domain.values.CreditBalanceEvent
import net.imadz..domain.values.FundsDeducted
import net.imadz..domain.values.FundsReserved
import net.imadz..domain.values.IncomingCreditsCanceled
import net.imadz..domain.values.IncomingCreditsCommited
import net.imadz..domain.values.IncomingCreditsRecorded
import net.imadz..domain.values.Money
import net.imadz..domain.values.ReservationReleased
import scala.collection.immutable.Map

object CreditBalanceEventHandler {
  def apply: CreditBalanceEventHandler = (state, event) => event match {
    case event: BalanceChanged =>
      state.copy(accountBalance = updateAccountBalance(state, event.update.currency, event.update))

    case event: FundsReserved =>
      state.copy(accountBalance = updateAccountBalance(state, event.amount.currency, event.amount.copy(amount = -event.amount.amount)), reservedAmount = state.reservedAmount + (event.transferId -> event.amount))

    case event: FundsDeducted =>
      state.copy(reservedAmount = state.reservedAmount - event.transferId)

    case event: ReservationReleased =>
      state.copy(accountBalance = updateAccountBalance(state, event.amount.currency, event.amount), reservedAmount = state.reservedAmount - event.transferId)

    case event: IncomingCreditsRecorded =>
      state.copy(incomingCredits = state.incomingCredits.updated(event.transferId, event.amount))

    case event: IncomingCreditsCommited =>
      state.copy(accountBalance = updateAccountBalance(state, state.incomingCredits(event.transferId).currency, state.incomingCredits(event.transferId)), incomingCredits = state.incomingCredits - event.transferId)

    case event: IncomingCreditsCanceled =>
      state.copy(incomingCredits = state.incomingCredits - event.transferId)
    case _ => state // 默认兜底，或者抛异常
  }

  private def updateAccountBalance(state: CreditBalanceState, currency: Currency, updateMoney: Money): Map[String, Money] = {
    /*
    >>> AI_PROMPT_START
    Context: Domain Entity Helper Method
    Task: Implement logic for updateAccountBalance
    Description: state.accountBalance + (currency.getCurrencyCode -> Money(currentBalance.amount + updateMoney.amount, currency))
    Input Params: state: CreditBalanceState, currency: Currency, updateMoney: Money
    Return: Map[String, Money]
    <<< AI_PROMPT_END
    */
    ???
  }
}
