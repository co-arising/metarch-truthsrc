package example.bankwealth.domain.invariants

import example.bankwealth.domain.entities.CreditBalanceEntity._
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._
import example.bankwealth.domain.services.CreditBalanceComputations
import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}

object CreditBalanceRules {
  final class InitializeAccountRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, InitializeAccountParams] {
    override def apply(state: State, p: InitializeAccountParams): Either[iMadzError, List[Event]] = {
      if (!((p.resource == state.id))) return Left(iMadzError("ACCOUNT_ID", "ACCOUNT_ID"))
      if (!(((p.currency == "CNY") && ((p.amount).currency == p.currency)))) return Left(iMadzError("ACCOUNT_CURRENCY", "ACCOUNT_CURRENCY"))
      if (!((!(state.initialized) || ((state.accountBalance).get(p.currency)).contains(p.amount)))) return Left(iMadzError("ACCOUNT_INIT_CONFLICT", "ACCOUNT_INIT_CONFLICT"))
      if ((state.initialized)) return Right(Nil)
      if (!(((p.amount).amount >= BigDecimal("0.00")))) return Left(iMadzError("ACCOUNT_SEED_NONNEGATIVE", "ACCOUNT_SEED_NONNEGATIVE"))
      Right(List(AccountInitialized(p.resource, p.currency, p.amount)))
    }
  }
  final class ReserveFundsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, ReserveFundsParams] {
    override def apply(state: State, p: ReserveFundsParams): Either[iMadzError, List[Event]] = {
      if (!((state.initialized && (p.resource == state.id)))) return Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      if (!(((p.amount).currency == "CNY"))) return Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      if (!(((p.amount).amount > BigDecimal("0.00")))) return Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      if (!((!((state.committedOutgoing).contains(p.txid)) || { require(((state.committedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_COMMITTEDOUTGOING_MATCH", "LEDGER_COMMITTEDOUTGOING_MATCH"))
      if (!((!((state.compensatedOutgoing).contains(p.txid)) || { require(((state.compensatedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_COMPENSATEDOUTGOING_MATCH", "LEDGER_COMPENSATEDOUTGOING_MATCH"))
      if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_RESERVEDAMOUNT_MATCH", "LEDGER_RESERVEDAMOUNT_MATCH"))
      if (((state.committedOutgoing).contains(p.txid))) return Right(Nil)
      if (((state.compensatedOutgoing).contains(p.txid))) return Right(Nil)
      if (((state.reservedAmount).contains(p.txid))) return Right(Nil)
      if (!((state.accountBalance).get((p.amount).currency).exists(_.compareSameUnit(p.amount) >= 0))) return Left(iMadzError("LEDGER_SUFFICIENT", "LEDGER_SUFFICIENT"))
      Right(List(ReserveFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReserveFunds(state, p))))
    }
  }
  final class DeductFundsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, DeductFundsParams] {
    override def apply(state: State, p: DeductFundsParams): Either[iMadzError, List[Event]] = {
      if (!((state.initialized && (p.resource == state.id)))) return Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      if (!(((p.amount).currency == "CNY"))) return Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      if (!(((p.amount).amount > BigDecimal("0.00")))) return Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      if (!((!((state.committedOutgoing).contains(p.txid)) || { require(((state.committedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_COMMITTEDOUTGOING_MATCH", "LEDGER_COMMITTEDOUTGOING_MATCH"))
      if (((state.committedOutgoing).contains(p.txid))) return Right(Nil)
      if (((state.compensatedOutgoing).contains(p.txid))) return Left(iMadzError("LEDGER_NOT_COMPENSATED", "LEDGER_NOT_COMPENSATED"))
      if (!((state.reservedAmount).contains(p.txid))) return Left(iMadzError("LEDGER_PREPARED", "LEDGER_PREPARED"))
      if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_RESERVEDAMOUNT_MATCH", "LEDGER_RESERVEDAMOUNT_MATCH"))
      Right(List(DeductFundsConfirmed(p.txid, p.resource, p.amount)))
    }
  }
  final class ReleaseReservedFundsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, ReleaseReservedFundsParams] {
    override def apply(state: State, p: ReleaseReservedFundsParams): Either[iMadzError, List[Event]] = {
      if (!((state.initialized && (p.resource == state.id)))) return Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      if (!(((p.amount).currency == "CNY"))) return Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      if (!(((p.amount).amount > BigDecimal("0.00")))) return Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      if (!((!((state.compensatedOutgoing).contains(p.txid)) || { require(((state.compensatedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_COMPENSATEDOUTGOING_MATCH", "LEDGER_COMPENSATEDOUTGOING_MATCH"))
      if (((state.compensatedOutgoing).contains(p.txid))) return Right(Nil)
      if (((state.committedOutgoing).contains(p.txid))) return Left(iMadzError("LEDGER_NOT_COMMITTED", "LEDGER_NOT_COMMITTED"))
      if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_RESERVEDAMOUNT_MATCH", "LEDGER_RESERVEDAMOUNT_MATCH"))
      Right(List(ReleaseReservedFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReleaseReservedFunds(state, p))))
    }
  }
  final class RecordIncomingCreditsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, RecordIncomingCreditsParams] {
    override def apply(state: State, p: RecordIncomingCreditsParams): Either[iMadzError, List[Event]] = {
      if (!((state.initialized && (p.resource == state.id)))) return Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      if (!(((p.amount).currency == "CNY"))) return Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      if (!(((p.amount).amount > BigDecimal("0.00")))) return Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      if (!((!((state.committedIncoming).contains(p.txid)) || { require(((state.committedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_COMMITTEDINCOMING_MATCH", "LEDGER_COMMITTEDINCOMING_MATCH"))
      if (!((!((state.compensatedIncoming).contains(p.txid)) || { require(((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_COMPENSATEDINCOMING_MATCH", "LEDGER_COMPENSATEDINCOMING_MATCH"))
      if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_INCOMINGCREDITS_MATCH", "LEDGER_INCOMINGCREDITS_MATCH"))
      if (((state.committedIncoming).contains(p.txid))) return Right(Nil)
      if (((state.compensatedIncoming).contains(p.txid))) return Right(Nil)
      if (((state.incomingCredits).contains(p.txid))) return Right(Nil)
      Right(List(RecordIncomingCreditsConfirmed(p.txid, p.resource, p.amount)))
    }
  }
  final class CommitIncomingCreditsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, CommitIncomingCreditsParams] {
    override def apply(state: State, p: CommitIncomingCreditsParams): Either[iMadzError, List[Event]] = {
      if (!((state.initialized && (p.resource == state.id)))) return Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      if (!(((p.amount).currency == "CNY"))) return Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      if (!(((p.amount).amount > BigDecimal("0.00")))) return Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      if (!((!((state.committedIncoming).contains(p.txid)) || { require(((state.committedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_COMMITTEDINCOMING_MATCH", "LEDGER_COMMITTEDINCOMING_MATCH"))
      if (((state.committedIncoming).contains(p.txid))) return Right(Nil)
      if (((state.compensatedIncoming).contains(p.txid))) return Left(iMadzError("LEDGER_NOT_COMPENSATED", "LEDGER_NOT_COMPENSATED"))
      if (!((state.incomingCredits).contains(p.txid))) return Left(iMadzError("LEDGER_PREPARED", "LEDGER_PREPARED"))
      if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_INCOMINGCREDITS_MATCH", "LEDGER_INCOMINGCREDITS_MATCH"))
      Right(List(CommitIncomingCreditsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterCommitIncomingCredits(state, p))))
    }
  }
  final class CancelIncomingCreditRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, CancelIncomingCreditParams] {
    override def apply(state: State, p: CancelIncomingCreditParams): Either[iMadzError, List[Event]] = {
      if (!((state.initialized && (p.resource == state.id)))) return Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      if (!(((p.amount).currency == "CNY"))) return Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      if (!(((p.amount).amount > BigDecimal("0.00")))) return Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      if (!((!((state.compensatedIncoming).contains(p.txid)) || { require(((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_COMPENSATEDINCOMING_MATCH", "LEDGER_COMPENSATEDINCOMING_MATCH"))
      if (((state.compensatedIncoming).contains(p.txid))) return Right(Nil)
      if (((state.committedIncoming).contains(p.txid))) return Left(iMadzError("LEDGER_NOT_COMMITTED", "LEDGER_NOT_COMMITTED"))
      if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left(iMadzError("LEDGER_INCOMINGCREDITS_MATCH", "LEDGER_INCOMINGCREDITS_MATCH"))
      Right(List(CancelIncomingCreditConfirmed(p.txid, p.resource, p.amount)))
    }
  }
}
