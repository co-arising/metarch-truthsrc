package example.bankwealth.domain.entities.behaviors

import example.bankwealth.domain._
import example.bankwealth.domain.CreditBalanceProtocol._

object CreditBalanceEventHandler {
  def apply(state: CreditBalanceState, input: Event): CreditBalanceState = input match {
    case event: AccountInitialized =>
      val next0: Boolean = true
      val next1: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.amount)
      state.copy(initialized = next0, accountBalance = next1)
    case event: ReserveFundsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedAmount.updated(event.txid, event.amount)
      val next1: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.available)
      state.copy(reservedAmount = next0, accountBalance = next1)
    case event: DeductFundsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedAmount - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.committedOutgoing.updated(event.txid, event.amount)
      state.copy(reservedAmount = next0, committedOutgoing = next1)
    case event: ReleaseReservedFundsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedAmount - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.compensatedOutgoing.updated(event.txid, event.amount)
      val next2: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.available)
      state.copy(reservedAmount = next0, compensatedOutgoing = next1, accountBalance = next2)
    case event: RecordIncomingCreditsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.incomingCredits.updated(event.txid, event.amount)
      state.copy(incomingCredits = next0)
    case event: CommitIncomingCreditsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.incomingCredits - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.committedIncoming.updated(event.txid, event.amount)
      val next2: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.available)
      state.copy(incomingCredits = next0, committedIncoming = next1, accountBalance = next2)
    case event: CancelIncomingCreditConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.incomingCredits - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.compensatedIncoming.updated(event.txid, event.amount)
      state.copy(incomingCredits = next0, compensatedIncoming = next1)
  }
}
