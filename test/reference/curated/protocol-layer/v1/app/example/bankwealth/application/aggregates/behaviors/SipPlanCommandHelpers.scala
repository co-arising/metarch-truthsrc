package example.bankwealth.application.aggregates.behaviors

import akka.actor.typed.ActorRef
import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.SipPlanProtocol._
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.invariants.params.SipPlanRuleParams._

trait SipPlanCommandHelpers {
  protected def toCreateSipPlanParams(cmd: CreateSipPlan): CreateSipPlanParams =
    CreateSipPlanParams(cmd.planId, cmd.config)
  protected def toAppendSipDueSlotParams(cmd: AppendSipDueSlot): AppendSipDueSlotParams =
    AppendSipDueSlotParams(cmd.position, cmd.dueSlot)
  protected def toSealSipScheduleParams(cmd: SealSipSchedule): SealSipScheduleParams =
    SealSipScheduleParams()
  protected def toReviseSipPlanParams(cmd: ReviseSipPlan): ReviseSipPlanParams =
    ReviseSipPlanParams(cmd.config)
  protected def toAdvanceSipClockParams(cmd: AdvanceSipClock): AdvanceSipClockParams =
    AdvanceSipClockParams(cmd.tick)
  protected def toPauseSipPlanParams(cmd: PauseSipPlan): PauseSipPlanParams =
    PauseSipPlanParams(cmd.tick)
  protected def toResumeSipPlanParams(cmd: ResumeSipPlan): ResumeSipPlanParams =
    ResumeSipPlanParams(cmd.tick)
  protected def toObserveSipDueSlotParams(cmd: ObserveSipDueSlot): ObserveSipDueSlotParams =
    ObserveSipDueSlotParams(cmd.position, cmd.dueSlot)
  protected def toSkipPausedSipDueSlotParams(cmd: SkipPausedSipDueSlot): SkipPausedSipDueSlotParams =
    SkipPausedSipDueSlotParams(cmd.position, cmd.dueSlot)
  protected def toAdvanceSkippedSipSlotParams(cmd: AdvanceSkippedSipSlot): AdvanceSkippedSipSlotParams =
    AdvanceSkippedSipSlotParams(cmd.position, cmd.dueSlot)
  protected def toTriggerSipInstallmentParams(cmd: TriggerSipInstallment): TriggerSipInstallmentParams =
    TriggerSipInstallmentParams(cmd.position, cmd.dueSlot, cmd.revision, cmd.config)
  protected def toRecordSipInstallmentPendingParams(cmd: RecordSipInstallmentPending): RecordSipInstallmentPendingParams =
    RecordSipInstallmentPendingParams(cmd.occurrence)
  protected def toRecordSipInstallmentOutcomeUnknownParams(cmd: RecordSipInstallmentOutcomeUnknown): RecordSipInstallmentOutcomeUnknownParams =
    RecordSipInstallmentOutcomeUnknownParams(cmd.occurrence)
  protected def toRecordSipInstallmentRecoveryRequiredParams(cmd: RecordSipInstallmentRecoveryRequired): RecordSipInstallmentRecoveryRequiredParams =
    RecordSipInstallmentRecoveryRequiredParams(cmd.occurrence)
  protected def toRecordSipInstallmentRefundInProgressParams(cmd: RecordSipInstallmentRefundInProgress): RecordSipInstallmentRefundInProgressParams =
    RecordSipInstallmentRefundInProgressParams(cmd.occurrence)
  protected def toRecordSipInstallmentSucceededParams(cmd: RecordSipInstallmentSucceeded): RecordSipInstallmentSucceededParams =
    RecordSipInstallmentSucceededParams(cmd.occurrence, cmd.evidence, cmd.receiptId, cmd.receiptBody)
  protected def toRecordSipInstallmentFailedParams(cmd: RecordSipInstallmentFailed): RecordSipInstallmentFailedParams =
    RecordSipInstallmentFailedParams(cmd.occurrence, cmd.evidence, cmd.receiptId, cmd.receiptBody)
  protected def toRecordSipCreateIntentParams(cmd: RecordSipCreateIntent): RecordSipCreateIntentParams =
    RecordSipCreateIntentParams(cmd.intent, cmd.source)

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
