package example.bankwealth.application.aggregates

import akka.actor.typed.ActorRef
import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.values._
import net.imadz.common.CborSerializable
import net.imadz.common.CommonTypes.iMadzError

object CreditBalanceProtocol {

  sealed trait Command extends CborSerializable
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

  sealed trait Reply extends CborSerializable
  final case class Accepted(events: Vector[Event]) extends Reply
  final case class Refused(error: iMadzError) extends Reply {
    def code: String = error.code
  }

  type CommandHandler = (State, Command) => Effect[Event, State]
}
