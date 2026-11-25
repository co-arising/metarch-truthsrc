package example.bankwealth.domain.services

import example.bankwealth.domain.entities.CreditBalanceEntity.State
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._
import example.bankwealth.domain.values._
import net.imadz.common.CommonTypes.DomainService

trait CreditBalanceComputations extends DomainService {
  def balanceAfterCommitIncomingCredits(state: State, p: CommitIncomingCreditsParams): Money
  def balanceAfterReleaseReservedFunds(state: State, p: ReleaseReservedFundsParams): Money
  def balanceAfterReserveFunds(state: State, p: ReserveFundsParams): Money
}
object CreditBalanceComputations {
}
