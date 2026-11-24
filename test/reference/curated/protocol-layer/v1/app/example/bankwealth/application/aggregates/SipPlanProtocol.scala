package example.bankwealth.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.events.SipPlanEvents

object SipPlanProtocol {

  type Command = SipPlanAggregate.Request
  type Reply = SipPlanAggregate.Reply
  type CommandPayload = SipPlanEvents.Command
  type CommandHandler = (State, Command) => Effect[Event, State]

  type Execute = SipPlanAggregate.Execute
  val Execute: SipPlanAggregate.Execute.type =
    SipPlanAggregate.Execute

  type GetState = SipPlanAggregate.GetState
  val GetState: SipPlanAggregate.GetState.type =
    SipPlanAggregate.GetState

  type Accepted = SipPlanAggregate.Accepted
  val Accepted: SipPlanAggregate.Accepted.type =
    SipPlanAggregate.Accepted

  type Refused = SipPlanAggregate.Refused
  val Refused: SipPlanAggregate.Refused.type =
    SipPlanAggregate.Refused
}
