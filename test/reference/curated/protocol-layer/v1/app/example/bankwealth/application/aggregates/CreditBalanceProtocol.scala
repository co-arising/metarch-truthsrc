package example.bankwealth.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}

object CreditBalanceProtocol {

  type Command = example.bankwealth.domain.CreditBalanceAggregate.Request
  type Reply = example.bankwealth.domain.CreditBalanceAggregate.Reply
  type CommandPayload = example.bankwealth.domain.CreditBalanceProtocol.Command
  type CommandHandler = (State, Command) => Effect[Event, State]

  type Execute = example.bankwealth.domain.CreditBalanceAggregate.Execute
  val Execute: example.bankwealth.domain.CreditBalanceAggregate.Execute.type =
    example.bankwealth.domain.CreditBalanceAggregate.Execute

  type GetState = example.bankwealth.domain.CreditBalanceAggregate.GetState
  val GetState: example.bankwealth.domain.CreditBalanceAggregate.GetState.type =
    example.bankwealth.domain.CreditBalanceAggregate.GetState

  type Accepted = example.bankwealth.domain.CreditBalanceAggregate.Accepted
  val Accepted: example.bankwealth.domain.CreditBalanceAggregate.Accepted.type =
    example.bankwealth.domain.CreditBalanceAggregate.Accepted

  type Refused = example.bankwealth.domain.CreditBalanceAggregate.Refused
  val Refused: example.bankwealth.domain.CreditBalanceAggregate.Refused.type =
    example.bankwealth.domain.CreditBalanceAggregate.Refused
}
