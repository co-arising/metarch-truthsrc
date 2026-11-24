package example.bankwealth.domain.invariant

import example.bankwealth.domain._
import example.bankwealth.domain.invariant.params.CreditBalanceRuleParams._
import example.bankwealth.domain.CreditBalanceProtocol._

object CreditBalanceRules {
  def InitializeAccount(input: InitializeAccountParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!((p.resource == state.id))) return Left("ACCOUNT_ID")
    if (!(((p.currency == "CNY") && ((p.amount).currency == p.currency)))) return Left("ACCOUNT_CURRENCY")
    if (!((!(state.initialized) || ((state.accountBalance).get(p.currency)).contains(p.amount)))) return Left("ACCOUNT_INIT_CONFLICT")
    if ((state.initialized)) return Right(Vector.empty)
    if (!(((p.amount).amount >= BigDecimal("0.00")))) return Left("ACCOUNT_SEED_NONNEGATIVE")
    Right(CreditBalanceCommandHelpers.emitInitializeAccount(state, p, hosts))
  }
  def ReserveFunds(input: ReserveFundsParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
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
    Right(CreditBalanceCommandHelpers.emitReserveFunds(state, p, hosts))
  }
  def DeductFunds(input: DeductFundsParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedOutgoing).contains(p.txid)) || { require(((state.committedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDOUTGOING_MATCH")
    if (((state.committedOutgoing).contains(p.txid))) return Right(Vector.empty)
    if (((state.compensatedOutgoing).contains(p.txid))) return Left("LEDGER_NOT_COMPENSATED")
    if (!((state.reservedAmount).contains(p.txid))) return Left("LEDGER_PREPARED")
    if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
    Right(CreditBalanceCommandHelpers.emitDeductFunds(state, p, hosts))
  }
  def ReleaseReservedFunds(input: ReleaseReservedFundsParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.compensatedOutgoing).contains(p.txid)) || { require(((state.compensatedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDOUTGOING_MATCH")
    if (((state.compensatedOutgoing).contains(p.txid))) return Right(Vector.empty)
    if (((state.committedOutgoing).contains(p.txid))) return Left("LEDGER_NOT_COMMITTED")
    if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
    Right(CreditBalanceCommandHelpers.emitReleaseReservedFunds(state, p, hosts))
  }
  def RecordIncomingCredits(input: RecordIncomingCreditsParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedIncoming).contains(p.txid)) || { require(((state.committedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDINCOMING_MATCH")
    if (!((!((state.compensatedIncoming).contains(p.txid)) || { require(((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDINCOMING_MATCH")
    if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_INCOMINGCREDITS_MATCH")
    if (((state.committedIncoming).contains(p.txid))) return Right(Vector.empty)
    if (((state.compensatedIncoming).contains(p.txid))) return Right(Vector.empty)
    if (((state.incomingCredits).contains(p.txid))) return Right(Vector.empty)
    Right(CreditBalanceCommandHelpers.emitRecordIncomingCredits(state, p, hosts))
  }
  def CommitIncomingCredits(input: CommitIncomingCreditsParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedIncoming).contains(p.txid)) || { require(((state.committedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDINCOMING_MATCH")
    if (((state.committedIncoming).contains(p.txid))) return Right(Vector.empty)
    if (((state.compensatedIncoming).contains(p.txid))) return Left("LEDGER_NOT_COMPENSATED")
    if (!((state.incomingCredits).contains(p.txid))) return Left("LEDGER_PREPARED")
    if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_INCOMINGCREDITS_MATCH")
    Right(CreditBalanceCommandHelpers.emitCommitIncomingCredits(state, p, hosts))
  }
  def CancelIncomingCredit(input: CancelIncomingCreditParams): Either[String, Vector[Event]] = {
    import input.{state, command => p, hosts}
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.compensatedIncoming).contains(p.txid)) || { require(((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDINCOMING_MATCH")
    if (((state.compensatedIncoming).contains(p.txid))) return Right(Vector.empty)
    if (((state.committedIncoming).contains(p.txid))) return Left("LEDGER_NOT_COMMITTED")
    if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_INCOMINGCREDITS_MATCH")
    Right(CreditBalanceCommandHelpers.emitCancelIncomingCredit(state, p, hosts))
  }
}
