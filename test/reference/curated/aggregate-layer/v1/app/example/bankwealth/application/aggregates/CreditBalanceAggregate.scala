package example.bankwealth.application.aggregates

import akka.actor.typed.{ActorRef, Behavior}
import example.bankwealth.application.aggregates.CreditBalanceProtocol.CommandHandler
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.events.CreditBalanceEvents
import example.bankwealth.domain.services.CreditBalanceComputations

object CreditBalanceAggregate {
  sealed trait Request
  final case class Execute(command: CreditBalanceEvents.Command, replyTo: ActorRef[Reply]) extends Request
  final case class GetState(replyTo: ActorRef[State]) extends Request
  sealed trait Reply
  final case class Accepted(events: Vector[Event]) extends Reply
  final case class Refused(code: String) extends Reply

  def commandHandler(hosts: CreditBalanceComputations): CommandHandler =
    behaviors.CreditBalanceBehaviors(hosts)

  def apply(persistenceId: String, initial: State, hosts: CreditBalanceComputations): Behavior[Request] =
    example.bankwealth.infrastructure.bootstrap.CreditBalanceBootstrap.create(persistenceId, initial, hosts)
}
