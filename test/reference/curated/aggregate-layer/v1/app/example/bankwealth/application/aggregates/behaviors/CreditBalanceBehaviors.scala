package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.CreditBalanceProtocol._
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.invariants.CreditBalanceRules
import example.bankwealth.domain.services.CreditBalanceComputations
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy

object CreditBalanceBehaviors extends CreditBalanceCommandHelpers {

  def apply(hosts: CreditBalanceComputations): CommandHandler = (state, command) =>
    queryBehavior(state)
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def queryBehavior(state: State): PartialFunction[Command, Effect[Event, State]] = {
    case GetState(replyTo) =>
      Effect.reply(replyTo)(state)
  }

  private def executionBehavior(state: State, hosts: CreditBalanceComputations): PartialFunction[Command, Effect[Event, State]] = {
    case cmd: InitializeAccount =>
      runReplyingPolicy(new CreditBalanceRules.InitializeAccountRule(hosts), InitializeAccountHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: ReserveFunds =>
      runReplyingPolicy(new CreditBalanceRules.ReserveFundsRule(hosts), ReserveFundsHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: DeductFunds =>
      runReplyingPolicy(new CreditBalanceRules.DeductFundsRule(hosts), DeductFundsHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: ReleaseReservedFunds =>
      runReplyingPolicy(new CreditBalanceRules.ReleaseReservedFundsRule(hosts), ReleaseReservedFundsHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: RecordIncomingCredits =>
      runReplyingPolicy(new CreditBalanceRules.RecordIncomingCreditsRule(hosts), RecordIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: CommitIncomingCredits =>
      runReplyingPolicy(new CreditBalanceRules.CommitIncomingCreditsRule(hosts), CommitIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: CancelIncomingCredit =>
      runReplyingPolicy(new CreditBalanceRules.CancelIncomingCreditRule(hosts), CancelIncomingCreditHelper)(state, cmd).replyWith(cmd.replyTo)
  }
}
