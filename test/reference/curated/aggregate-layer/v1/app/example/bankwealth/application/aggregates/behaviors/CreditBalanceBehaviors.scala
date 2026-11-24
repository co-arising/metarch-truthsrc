package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.CreditBalanceProtocol._
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.{CreditBalanceComputations, CreditBalanceProtocol => Payload, CreditBalanceRules}

object CreditBalanceBehaviors {

  def apply(hosts: CreditBalanceComputations): CommandHandler = (state, command) =>
    queryBehavior
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(reply) =>
      Effect.none.thenRun((s: State) => reply ! s)
  }

  private def executionBehavior(state: State, hosts: CreditBalanceComputations): PartialFunction[Command, Effect[Event, State]] = {
    case Execute(command, reply) =>
      val decision = command match {
        case p: Payload.InitializeAccount =>
          CreditBalanceRules.InitializeAccount(state, p, hosts)
        case p: Payload.ReserveFunds =>
          CreditBalanceRules.ReserveFunds(state, p, hosts)
        case p: Payload.DeductFunds =>
          CreditBalanceRules.DeductFunds(state, p, hosts)
        case p: Payload.ReleaseReservedFunds =>
          CreditBalanceRules.ReleaseReservedFunds(state, p, hosts)
        case p: Payload.RecordIncomingCredits =>
          CreditBalanceRules.RecordIncomingCredits(state, p, hosts)
        case p: Payload.CommitIncomingCredits =>
          CreditBalanceRules.CommitIncomingCredits(state, p, hosts)
        case p: Payload.CancelIncomingCredit =>
          CreditBalanceRules.CancelIncomingCredit(state, p, hosts)
      }

      decision match {
        case Left(code) =>
          Effect.none.thenRun((_: State) => reply ! Refused(code))
        case Right(events) =>
          Effect.persist(events).thenRun((_: State) => reply ! Accepted(events))
      }
  }
}
