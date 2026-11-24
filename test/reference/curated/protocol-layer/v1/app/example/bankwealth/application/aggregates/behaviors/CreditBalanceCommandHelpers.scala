package example.bankwealth.application.aggregates.behaviors

import akka.actor.typed.ActorRef
import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.CreditBalanceProtocol._
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.invariants.params.CreditBalanceRuleParams._

trait CreditBalanceCommandHelpers {
  protected def toInitializeAccountParams(cmd: InitializeAccount): InitializeAccountParams =
    InitializeAccountParams(cmd.resource, cmd.currency, cmd.amount)
  protected def toReserveFundsParams(cmd: ReserveFunds): ReserveFundsParams =
    ReserveFundsParams(cmd.txid, cmd.resource, cmd.amount)
  protected def toDeductFundsParams(cmd: DeductFunds): DeductFundsParams =
    DeductFundsParams(cmd.txid, cmd.resource, cmd.amount)
  protected def toReleaseReservedFundsParams(cmd: ReleaseReservedFunds): ReleaseReservedFundsParams =
    ReleaseReservedFundsParams(cmd.txid, cmd.resource, cmd.amount)
  protected def toRecordIncomingCreditsParams(cmd: RecordIncomingCredits): RecordIncomingCreditsParams =
    RecordIncomingCreditsParams(cmd.txid, cmd.resource, cmd.amount)
  protected def toCommitIncomingCreditsParams(cmd: CommitIncomingCredits): CommitIncomingCreditsParams =
    CommitIncomingCreditsParams(cmd.txid, cmd.resource, cmd.amount)
  protected def toCancelIncomingCreditParams(cmd: CancelIncomingCredit): CancelIncomingCreditParams =
    CancelIncomingCreditParams(cmd.txid, cmd.resource, cmd.amount)

  protected def replyEffect(
    decision: Either[String, Vector[Event]],
    replyTo: ActorRef[Reply]
  ): Effect[Event, State] = decision match {
    case Left(code) =>
      Effect.none.thenRun((_: State) => replyTo ! Refused(code))
    case Right(events) =>
      Effect.persist(events).thenRun((_: State) => replyTo ! Accepted(events))
  }
}
