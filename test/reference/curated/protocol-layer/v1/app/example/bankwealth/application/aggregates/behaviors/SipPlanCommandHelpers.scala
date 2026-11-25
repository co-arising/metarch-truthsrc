package example.bankwealth.application.aggregates.behaviors

import example.bankwealth.application.aggregates.SipPlanProtocol._
import example.bankwealth.domain.entities.SipPlanEntity.State
import example.bankwealth.domain.invariants.params.SipPlanRuleParams._
import net.imadz.common.CommonTypes.iMadzError
import net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper

trait SipPlanCommandHelpers {

  implicit object CreateSipPlanHelper extends CommandHelper[CreateSipPlan, State, CreateSipPlanParams, Reply] {
    override def toParam(state: State, command: CreateSipPlan): CreateSipPlanParams =
      CreateSipPlanParams(command.planId, command.config)

    override def createFailureReply(param: CreateSipPlanParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: CreateSipPlanParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object AppendSipDueSlotHelper extends CommandHelper[AppendSipDueSlot, State, AppendSipDueSlotParams, Reply] {
    override def toParam(state: State, command: AppendSipDueSlot): AppendSipDueSlotParams =
      AppendSipDueSlotParams(command.position, command.dueSlot)

    override def createFailureReply(param: AppendSipDueSlotParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: AppendSipDueSlotParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object SealSipScheduleHelper extends CommandHelper[SealSipSchedule, State, SealSipScheduleParams, Reply] {
    override def toParam(state: State, command: SealSipSchedule): SealSipScheduleParams =
      SealSipScheduleParams()

    override def createFailureReply(param: SealSipScheduleParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: SealSipScheduleParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object ReviseSipPlanHelper extends CommandHelper[ReviseSipPlan, State, ReviseSipPlanParams, Reply] {
    override def toParam(state: State, command: ReviseSipPlan): ReviseSipPlanParams =
      ReviseSipPlanParams(command.config)

    override def createFailureReply(param: ReviseSipPlanParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: ReviseSipPlanParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object AdvanceSipClockHelper extends CommandHelper[AdvanceSipClock, State, AdvanceSipClockParams, Reply] {
    override def toParam(state: State, command: AdvanceSipClock): AdvanceSipClockParams =
      AdvanceSipClockParams(command.tick)

    override def createFailureReply(param: AdvanceSipClockParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: AdvanceSipClockParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object PauseSipPlanHelper extends CommandHelper[PauseSipPlan, State, PauseSipPlanParams, Reply] {
    override def toParam(state: State, command: PauseSipPlan): PauseSipPlanParams =
      PauseSipPlanParams(command.tick)

    override def createFailureReply(param: PauseSipPlanParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: PauseSipPlanParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object ResumeSipPlanHelper extends CommandHelper[ResumeSipPlan, State, ResumeSipPlanParams, Reply] {
    override def toParam(state: State, command: ResumeSipPlan): ResumeSipPlanParams =
      ResumeSipPlanParams(command.tick)

    override def createFailureReply(param: ResumeSipPlanParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: ResumeSipPlanParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object ObserveSipDueSlotHelper extends CommandHelper[ObserveSipDueSlot, State, ObserveSipDueSlotParams, Reply] {
    override def toParam(state: State, command: ObserveSipDueSlot): ObserveSipDueSlotParams =
      ObserveSipDueSlotParams(command.position, command.dueSlot)

    override def createFailureReply(param: ObserveSipDueSlotParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: ObserveSipDueSlotParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object SkipPausedSipDueSlotHelper extends CommandHelper[SkipPausedSipDueSlot, State, SkipPausedSipDueSlotParams, Reply] {
    override def toParam(state: State, command: SkipPausedSipDueSlot): SkipPausedSipDueSlotParams =
      SkipPausedSipDueSlotParams(command.position, command.dueSlot)

    override def createFailureReply(param: SkipPausedSipDueSlotParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: SkipPausedSipDueSlotParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object AdvanceSkippedSipSlotHelper extends CommandHelper[AdvanceSkippedSipSlot, State, AdvanceSkippedSipSlotParams, Reply] {
    override def toParam(state: State, command: AdvanceSkippedSipSlot): AdvanceSkippedSipSlotParams =
      AdvanceSkippedSipSlotParams(command.position, command.dueSlot)

    override def createFailureReply(param: AdvanceSkippedSipSlotParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: AdvanceSkippedSipSlotParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object TriggerSipInstallmentHelper extends CommandHelper[TriggerSipInstallment, State, TriggerSipInstallmentParams, Reply] {
    override def toParam(state: State, command: TriggerSipInstallment): TriggerSipInstallmentParams =
      TriggerSipInstallmentParams(command.position, command.dueSlot, command.revision, command.config)

    override def createFailureReply(param: TriggerSipInstallmentParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: TriggerSipInstallmentParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordSipInstallmentPendingHelper extends CommandHelper[RecordSipInstallmentPending, State, RecordSipInstallmentPendingParams, Reply] {
    override def toParam(state: State, command: RecordSipInstallmentPending): RecordSipInstallmentPendingParams =
      RecordSipInstallmentPendingParams(command.occurrence)

    override def createFailureReply(param: RecordSipInstallmentPendingParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordSipInstallmentPendingParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordSipInstallmentOutcomeUnknownHelper extends CommandHelper[RecordSipInstallmentOutcomeUnknown, State, RecordSipInstallmentOutcomeUnknownParams, Reply] {
    override def toParam(state: State, command: RecordSipInstallmentOutcomeUnknown): RecordSipInstallmentOutcomeUnknownParams =
      RecordSipInstallmentOutcomeUnknownParams(command.occurrence)

    override def createFailureReply(param: RecordSipInstallmentOutcomeUnknownParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordSipInstallmentOutcomeUnknownParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordSipInstallmentRecoveryRequiredHelper extends CommandHelper[RecordSipInstallmentRecoveryRequired, State, RecordSipInstallmentRecoveryRequiredParams, Reply] {
    override def toParam(state: State, command: RecordSipInstallmentRecoveryRequired): RecordSipInstallmentRecoveryRequiredParams =
      RecordSipInstallmentRecoveryRequiredParams(command.occurrence)

    override def createFailureReply(param: RecordSipInstallmentRecoveryRequiredParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordSipInstallmentRecoveryRequiredParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordSipInstallmentRefundInProgressHelper extends CommandHelper[RecordSipInstallmentRefundInProgress, State, RecordSipInstallmentRefundInProgressParams, Reply] {
    override def toParam(state: State, command: RecordSipInstallmentRefundInProgress): RecordSipInstallmentRefundInProgressParams =
      RecordSipInstallmentRefundInProgressParams(command.occurrence)

    override def createFailureReply(param: RecordSipInstallmentRefundInProgressParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordSipInstallmentRefundInProgressParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordSipInstallmentSucceededHelper extends CommandHelper[RecordSipInstallmentSucceeded, State, RecordSipInstallmentSucceededParams, Reply] {
    override def toParam(state: State, command: RecordSipInstallmentSucceeded): RecordSipInstallmentSucceededParams =
      RecordSipInstallmentSucceededParams(command.occurrence, command.evidence, command.receiptId, command.receiptBody)

    override def createFailureReply(param: RecordSipInstallmentSucceededParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordSipInstallmentSucceededParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordSipInstallmentFailedHelper extends CommandHelper[RecordSipInstallmentFailed, State, RecordSipInstallmentFailedParams, Reply] {
    override def toParam(state: State, command: RecordSipInstallmentFailed): RecordSipInstallmentFailedParams =
      RecordSipInstallmentFailedParams(command.occurrence, command.evidence, command.receiptId, command.receiptBody)

    override def createFailureReply(param: RecordSipInstallmentFailedParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordSipInstallmentFailedParams)(state: State): Reply =
      Accepted(Vector.empty)
  }

  implicit object RecordSipCreateIntentHelper extends CommandHelper[RecordSipCreateIntent, State, RecordSipCreateIntentParams, Reply] {
    override def toParam(state: State, command: RecordSipCreateIntent): RecordSipCreateIntentParams =
      RecordSipCreateIntentParams(command.intent, command.source)

    override def createFailureReply(param: RecordSipCreateIntentParams)(error: iMadzError): Reply =
      Refused(error)

    override def createSuccessReply(param: RecordSipCreateIntentParams)(state: State): Reply =
      Accepted(Vector.empty)
  }
}
