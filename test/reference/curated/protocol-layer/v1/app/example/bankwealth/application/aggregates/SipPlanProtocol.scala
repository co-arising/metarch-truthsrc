package example.bankwealth.application.aggregates

import akka.actor.typed.ActorRef
import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.values._

object SipPlanProtocol {

  sealed trait Command
  final case class CreateSipPlan(
    planId: PlanId,
    config: SipRevisionConfig,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class AppendSipDueSlot(position: Long, dueSlot: Long, replyTo: ActorRef[Reply]) extends Command
  final case class SealSipSchedule(replyTo: ActorRef[Reply]) extends Command
  final case class ReviseSipPlan(config: SipRevisionConfig, replyTo: ActorRef[Reply]) extends Command
  final case class AdvanceSipClock(tick: Long, replyTo: ActorRef[Reply]) extends Command
  final case class PauseSipPlan(tick: Long, replyTo: ActorRef[Reply]) extends Command
  final case class ResumeSipPlan(tick: Long, replyTo: ActorRef[Reply]) extends Command
  final case class ObserveSipDueSlot(position: Long, dueSlot: Long, replyTo: ActorRef[Reply]) extends Command
  final case class SkipPausedSipDueSlot(
    position: Long,
    dueSlot: Long,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class AdvanceSkippedSipSlot(
    position: Long,
    dueSlot: Long,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class TriggerSipInstallment(
    position: Long,
    dueSlot: Long,
    revision: RevisionId,
    config: SipRevisionConfig,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordSipInstallmentPending(
    occurrence: SipOccurrence,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordSipInstallmentOutcomeUnknown(
    occurrence: SipOccurrence,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordSipInstallmentRecoveryRequired(
    occurrence: SipOccurrence,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordSipInstallmentRefundInProgress(
    occurrence: SipOccurrence,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordSipInstallmentSucceeded(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordSipInstallmentFailed(
    occurrence: SipOccurrence,
    evidence: String,
    receiptId: String,
    receiptBody: String,
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class RecordSipCreateIntent(
    intent: BankSipCreateIntent,
    source: Option[BankSipCreateIntent],
    replyTo: ActorRef[Reply]
  ) extends Command
  final case class GetState(replyTo: ActorRef[State]) extends Command

  sealed trait Reply
  final case class Accepted(events: Vector[Event]) extends Reply
  final case class Refused(code: String) extends Reply

  type CommandHandler = (State, Command) => Effect[Event, State]
}
