package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.CreditBalanceProtocol._
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.invariants.CreditBalanceRules
import example.bankwealth.domain.services.CreditBalanceComputations

object CreditBalanceBehaviors extends CreditBalanceCommandHelpers {

  def apply(hosts: CreditBalanceComputations): CommandHandler = (state, command) =>
    queryBehavior
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(replyTo) =>
      Effect.none.thenRun((s: State) => replyTo ! s)
  }

  private def executionBehavior(state: State, hosts: CreditBalanceComputations): PartialFunction[Command, Effect[Event, State]] = {
    case cmd: InitializeAccount =>
      replyEffect(CreditBalanceRules.InitializeAccount(state, toInitializeAccountParams(cmd), hosts), cmd.replyTo)
    case cmd: ReserveFunds =>
      replyEffect(CreditBalanceRules.ReserveFunds(state, toReserveFundsParams(cmd), hosts), cmd.replyTo)
    case cmd: DeductFunds =>
      replyEffect(CreditBalanceRules.DeductFunds(state, toDeductFundsParams(cmd), hosts), cmd.replyTo)
    case cmd: ReleaseReservedFunds =>
      replyEffect(CreditBalanceRules.ReleaseReservedFunds(state, toReleaseReservedFundsParams(cmd), hosts), cmd.replyTo)
    case cmd: RecordIncomingCredits =>
      replyEffect(CreditBalanceRules.RecordIncomingCredits(state, toRecordIncomingCreditsParams(cmd), hosts), cmd.replyTo)
    case cmd: CommitIncomingCredits =>
      replyEffect(CreditBalanceRules.CommitIncomingCredits(state, toCommitIncomingCreditsParams(cmd), hosts), cmd.replyTo)
    case cmd: CancelIncomingCredit =>
      replyEffect(CreditBalanceRules.CancelIncomingCredit(state, toCancelIncomingCreditParams(cmd), hosts), cmd.replyTo)
  }
}
