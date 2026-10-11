package net.imadz..application.aggregates

import akka.actor.typed.ActorRef
import net.imadz..domain.entities.CreditBalanceEntity.CreditBalanceState
import net.imadz..domain.values.CreditBalanceEvent
import net.imadz..domain.values.Money
import net.imadz.banking.domain.values.Money
import net.imadz.framework.common.CborSerializable
import net.imadz.framework.common.CommonTypes.Id
import net.imadz.framework.common.CommonTypes.iMadzError
import scala.collection.immutable.List

object CreditBalanceProtocol {

  // Commands
  sealed trait CreditBalanceCommand extends CborSerializable
  case class AddInitial(initial: Money, replyTo: ActorRef[CreditBalanceConfirmation]) extends CreditBalanceCommand
  case class Deposit(change: Money, replyTo: ActorRef[CreditBalanceConfirmation]) extends CreditBalanceCommand
  case class Withdraw(change: Money, replyTo: ActorRef[CreditBalanceConfirmation]) extends CreditBalanceCommand
  case class GetBalance(replyTo: ActorRef[CreditBalanceConfirmation]) extends CreditBalanceCommand
  case class ReserveFunds(transferId: Id, amount: Money, replyTo: ActorRef[FundsReservationConfirmation]) extends CreditBalanceCommand
  case class DeductFunds(transferId: Id, replyTo: ActorRef[FundsDeductionConfirmation]) extends CreditBalanceCommand
  case class ReleaseReservedFunds(transferId: Id, replyTo: ActorRef[FundsReleaseConfirmation]) extends CreditBalanceCommand
  case class RecordIncomingCredits(transferId: Id, amount: Money, replyTo: ActorRef[RecordIncomingCreditsConfirmation]) extends CreditBalanceCommand
  case class CommitIncomingCredits(transferId: Id, replyTo: ActorRef[CommitIncomingCreditsConfirmation]) extends CreditBalanceCommand
  case class CancelIncomingCredit(transferId: Id, replyTo: ActorRef[CancelIncomingCreditConfirmation]) extends CreditBalanceCommand

  // Replies
  case class CreditBalanceConfirmation(error: Option[iMadzError], balances: List[Money]) extends CborSerializable
  case class FundsReservationConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
  case class FundsDeductionConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
  case class FundsReleaseConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
  case class RecordIncomingCreditsConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
  case class CommitIncomingCreditsConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
  case class CancelIncomingCreditConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable



  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type CreditBalanceCommandHandler = (CreditBalanceState, CreditBalanceCommand) => akka.persistence.typed.scaladsl.Effect[CreditBalanceEvent, CreditBalanceState]


}
