package example.bankwealth.domain.entities

object CreditBalanceEntity {
  type State = example.bankwealth.domain.CreditBalanceState
  val State: example.bankwealth.domain.CreditBalanceState.type = example.bankwealth.domain.CreditBalanceState

  type Event = example.bankwealth.domain.CreditBalanceProtocol.Event

  object Events {
    type AccountInitialized = example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized
    val AccountInitialized: example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized.type =
      example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized

    type ReserveFundsConfirmed = example.bankwealth.domain.CreditBalanceProtocol.ReserveFundsConfirmed
    val ReserveFundsConfirmed: example.bankwealth.domain.CreditBalanceProtocol.ReserveFundsConfirmed.type =
      example.bankwealth.domain.CreditBalanceProtocol.ReserveFundsConfirmed

    type DeductFundsConfirmed = example.bankwealth.domain.CreditBalanceProtocol.DeductFundsConfirmed
    val DeductFundsConfirmed: example.bankwealth.domain.CreditBalanceProtocol.DeductFundsConfirmed.type =
      example.bankwealth.domain.CreditBalanceProtocol.DeductFundsConfirmed

    type ReleaseReservedFundsConfirmed = example.bankwealth.domain.CreditBalanceProtocol.ReleaseReservedFundsConfirmed
    val ReleaseReservedFundsConfirmed: example.bankwealth.domain.CreditBalanceProtocol.ReleaseReservedFundsConfirmed.type =
      example.bankwealth.domain.CreditBalanceProtocol.ReleaseReservedFundsConfirmed

    type RecordIncomingCreditsConfirmed = example.bankwealth.domain.CreditBalanceProtocol.RecordIncomingCreditsConfirmed
    val RecordIncomingCreditsConfirmed: example.bankwealth.domain.CreditBalanceProtocol.RecordIncomingCreditsConfirmed.type =
      example.bankwealth.domain.CreditBalanceProtocol.RecordIncomingCreditsConfirmed

    type CommitIncomingCreditsConfirmed = example.bankwealth.domain.CreditBalanceProtocol.CommitIncomingCreditsConfirmed
    val CommitIncomingCreditsConfirmed: example.bankwealth.domain.CreditBalanceProtocol.CommitIncomingCreditsConfirmed.type =
      example.bankwealth.domain.CreditBalanceProtocol.CommitIncomingCreditsConfirmed

    type CancelIncomingCreditConfirmed = example.bankwealth.domain.CreditBalanceProtocol.CancelIncomingCreditConfirmed
    val CancelIncomingCreditConfirmed: example.bankwealth.domain.CreditBalanceProtocol.CancelIncomingCreditConfirmed.type =
      example.bankwealth.domain.CreditBalanceProtocol.CancelIncomingCreditConfirmed
  }

  def empty: State = State(example.bankwealth.domain.values.AccountId(""), false, Map(), Map(), Map(), Map(), Map(), Map(), Map())
}
