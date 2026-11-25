package example.bankwealth.domain.invariants

import example.bankwealth.domain.entities.CreditBalanceEntity._
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._
import example.bankwealth.domain.services.CreditBalanceComputations
import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}

object CreditBalanceRules {
  // @knowledge source:bank-v1#/aggregates/0/commands/0
  final class InitializeAccountRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, InitializeAccountParams] {
    override def apply(state: State, p: InitializeAccountParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/0/commands/0/guards/0
      if (!((p.resource == state.id))) Left(iMadzError("ACCOUNT_ID", "ACCOUNT_ID"))
      // @knowledge source:bank-v1#/aggregates/0/commands/0/guards/1
      else if (!(((p.currency == "CNY") && ((p.amount).currency == p.currency)))) Left(iMadzError("ACCOUNT_CURRENCY", "ACCOUNT_CURRENCY"))
      // @knowledge source:bank-v1#/aggregates/0/commands/0/guards/2
      else if (!((!(state.initialized) || ((state.accountBalance).get(p.currency)).contains(p.amount)))) Left(iMadzError("ACCOUNT_INIT_CONFLICT", "ACCOUNT_INIT_CONFLICT"))
      // @knowledge source:bank-v1#/aggregates/0/commands/0/guards/3
      else if ((state.initialized)) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/0/guards/4
      else if (!(((p.amount).amount >= BigDecimal("0.00")))) Left(iMadzError("ACCOUNT_SEED_NONNEGATIVE", "ACCOUNT_SEED_NONNEGATIVE"))
      else Right(List(AccountInitialized(p.resource, p.currency, p.amount)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/0/commands/1
  final class ReserveFundsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, ReserveFundsParams] {
    override def apply(state: State, p: ReserveFundsParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/0
      if (!((state.initialized && (p.resource == state.id)))) Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/1
      else if (!(((p.amount).currency == "CNY"))) Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/2
      else if (!(((p.amount).amount > BigDecimal("0.00")))) Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/3
      else if (!((!((state.committedOutgoing).contains(p.txid)) || ((((state.committedOutgoing)(p.txid)).currency == (p.amount).currency) && (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_COMMITTEDOUTGOING_MATCH", "LEDGER_COMMITTEDOUTGOING_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/4
      else if (!((!((state.compensatedOutgoing).contains(p.txid)) || ((((state.compensatedOutgoing)(p.txid)).currency == (p.amount).currency) && (((state.compensatedOutgoing)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_COMPENSATEDOUTGOING_MATCH", "LEDGER_COMPENSATEDOUTGOING_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/5
      else if (!((!((state.reservedAmount).contains(p.txid)) || ((((state.reservedAmount)(p.txid)).currency == (p.amount).currency) && (((state.reservedAmount)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_RESERVEDAMOUNT_MATCH", "LEDGER_RESERVEDAMOUNT_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/6
      else if (((state.committedOutgoing).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/7
      else if (((state.compensatedOutgoing).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/8
      else if (((state.reservedAmount).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/1/guards/9
      else if (!((state.accountBalance).get((p.amount).currency).exists(_.compareSameUnit(p.amount).exists(_ >= 0)))) Left(iMadzError("LEDGER_SUFFICIENT", "LEDGER_SUFFICIENT"))
      else for {
        balanceAfterReserveFunds <- hosts.balanceAfterReserveFunds(state, p)
      } yield List(ReserveFundsConfirmed(p.txid, p.resource, p.amount, "CNY", balanceAfterReserveFunds))
    }
  }
  // @knowledge source:bank-v1#/aggregates/0/commands/2
  final class DeductFundsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, DeductFundsParams] {
    override def apply(state: State, p: DeductFundsParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/0/commands/2/guards/0
      if (!((state.initialized && (p.resource == state.id)))) Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/2/guards/1
      else if (!(((p.amount).currency == "CNY"))) Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      // @knowledge source:bank-v1#/aggregates/0/commands/2/guards/2
      else if (!(((p.amount).amount > BigDecimal("0.00")))) Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/2/guards/3
      else if (!((!((state.committedOutgoing).contains(p.txid)) || ((((state.committedOutgoing)(p.txid)).currency == (p.amount).currency) && (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_COMMITTEDOUTGOING_MATCH", "LEDGER_COMMITTEDOUTGOING_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/2/guards/4
      else if (((state.committedOutgoing).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/2/guards/5
      else if (((state.compensatedOutgoing).contains(p.txid))) Left(iMadzError("LEDGER_NOT_COMPENSATED", "LEDGER_NOT_COMPENSATED"))
      // @knowledge source:bank-v1#/aggregates/0/commands/2/guards/6
      else if (!((state.reservedAmount).contains(p.txid))) Left(iMadzError("LEDGER_PREPARED", "LEDGER_PREPARED"))
      // @knowledge source:bank-v1#/aggregates/0/commands/2/guards/7
      else if (!((!((state.reservedAmount).contains(p.txid)) || ((((state.reservedAmount)(p.txid)).currency == (p.amount).currency) && (((state.reservedAmount)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_RESERVEDAMOUNT_MATCH", "LEDGER_RESERVEDAMOUNT_MATCH"))
      else Right(List(DeductFundsConfirmed(p.txid, p.resource, p.amount)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/0/commands/3
  final class ReleaseReservedFundsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, ReleaseReservedFundsParams] {
    override def apply(state: State, p: ReleaseReservedFundsParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/0/commands/3/guards/0
      if (!((state.initialized && (p.resource == state.id)))) Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/3/guards/1
      else if (!(((p.amount).currency == "CNY"))) Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      // @knowledge source:bank-v1#/aggregates/0/commands/3/guards/2
      else if (!(((p.amount).amount > BigDecimal("0.00")))) Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/3/guards/3
      else if (!((!((state.compensatedOutgoing).contains(p.txid)) || ((((state.compensatedOutgoing)(p.txid)).currency == (p.amount).currency) && (((state.compensatedOutgoing)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_COMPENSATEDOUTGOING_MATCH", "LEDGER_COMPENSATEDOUTGOING_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/3/guards/4
      else if (((state.compensatedOutgoing).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/3/guards/5
      else if (((state.committedOutgoing).contains(p.txid))) Left(iMadzError("LEDGER_NOT_COMMITTED", "LEDGER_NOT_COMMITTED"))
      // @knowledge source:bank-v1#/aggregates/0/commands/3/guards/6
      else if (!((!((state.reservedAmount).contains(p.txid)) || ((((state.reservedAmount)(p.txid)).currency == (p.amount).currency) && (((state.reservedAmount)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_RESERVEDAMOUNT_MATCH", "LEDGER_RESERVEDAMOUNT_MATCH"))
      else for {
        balanceAfterReleaseReservedFunds <- hosts.balanceAfterReleaseReservedFunds(state, p)
      } yield List(ReleaseReservedFundsConfirmed(p.txid, p.resource, p.amount, "CNY", balanceAfterReleaseReservedFunds))
    }
  }
  // @knowledge source:bank-v1#/aggregates/0/commands/4
  final class RecordIncomingCreditsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, RecordIncomingCreditsParams] {
    override def apply(state: State, p: RecordIncomingCreditsParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/0/commands/4/guards/0
      if (!((state.initialized && (p.resource == state.id)))) Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/4/guards/1
      else if (!(((p.amount).currency == "CNY"))) Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      // @knowledge source:bank-v1#/aggregates/0/commands/4/guards/2
      else if (!(((p.amount).amount > BigDecimal("0.00")))) Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/4/guards/3
      else if (!((!((state.committedIncoming).contains(p.txid)) || ((((state.committedIncoming)(p.txid)).currency == (p.amount).currency) && (((state.committedIncoming)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_COMMITTEDINCOMING_MATCH", "LEDGER_COMMITTEDINCOMING_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/4/guards/4
      else if (!((!((state.compensatedIncoming).contains(p.txid)) || ((((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency) && (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_COMPENSATEDINCOMING_MATCH", "LEDGER_COMPENSATEDINCOMING_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/4/guards/5
      else if (!((!((state.incomingCredits).contains(p.txid)) || ((((state.incomingCredits)(p.txid)).currency == (p.amount).currency) && (((state.incomingCredits)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_INCOMINGCREDITS_MATCH", "LEDGER_INCOMINGCREDITS_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/4/guards/6
      else if (((state.committedIncoming).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/4/guards/7
      else if (((state.compensatedIncoming).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/4/guards/8
      else if (((state.incomingCredits).contains(p.txid))) Right(Nil)
      else Right(List(RecordIncomingCreditsConfirmed(p.txid, p.resource, p.amount)))
    }
  }
  // @knowledge source:bank-v1#/aggregates/0/commands/5
  final class CommitIncomingCreditsRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, CommitIncomingCreditsParams] {
    override def apply(state: State, p: CommitIncomingCreditsParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/0/commands/5/guards/0
      if (!((state.initialized && (p.resource == state.id)))) Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/5/guards/1
      else if (!(((p.amount).currency == "CNY"))) Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      // @knowledge source:bank-v1#/aggregates/0/commands/5/guards/2
      else if (!(((p.amount).amount > BigDecimal("0.00")))) Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/5/guards/3
      else if (!((!((state.committedIncoming).contains(p.txid)) || ((((state.committedIncoming)(p.txid)).currency == (p.amount).currency) && (((state.committedIncoming)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_COMMITTEDINCOMING_MATCH", "LEDGER_COMMITTEDINCOMING_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/5/guards/4
      else if (((state.committedIncoming).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/5/guards/5
      else if (((state.compensatedIncoming).contains(p.txid))) Left(iMadzError("LEDGER_NOT_COMPENSATED", "LEDGER_NOT_COMPENSATED"))
      // @knowledge source:bank-v1#/aggregates/0/commands/5/guards/6
      else if (!((state.incomingCredits).contains(p.txid))) Left(iMadzError("LEDGER_PREPARED", "LEDGER_PREPARED"))
      // @knowledge source:bank-v1#/aggregates/0/commands/5/guards/7
      else if (!((!((state.incomingCredits).contains(p.txid)) || ((((state.incomingCredits)(p.txid)).currency == (p.amount).currency) && (((state.incomingCredits)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_INCOMINGCREDITS_MATCH", "LEDGER_INCOMINGCREDITS_MATCH"))
      else for {
        balanceAfterCommitIncomingCredits <- hosts.balanceAfterCommitIncomingCredits(state, p)
      } yield List(CommitIncomingCreditsConfirmed(p.txid, p.resource, p.amount, "CNY", balanceAfterCommitIncomingCredits))
    }
  }
  // @knowledge source:bank-v1#/aggregates/0/commands/6
  final class CancelIncomingCreditRule(hosts: CreditBalanceComputations)
      extends InvariantRule[Event, State, CancelIncomingCreditParams] {
    override def apply(state: State, p: CancelIncomingCreditParams): Either[iMadzError, List[Event]] = {
      // @knowledge source:bank-v1#/aggregates/0/commands/6/guards/0
      if (!((state.initialized && (p.resource == state.id)))) Left(iMadzError("LEDGER_RESOURCE", "LEDGER_RESOURCE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/6/guards/1
      else if (!(((p.amount).currency == "CNY"))) Left(iMadzError("LEDGER_CNY", "LEDGER_CNY"))
      // @knowledge source:bank-v1#/aggregates/0/commands/6/guards/2
      else if (!(((p.amount).amount > BigDecimal("0.00")))) Left(iMadzError("LEDGER_POSITIVE", "LEDGER_POSITIVE"))
      // @knowledge source:bank-v1#/aggregates/0/commands/6/guards/3
      else if (!((!((state.compensatedIncoming).contains(p.txid)) || ((((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency) && (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_COMPENSATEDINCOMING_MATCH", "LEDGER_COMPENSATEDINCOMING_MATCH"))
      // @knowledge source:bank-v1#/aggregates/0/commands/6/guards/4
      else if (((state.compensatedIncoming).contains(p.txid))) Right(Nil)
      // @knowledge source:bank-v1#/aggregates/0/commands/6/guards/5
      else if (((state.committedIncoming).contains(p.txid))) Left(iMadzError("LEDGER_NOT_COMMITTED", "LEDGER_NOT_COMMITTED"))
      // @knowledge source:bank-v1#/aggregates/0/commands/6/guards/6
      else if (!((!((state.incomingCredits).contains(p.txid)) || ((((state.incomingCredits)(p.txid)).currency == (p.amount).currency) && (((state.incomingCredits)(p.txid)).amount == (p.amount).amount))))) Left(iMadzError("LEDGER_INCOMINGCREDITS_MATCH", "LEDGER_INCOMINGCREDITS_MATCH"))
      else Right(List(CancelIncomingCreditConfirmed(p.txid, p.resource, p.amount)))
    }
  }

  def checkEventPostconditions(events: List[Event]): Option[iMadzError] = None
}
