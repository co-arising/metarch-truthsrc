package example.bankwealth.application.process.ta_submission

import scala.concurrent.duration._

import example.bankwealth.domain.values.{FundOrderId, TaRequestId, TxId}
import net.imadz.monarch.{StageError, StageFailedException}

/** Durable execution plan of the TA submission pipeline: one stage,
  * `submit-ta`, which hands a paid fund order to the TA effect host and folds
  * its authoritative result into the plan state. Stage outcomes are the
  * monarch contract: Refused is a business rejection, Unavailable and Unknown
  * demand manual recovery — never an implicit retry. */
object BankTaSubmissionExecution {

  final case class Inputs(taRequestId: TaRequestId, fundOrderId: FundOrderId, paymentTxId: TxId)

  final case class SubmitTaRequest(taRequestId: TaRequestId, fundOrderId: FundOrderId, paymentTxId: TxId)

  sealed trait SubmitTaResult
  final case class SubmitTaObserved(taRequestId: TaRequestId) extends SubmitTaResult
  case object SubmitTaRefused extends SubmitTaResult
  case object SubmitTaUnavailable extends SubmitTaResult
  case object SubmitTaUnknown extends SubmitTaResult

  final case class State(inputs: Inputs, taRequestId: Option[TaRequestId] = None)

  final case class Outputs(taRequestId: TaRequestId)

  /** Unconfirmed predecessor output is refused — never defaulted. */
  def outputs(state: State): Outputs =
    Outputs(state.taRequestId.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output")))

  // ----------------------------------------------------------------- knowledge
  val PlanVersion = "bank-v1-1"
  val StageId = "submit-ta"

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

  def foldResult(state: State, result: SubmitTaResult): State = result match {
    case SubmitTaObserved(taRequestId) => state.copy(taRequestId = Some(taRequestId))
    case SubmitTaRefused => throw StageFailedException(StageError(StageId,
        Some("Refused"), "business-rejection", "business-rejection:Refused:stop"))
    case SubmitTaUnavailable => throw StageFailedException(StageError(StageId,
        Some("Unavailable"), "infrastructure-failure", "infrastructure-failure:Unavailable:manual-recovery"))
    case SubmitTaUnknown => throw StageFailedException(StageError(StageId,
        Some("Unknown"), "unknown-effect", "unknown-effect:Unknown:manual-recovery"))
  }
}
