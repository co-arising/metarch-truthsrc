package example.bankwealth.domain.services

import example.bankwealth.domain.entities.CreditBalanceEntity.State
import example.bankwealth.domain.events.CreditBalanceEvents._
import example.bankwealth.domain.values._

trait CreditBalanceComputations {
  def BalanceAfterCommitIncomingCredits(state: State, p: CommitIncomingCredits): Money
  def BalanceAfterReleaseReservedFunds(state: State, p: ReleaseReservedFunds): Money
  def BalanceAfterReserveFunds(state: State, p: ReserveFunds): Money
}
object CreditBalanceComputations {
}
object CreditBalanceCommandHelpers {
  def emitInitializeAccount(state: State, p: InitializeAccount, hosts: CreditBalanceComputations): Vector[Event] = Vector(AccountInitialized(p.resource, p.currency, p.amount))
  def emitReserveFunds(state: State, p: ReserveFunds, hosts: CreditBalanceComputations): Vector[Event] = Vector(ReserveFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReserveFunds(state, p)))
  def emitDeductFunds(state: State, p: DeductFunds, hosts: CreditBalanceComputations): Vector[Event] = Vector(DeductFundsConfirmed(p.txid, p.resource, p.amount))
  def emitReleaseReservedFunds(state: State, p: ReleaseReservedFunds, hosts: CreditBalanceComputations): Vector[Event] = Vector(ReleaseReservedFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReleaseReservedFunds(state, p)))
  def emitRecordIncomingCredits(state: State, p: RecordIncomingCredits, hosts: CreditBalanceComputations): Vector[Event] = Vector(RecordIncomingCreditsConfirmed(p.txid, p.resource, p.amount))
  def emitCommitIncomingCredits(state: State, p: CommitIncomingCredits, hosts: CreditBalanceComputations): Vector[Event] = Vector(CommitIncomingCreditsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterCommitIncomingCredits(state, p)))
  def emitCancelIncomingCredit(state: State, p: CancelIncomingCredit, hosts: CreditBalanceComputations): Vector[Event] = Vector(CancelIncomingCreditConfirmed(p.txid, p.resource, p.amount))
}
