package example.bankwealth.application.process.cash_payment

import scala.concurrent.duration._

import example.bankwealth.domain.values.{AccountId, FundOrderId, Money, OperationId, TxId}
import net.imadz.monarch.{StageError, StageFailedException}

/** Durable execution plan of the cash purchase payment pipeline: one stage,
  * `pay-cash-purchase`, which delegates to the invocation host and folds its
  * authoritative result into the plan state. Stage outcomes are the monarch
  * contract: business rejections stop the stage, unknown effects demand
  * manual recovery — never an implicit retry. */
object BankCashPaymentExecution {

  final case class Inputs(
    operation: OperationId,
    occurrence: OperationId,
    investorAccountId: AccountId,
    fundOrderId: FundOrderId,
    fundCollectionAccountId: AccountId,
    amount: Money,
    fundCode: String,
  )

  final case class PayCashPurchaseRequest(
    operation: OperationId,
    occurrence: OperationId,
    investorAccountId: AccountId,
    fundOrderId: FundOrderId,
    fundCollectionAccountId: AccountId,
    amount: Money,
  )

  sealed trait PayCashPurchaseResult
  final case class PayCashPurchaseSucceeded(paymentTxid: TxId) extends PayCashPurchaseResult
  case object PayCashPurchaseRejected extends PayCashPurchaseResult
  case object PayCashPurchaseCompensated extends PayCashPurchaseResult
  case object PayCashPurchaseRecoveryRequired extends PayCashPurchaseResult
  case object PayCashPurchaseUnknown extends PayCashPurchaseResult

  final case class State(inputs: Inputs, paymentTxid: Option[TxId] = None)

  final case class Outputs(paymentTxid: TxId)

  /** Unconfirmed predecessor output is refused — never defaulted. */
  def outputs(state: State): Outputs =
    Outputs(state.paymentTxid.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output")))

  // ----------------------------------------------------------------- knowledge
  val PlanVersion = "bank-v1-1"
  val StageId = "pay-cash-purchase"

  /** Bounded retry of the pending-invocation poll (R1): the host answers
    * Pending while the saga runs; the bridge re-asks with exponential backoff
    * inside the stage deadline — never an unbounded 20 ms loop. */
  val RetryInitial: FiniteDuration = 100.millis
  val RetryFactor: Int = 2
  val RetryMax: FiniteDuration = 5.seconds
  val StageDeadline: FiniteDuration = 60.seconds

  /** R1 bounded backoff schedule: attempt 0 waits RetryInitial, doubling per
    * attempt and capped at RetryMax — the poll loop is finite by construction. */
  def backoffMillis(attempt: Int): Long =
    math.min(RetryMax.toMillis, math.round(RetryInitial.toMillis * math.pow(RetryFactor, attempt.toDouble)))

  def foldResult(state: State, result: PayCashPurchaseResult): State = result match {
    case PayCashPurchaseSucceeded(paymentTxid) => state.copy(paymentTxid = Some(paymentTxid))
    case PayCashPurchaseRejected => throw StageFailedException(StageError(StageId,
              Some("Rejected"), "business-rejection", "business-rejection:Rejected:stop"))
    case PayCashPurchaseCompensated => throw StageFailedException(StageError(StageId,
              Some("Compensated"), "business-rejection", "business-rejection:Compensated:stop"))
    case PayCashPurchaseRecoveryRequired => throw StageFailedException(StageError(StageId,
            Some("RecoveryRequired"), "infrastructure-failure",
            "infrastructure-failure:RecoveryRequired:manual-recovery"))
    case PayCashPurchaseUnknown => throw StageFailedException(StageError(StageId,
              Some("Unknown"), "unknown-effect", "unknown-effect:Unknown:manual-recovery"))
  }
}
