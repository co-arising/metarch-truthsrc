package example.bankwealth.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.events.CreditBalanceEvents

object CreditBalanceProtocol {

  type Command = CreditBalanceAggregate.Request
  type Reply = CreditBalanceAggregate.Reply
  type CommandPayload = CreditBalanceEvents.Command
  type CommandHandler = (State, Command) => Effect[Event, State]

  type Execute = CreditBalanceAggregate.Execute
  val Execute: CreditBalanceAggregate.Execute.type =
    CreditBalanceAggregate.Execute

  type GetState = CreditBalanceAggregate.GetState
  val GetState: CreditBalanceAggregate.GetState.type =
    CreditBalanceAggregate.GetState

  type Accepted = CreditBalanceAggregate.Accepted
  val Accepted: CreditBalanceAggregate.Accepted.type =
    CreditBalanceAggregate.Accepted

  type Refused = CreditBalanceAggregate.Refused
  val Refused: CreditBalanceAggregate.Refused.type =
    CreditBalanceAggregate.Refused
}
