package example.bankwealth.domain.invariant.params

import example.bankwealth.domain.entities.CreditBalanceEntity.State
import example.bankwealth.domain.events.CreditBalanceEvents
import example.bankwealth.domain.services.CreditBalanceComputations

object CreditBalanceRuleParams {
  final case class InitializeAccountParams(state: State, command: CreditBalanceEvents.InitializeAccount, hosts: CreditBalanceComputations)
  final case class ReserveFundsParams(state: State, command: CreditBalanceEvents.ReserveFunds, hosts: CreditBalanceComputations)
  final case class DeductFundsParams(state: State, command: CreditBalanceEvents.DeductFunds, hosts: CreditBalanceComputations)
  final case class ReleaseReservedFundsParams(state: State, command: CreditBalanceEvents.ReleaseReservedFunds, hosts: CreditBalanceComputations)
  final case class RecordIncomingCreditsParams(state: State, command: CreditBalanceEvents.RecordIncomingCredits, hosts: CreditBalanceComputations)
  final case class CommitIncomingCreditsParams(state: State, command: CreditBalanceEvents.CommitIncomingCredits, hosts: CreditBalanceComputations)
  final case class CancelIncomingCreditParams(state: State, command: CreditBalanceEvents.CancelIncomingCredit, hosts: CreditBalanceComputations)
}
