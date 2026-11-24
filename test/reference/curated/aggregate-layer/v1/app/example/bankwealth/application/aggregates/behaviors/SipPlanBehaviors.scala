package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.SipPlanProtocol._
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.{SipPlanComputations, SipPlanProtocol => Payload, SipPlanRules}

object SipPlanBehaviors {

  def apply(hosts: SipPlanComputations): CommandHandler = (state, command) =>
    queryBehavior
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(reply) =>
      Effect.none.thenRun((s: State) => reply ! s)
  }

  private def executionBehavior(state: State, hosts: SipPlanComputations): PartialFunction[Command, Effect[Event, State]] = {
    case Execute(command, reply) =>
      val decision = command match {
        case p: Payload.CreateSipPlan =>
          SipPlanRules.CreateSipPlan(state, p, hosts)
        case p: Payload.AppendSipDueSlot =>
          SipPlanRules.AppendSipDueSlot(state, p, hosts)
        case p: Payload.SealSipSchedule =>
          SipPlanRules.SealSipSchedule(state, p, hosts)
        case p: Payload.ReviseSipPlan =>
          SipPlanRules.ReviseSipPlan(state, p, hosts)
        case p: Payload.AdvanceSipClock =>
          SipPlanRules.AdvanceSipClock(state, p, hosts)
        case p: Payload.PauseSipPlan =>
          SipPlanRules.PauseSipPlan(state, p, hosts)
        case p: Payload.ResumeSipPlan =>
          SipPlanRules.ResumeSipPlan(state, p, hosts)
        case p: Payload.ObserveSipDueSlot =>
          SipPlanRules.ObserveSipDueSlot(state, p, hosts)
        case p: Payload.SkipPausedSipDueSlot =>
          SipPlanRules.SkipPausedSipDueSlot(state, p, hosts)
        case p: Payload.AdvanceSkippedSipSlot =>
          SipPlanRules.AdvanceSkippedSipSlot(state, p, hosts)
        case p: Payload.TriggerSipInstallment =>
          SipPlanRules.TriggerSipInstallment(state, p, hosts)
        case p: Payload.RecordSipInstallmentPending =>
          SipPlanRules.RecordSipInstallmentPending(state, p, hosts)
        case p: Payload.RecordSipInstallmentOutcomeUnknown =>
          SipPlanRules.RecordSipInstallmentOutcomeUnknown(state, p, hosts)
        case p: Payload.RecordSipInstallmentRecoveryRequired =>
          SipPlanRules.RecordSipInstallmentRecoveryRequired(state, p, hosts)
        case p: Payload.RecordSipInstallmentRefundInProgress =>
          SipPlanRules.RecordSipInstallmentRefundInProgress(state, p, hosts)
        case p: Payload.RecordSipInstallmentSucceeded =>
          SipPlanRules.RecordSipInstallmentSucceeded(state, p, hosts)
        case p: Payload.RecordSipInstallmentFailed =>
          SipPlanRules.RecordSipInstallmentFailed(state, p, hosts)
        case p: Payload.RecordSipCreateIntent =>
          SipPlanRules.RecordSipCreateIntent(state, p, hosts)
      }

      decision match {
        case Left(code) =>
          Effect.none.thenRun((_: State) => reply ! Refused(code))
        case Right(events) =>
          Effect.persist(events).thenRun((_: State) => reply ! Accepted(events))
      }
  }
}
