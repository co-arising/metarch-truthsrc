package example.bankwealth.application.aggregates

import akka.actor.typed.ActorRef
import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.values._

object CreditBalanceProtocol {

  sealed trait Command
  final case class InitializeAccount(
    resource: AccountId,
    currency: String,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class ReserveFunds(
    txid: TxId,
    resource: AccountId,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class DeductFunds(
    txid: TxId,
    resource: AccountId,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class ReleaseReservedFunds(
    txid: TxId,
    resource: AccountId,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordIncomingCredits(
    txid: TxId,
    resource: AccountId,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class CommitIncomingCredits(
    txid: TxId,
    resource: AccountId,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class CancelIncomingCredit(
    txid: TxId,
    resource: AccountId,
    amount: Money,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class GetState(replyTo: ActorRef[State]) extends Command

  sealed trait Reply
  final case class Accepted(events: Vector[Event]) extends Reply
  final case class Refused(code: String) extends Reply

  type CommandHandler = (State, Command) => Effect[Event, State]
}
