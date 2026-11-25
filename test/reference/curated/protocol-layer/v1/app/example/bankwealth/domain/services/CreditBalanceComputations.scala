package example.bankwealth.domain.services

import example.bankwealth.domain.entities.CreditBalanceEntity.State
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._
import example.bankwealth.domain.values._
import net.imadz.common.CommonTypes.DomainService

trait CreditBalanceComputations extends DomainService {
  def BalanceAfterCommitIncomingCredits(state: State, p: CommitIncomingCreditsParams): Money
  def BalanceAfterReleaseReservedFunds(state: State, p: ReleaseReservedFundsParams): Money
  def BalanceAfterReserveFunds(state: State, p: ReserveFundsParams): Money
}
object CreditBalanceComputations {
}
