package example.bankwealth.application.process

import scala.concurrent.duration._

import akka.actor.typed.ActorRef
import example.bankwealth.application.connectors.BankSipDispatchEffectHost
import example.bankwealth.domain.values.{OccurrenceId, OperationId, SipOccurrence}
import net.imadz.monarch.{StageError, StageFailedException}

/** Durable execution plan of the SIP dispatch pipeline: one stage,
  * `dispatch-cash`, which hands a durable SIP occurrence to the effect host
  * and folds its authoritative result into the plan state. Stage outcomes are
  * the monarch contract: Refused is a business rejection, Unavailable and
  * Unknown demand manual recovery — never an implicit retry. */
object BankSipDispatchExecution {

  final case class Inputs(occurrenceId: OccurrenceId, occurrence: SipOccurrence)

  final case class DispatchCashRequest(occurrenceId: OccurrenceId, occurrence: SipOccurrence)

  sealed trait DispatchCashResult
  final case class DispatchCashDispatched(operationId: OperationId) extends DispatchCashResult
  case object DispatchCashRefused extends DispatchCashResult
  case object DispatchCashUnavailable extends DispatchCashResult
  case object DispatchCashUnknown extends DispatchCashResult

  final case class State(inputs: Inputs, operationId: Option[OperationId] = None)

  final case class Outputs(operationId: OperationId)

  /** Unconfirmed predecessor output is refused — never defaulted. */
  def outputs(state: State): Outputs =
    Outputs(state.operationId.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output")))

  def install(dispatchCashHost: ActorRef[BankSipDispatchEffectHost.Request]): Installed = {
    require(dispatchCashHost != null, "the exact effect host actor is required")
    new Installed(dispatchCashHost)
  }

  final class Installed private[BankSipDispatchExecution] (val dispatchCashHost: ActorRef[BankSipDispatchEffectHost
      .Request])

  // ----------------------------------------------------------------- knowledge
  val PlanVersion = "bank-v1-1"
  val StageId = "dispatch-cash"

  /** Bounded retry of the pending-effect poll (R1): the host answers Pending
    * while the effect stays unobserved; the bridge re-asks with exponential
    * backoff inside the stage deadline — never an unbounded loop. */
  val RetryInitial: FiniteDuration = 100.millis
  val RetryFactor: Int = 2
  val RetryMax: FiniteDuration = 5.seconds
  val StageDeadline: FiniteDuration = 60.seconds

  /** R1 bounded backoff schedule: attempt 0 waits RetryInitial, doubling per
    * attempt and capped at RetryMax — the poll loop is finite by construction. */
  def backoffMillis(attempt: Int): Long =
    math.min(RetryMax.toMillis, math.round(RetryInitial.toMillis * math.pow(RetryFactor, attempt.toDouble)))

  def foldResult(state: State, result: DispatchCashResult): State = result match {
    case DispatchCashDispatched(operationId) => state.copy(operationId = Some(operationId))
    case DispatchCashRefused => throw StageFailedException(StageError(StageId,
        Some("Refused"), "business-rejection", "business-rejection:Refused:stop"))
    case DispatchCashUnavailable => throw StageFailedException(StageError(StageId,
        Some("Unavailable"), "infrastructure-failure", "infrastructure-failure:Unavailable:manual-recovery"))
    case DispatchCashUnknown => throw StageFailedException(StageError(StageId,
        Some("Unknown"), "unknown-effect", "unknown-effect:Unknown:manual-recovery"))
  }
}
