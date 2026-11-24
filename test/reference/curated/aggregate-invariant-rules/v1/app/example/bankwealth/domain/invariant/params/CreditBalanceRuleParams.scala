package example.bankwealth.domain.invariant.params

import example.bankwealth.domain._

object CreditBalanceRuleParams {
  final case class InitializeAccountParams(state: CreditBalanceState, command: CreditBalanceProtocol.InitializeAccount, hosts: CreditBalanceComputations)
  final case class ReserveFundsParams(state: CreditBalanceState, command: CreditBalanceProtocol.ReserveFunds, hosts: CreditBalanceComputations)
  final case class DeductFundsParams(state: CreditBalanceState, command: CreditBalanceProtocol.DeductFunds, hosts: CreditBalanceComputations)
  final case class ReleaseReservedFundsParams(state: CreditBalanceState, command: CreditBalanceProtocol.ReleaseReservedFunds, hosts: CreditBalanceComputations)
  final case class RecordIncomingCreditsParams(state: CreditBalanceState, command: CreditBalanceProtocol.RecordIncomingCredits, hosts: CreditBalanceComputations)
  final case class CommitIncomingCreditsParams(state: CreditBalanceState, command: CreditBalanceProtocol.CommitIncomingCredits, hosts: CreditBalanceComputations)
  final case class CancelIncomingCreditParams(state: CreditBalanceState, command: CreditBalanceProtocol.CancelIncomingCredit, hosts: CreditBalanceComputations)
}
