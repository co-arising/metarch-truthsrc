package example.bankwealth.domain

import CreditBalanceProtocol._

object CreditBalanceRules {
  def InitializeAccount(state: CreditBalanceState, p: InitializeAccount, hosts: CreditBalanceComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.CreditBalanceRules.InitializeAccount(example.bankwealth.domain.invariant.params.CreditBalanceRuleParams.InitializeAccountParams(state, p, hosts))
  def ReserveFunds(state: CreditBalanceState, p: ReserveFunds, hosts: CreditBalanceComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.CreditBalanceRules.ReserveFunds(example.bankwealth.domain.invariant.params.CreditBalanceRuleParams.ReserveFundsParams(state, p, hosts))
  def DeductFunds(state: CreditBalanceState, p: DeductFunds, hosts: CreditBalanceComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.CreditBalanceRules.DeductFunds(example.bankwealth.domain.invariant.params.CreditBalanceRuleParams.DeductFundsParams(state, p, hosts))
  def ReleaseReservedFunds(state: CreditBalanceState, p: ReleaseReservedFunds, hosts: CreditBalanceComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.CreditBalanceRules.ReleaseReservedFunds(example.bankwealth.domain.invariant.params.CreditBalanceRuleParams.ReleaseReservedFundsParams(state, p, hosts))
  def RecordIncomingCredits(state: CreditBalanceState, p: RecordIncomingCredits, hosts: CreditBalanceComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.CreditBalanceRules.RecordIncomingCredits(example.bankwealth.domain.invariant.params.CreditBalanceRuleParams.RecordIncomingCreditsParams(state, p, hosts))
  def CommitIncomingCredits(state: CreditBalanceState, p: CommitIncomingCredits, hosts: CreditBalanceComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.CreditBalanceRules.CommitIncomingCredits(example.bankwealth.domain.invariant.params.CreditBalanceRuleParams.CommitIncomingCreditsParams(state, p, hosts))
  def CancelIncomingCredit(state: CreditBalanceState, p: CancelIncomingCredit, hosts: CreditBalanceComputations): Either[String, Vector[Event]] =
    example.bankwealth.domain.invariant.CreditBalanceRules.CancelIncomingCredit(example.bankwealth.domain.invariant.params.CreditBalanceRuleParams.CancelIncomingCreditParams(state, p, hosts))
}
