package example.bankwealth.domain.services

import example.bankwealth.domain.entities.CreditBalanceEntity.State
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._
import example.bankwealth.domain.values._

trait CreditBalanceComputations {
  def BalanceAfterCommitIncomingCredits(state: State, p: CommitIncomingCreditsParams): Money
  def BalanceAfterReleaseReservedFunds(state: State, p: ReleaseReservedFundsParams): Money
  def BalanceAfterReserveFunds(state: State, p: ReserveFundsParams): Money
}
object CreditBalanceComputations {
}
