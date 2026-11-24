package example.bankwealth.application.aggregates

import akka.actor.typed.{ActorRef, Behavior}
import example.bankwealth.application.aggregates.SipPlanProtocol.CommandHandler
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.events.SipPlanEvents
import example.bankwealth.domain.services.SipPlanComputations

object SipPlanAggregate {
  sealed trait Request
  final case class Execute(command: SipPlanEvents.Command, replyTo: ActorRef[Reply]) extends Request
  final case class GetState(replyTo: ActorRef[State]) extends Request
  sealed trait Reply
  final case class Accepted(events: Vector[Event]) extends Reply
  final case class Refused(code: String) extends Reply

  def commandHandler(hosts: SipPlanComputations): CommandHandler =
    behaviors.SipPlanBehaviors(hosts)

  def apply(persistenceId: String, initial: State, hosts: SipPlanComputations): Behavior[Request] =
    example.bankwealth.infrastructure.bootstrap.SipPlanBootstrap.create(persistenceId, initial, hosts)
}
