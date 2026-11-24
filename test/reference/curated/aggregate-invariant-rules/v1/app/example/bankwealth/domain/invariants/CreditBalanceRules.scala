package example.bankwealth.domain.invariants

import example.bankwealth.domain.entities.CreditBalanceEntity._
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._
import example.bankwealth.domain.services.CreditBalanceComputations

object CreditBalanceRules {
  def InitializeAccount(state: State, p: InitializeAccountParams, hosts: CreditBalanceComputations): Either[String, Vector[Event]] = {
    if (!((p.resource == state.id))) return Left("ACCOUNT_ID")
    if (!(((p.currency == "CNY") && ((p.amount).currency == p.currency)))) return Left("ACCOUNT_CURRENCY")
    if (!((!(state.initialized) || ((state.accountBalance).get(p.currency)).contains(p.amount)))) return Left("ACCOUNT_INIT_CONFLICT")
    if ((state.initialized)) return Right(Vector.empty)
    if (!(((p.amount).amount >= BigDecimal("0.00")))) return Left("ACCOUNT_SEED_NONNEGATIVE")
    Right(Vector(AccountInitialized(p.resource, p.currency, p.amount)))
  }
  def ReserveFunds(state: State, p: ReserveFundsParams, hosts: CreditBalanceComputations): Either[String, Vector[Event]] = {
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedOutgoing).contains(p.txid)) || { require(((state.committedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDOUTGOING_MATCH")
    if (!((!((state.compensatedOutgoing).contains(p.txid)) || { require(((state.compensatedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDOUTGOING_MATCH")
    if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
    if (((state.committedOutgoing).contains(p.txid))) return Right(Vector.empty)
    if (((state.compensatedOutgoing).contains(p.txid))) return Right(Vector.empty)
    if (((state.reservedAmount).contains(p.txid))) return Right(Vector.empty)
    if (!((state.accountBalance).get((p.amount).currency).exists(_.compareSameUnit(p.amount) >= 0))) return Left("LEDGER_SUFFICIENT")
    Right(Vector(ReserveFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReserveFunds(state, p))))
  }
  def DeductFunds(state: State, p: DeductFundsParams, hosts: CreditBalanceComputations): Either[String, Vector[Event]] = {
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedOutgoing).contains(p.txid)) || { require(((state.committedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDOUTGOING_MATCH")
    if (((state.committedOutgoing).contains(p.txid))) return Right(Vector.empty)
    if (((state.compensatedOutgoing).contains(p.txid))) return Left("LEDGER_NOT_COMPENSATED")
    if (!((state.reservedAmount).contains(p.txid))) return Left("LEDGER_PREPARED")
    if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
    Right(Vector(DeductFundsConfirmed(p.txid, p.resource, p.amount)))
  }
  def ReleaseReservedFunds(state: State, p: ReleaseReservedFundsParams, hosts: CreditBalanceComputations): Either[String, Vector[Event]] = {
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.compensatedOutgoing).contains(p.txid)) || { require(((state.compensatedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDOUTGOING_MATCH")
    if (((state.compensatedOutgoing).contains(p.txid))) return Right(Vector.empty)
    if (((state.committedOutgoing).contains(p.txid))) return Left("LEDGER_NOT_COMMITTED")
    if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
    Right(Vector(ReleaseReservedFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReleaseReservedFunds(state, p))))
  }
  def RecordIncomingCredits(state: State, p: RecordIncomingCreditsParams, hosts: CreditBalanceComputations): Either[String, Vector[Event]] = {
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedIncoming).contains(p.txid)) || { require(((state.committedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDINCOMING_MATCH")
    if (!((!((state.compensatedIncoming).contains(p.txid)) || { require(((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDINCOMING_MATCH")
    if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_INCOMINGCREDITS_MATCH")
    if (((state.committedIncoming).contains(p.txid))) return Right(Vector.empty)
    if (((state.compensatedIncoming).contains(p.txid))) return Right(Vector.empty)
    if (((state.incomingCredits).contains(p.txid))) return Right(Vector.empty)
    Right(Vector(RecordIncomingCreditsConfirmed(p.txid, p.resource, p.amount)))
  }
  def CommitIncomingCredits(state: State, p: CommitIncomingCreditsParams, hosts: CreditBalanceComputations): Either[String, Vector[Event]] = {
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedIncoming).contains(p.txid)) || { require(((state.committedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDINCOMING_MATCH")
    if (((state.committedIncoming).contains(p.txid))) return Right(Vector.empty)
    if (((state.compensatedIncoming).contains(p.txid))) return Left("LEDGER_NOT_COMPENSATED")
    if (!((state.incomingCredits).contains(p.txid))) return Left("LEDGER_PREPARED")
    if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_INCOMINGCREDITS_MATCH")
    Right(Vector(CommitIncomingCreditsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterCommitIncomingCredits(state, p))))
  }
  def CancelIncomingCredit(state: State, p: CancelIncomingCreditParams, hosts: CreditBalanceComputations): Either[String, Vector[Event]] = {
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.compensatedIncoming).contains(p.txid)) || { require(((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDINCOMING_MATCH")
    if (((state.compensatedIncoming).contains(p.txid))) return Right(Vector.empty)
    if (((state.committedIncoming).contains(p.txid))) return Left("LEDGER_NOT_COMMITTED")
    if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_INCOMINGCREDITS_MATCH")
    Right(Vector(CancelIncomingCreditConfirmed(p.txid, p.resource, p.amount)))
  }
}
