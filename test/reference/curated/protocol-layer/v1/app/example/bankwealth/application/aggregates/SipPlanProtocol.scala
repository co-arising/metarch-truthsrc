package example.bankwealth.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}

object SipPlanProtocol {

  type Command = example.bankwealth.domain.SipPlanAggregate.Request
  type Reply = example.bankwealth.domain.SipPlanAggregate.Reply
  type CommandPayload = example.bankwealth.domain.SipPlanProtocol.Command
  type CommandHandler = (State, Command) => Effect[Event, State]

  type Execute = example.bankwealth.domain.SipPlanAggregate.Execute
  val Execute: example.bankwealth.domain.SipPlanAggregate.Execute.type =
    example.bankwealth.domain.SipPlanAggregate.Execute

  type GetState = example.bankwealth.domain.SipPlanAggregate.GetState
  val GetState: example.bankwealth.domain.SipPlanAggregate.GetState.type =
    example.bankwealth.domain.SipPlanAggregate.GetState

  type Accepted = example.bankwealth.domain.SipPlanAggregate.Accepted
  val Accepted: example.bankwealth.domain.SipPlanAggregate.Accepted.type =
    example.bankwealth.domain.SipPlanAggregate.Accepted

  type Refused = example.bankwealth.domain.SipPlanAggregate.Refused
  val Refused: example.bankwealth.domain.SipPlanAggregate.Refused.type =
    example.bankwealth.domain.SipPlanAggregate.Refused
}
