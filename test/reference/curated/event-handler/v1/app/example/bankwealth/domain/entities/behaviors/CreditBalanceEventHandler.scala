package example.bankwealth.domain.entities.behaviors

import example.bankwealth.domain.entities.CreditBalanceEntity._

object CreditBalanceEventHandler extends EventHandler {
  override def apply(state: State, input: Event): State = input match {
    case event: AccountInitialized =>
      state.copy(
        initialized = true,
        accountBalance = state.accountBalance.updated(event.currency, event.amount)
      )
    case event: ReserveFundsConfirmed =>
      state.copy(
        reservedAmount = state.reservedAmount.updated(event.txid, event.amount),
        accountBalance = state.accountBalance.updated(event.currency, event.available)
      )
    case event: DeductFundsConfirmed =>
      state.copy(
        reservedAmount = state.reservedAmount - event.txid,
        committedOutgoing = state.committedOutgoing.updated(event.txid, event.amount)
      )
    case event: ReleaseReservedFundsConfirmed =>
      state.copy(
        reservedAmount = state.reservedAmount - event.txid,
        compensatedOutgoing = state.compensatedOutgoing.updated(event.txid, event.amount),
        accountBalance = state.accountBalance.updated(event.currency, event.available)
      )
    case event: RecordIncomingCreditsConfirmed =>
      state.copy(incomingCredits = state.incomingCredits.updated(event.txid, event.amount))
    case event: CommitIncomingCreditsConfirmed =>
      state.copy(
        incomingCredits = state.incomingCredits - event.txid,
        committedIncoming = state.committedIncoming.updated(event.txid, event.amount),
        accountBalance = state.accountBalance.updated(event.currency, event.available)
      )
    case event: CancelIncomingCreditConfirmed =>
      state.copy(
        incomingCredits = state.incomingCredits - event.txid,
        compensatedIncoming = state.compensatedIncoming.updated(event.txid, event.amount)
      )
  }
}
