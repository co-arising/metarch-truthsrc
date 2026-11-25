package example.bankwealth.infrastructure.process

import akka.actor.typed.ActorRef
import com.google.protobuf.ByteString
import example.bankwealth.application.process.cash_payment.{BankCashPaymentExecution, BankPaymentSagaDefinition}
import example.bankwealth.application.process.protocol.BankPaymentMessages._
import net.imadz.infra.saga.strict._

/** Pipeline invocation host for the bank cash payment: owns the durable
  * association of one business request to its saga run, the admission gate,
  * authoritative result observation and receipt delivery.
  *
  * Semantics contracts:
  * - Invoke is idempotent: the same complete input under the same operation
  *   identity is coalesced; a different input under a live invocation is a
  *   Conflict. Every reply is derived from durable state, so a caller that
  *   re-invokes after any crash recovers its answer (caller-side ask timeout
  *   and retry are part of the contract — reply targets are never persisted).
  * - Admission is a runtime gate, not an event-sourced fact; only the granted
  *   admission is persisted.
  * - Receipt delivery is two-phase (authority completion, then delivery
  *   completion) and acknowledged by a persisted event. */
object BankPaymentHost {

  /** Saga result kinds; `wire` is the persisted identity of the kind. */
  sealed trait ResultKind { def wire: String }
  object ResultKind {
    case object Succeeded extends ResultKind { val wire = "succeeded" }
    case object RejectedBeforeEffects extends ResultKind { val wire = "rejected-before-effects" }
    case object Compensated extends ResultKind { val wire = "compensated" }
    case object RecoveryRequired extends ResultKind { val wire = "recovery-required" }
    case object OutcomeUnknown extends ResultKind { val wire = "outcome-unknown" }

    val all: Vector[ResultKind] = Vector(Succeeded,
        RejectedBeforeEffects, Compensated, RecoveryRequired, OutcomeUnknown)
    val terminal: Set[ResultKind] = Set(Succeeded, RejectedBeforeEffects, Compensated)

    def fromWire(wire: String): Option[ResultKind] = all.find(_.wire == wire)
  }

  sealed trait Request
  final case class Invoke(state: BankCashPaymentExecution.State, replyTo: ActorRef[Reply]) extends Request
  private[bankwealth] final case class Observed(
    reply: StrictSagaCoordinator.Reply, replyTo: ActorRef[Reply]) extends Request
  private[bankwealth] final case class Delivered(
    kind: ResultKind, ok: Boolean, replyTo: ActorRef[Reply]) extends Request
  private[bankwealth] final case class Admitted(
    operation: String, outcome: Either[String, Unit]) extends Request

  sealed trait Reply
  final case class Completed(result: BankCashPaymentExecution.PayCashPurchaseResult) extends Reply
  final case class Pending(reason: String) extends Reply
  final case class Conflict(reason: String) extends Reply

  sealed trait Event
  final case class Associated(original: ByteString, args: ByteString, operation: String) extends Event
  final case class IdentityObserved(identity: TransactionIdentity) extends Event
  final case class ResultIntent(kind: ResultKind) extends Event
  final case class DeliveryAcknowledged(kind: ResultKind) extends Event
  case object AdmissionGranted extends Event

  final case class State(
    original: ByteString = ByteString.EMPTY,
    args: ByteString = ByteString.EMPTY,
    operation: String = "",
    identity: Option[TransactionIdentity] = None,
    result: Option[ResultKind] = None,
    delivered: Boolean = false,
    admitted: Boolean = false,
  )

  // ----------------------------------------------------------------- knowledge
  val SagaId = "bank-cash-payment-v1"
  val SagaVersion = "bank-v1-1"
  val SagaDefinitionVersion = 1
  val SagaDefinitionDigest = "sha256:c13f703e76eaee9bfceeff701ecc5f41dd011d6db6890c6820a7faa944538f64"
  val PipelineStep = "pay-cash-purchase"
  val InvocationScheme = "truthsrc-pipeline-invocation-v1"
  val InvocationMarkers = Vector("iteration", "absent", "chunk", "absent")

  def originalInput(state: BankCashPaymentExecution.State): BankPaymentOriginal =
    BankPaymentOriginal(
      state.inputs.operation,
      state.inputs.fundOrderId,
      state.inputs.investorAccountId,
      state.inputs.fundCollectionAccountId,
      state.inputs.fundCode,
      state.inputs.amount,
    )

  def invocationArgs(state: BankCashPaymentExecution.State): BankPaymentArgs =
    BankPaymentArgs(
      state.inputs.investorAccountId,
      state.inputs.fundOrderId,
      state.inputs.fundCollectionAccountId,
      state.inputs.amount,
    )

  /** Durable operation identity: the scheme, saga and invocation markers plus
    * the request's own keys, length-prefixed and SHA-256 digested. */
  def operationIdentity(state: BankCashPaymentExecution.State): String = {
    val input = state.inputs
    fingerprint(Vector(
      InvocationScheme,
      "bankwealth",
      SagaId, SagaVersion,
      SagaId, SagaVersion,
      PipelineStep,
      input.operation.value,
      input.occurrence.value,
    ) ++ InvocationMarkers)
  }

  private def fingerprint(parts: Vector[String]): String = {
    parts.foreach(part => require(part != null && part.nonEmpty, "durable identity token required"))
    val buffer = new java.io.ByteArrayOutputStream
    val out = new java.io.DataOutputStream(buffer)
    parts.foreach { part =>
      val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      out.writeInt(bytes.length)
      out.write(bytes)
    }
    out.flush()
    sha256Hex(buffer.toByteArray)
  }

  private def sha256Hex(bytes: Array[Byte]): String =
    "sha256:" + hexSha256(bytes)

  /** The coordinator's per-args digest is the bare hex form; the scheme
    * prefix belongs to definition digests and the operation fingerprint only. */
  private def hexSha256(bytes: Array[Byte]): String =
    java.security.MessageDigest.getInstance("SHA-256").digest(bytes).iterator
      .map(b => f"${b & 0xff}%02x").mkString

  /** Classify an authoritative strict-saga status into a result kind. */
  def classify(status: StrictState): Option[ResultKind] =
    status.status match {
      case StrictStatus.Succeeded => Some(ResultKind.Succeeded)
      case StrictStatus.Aborted =>
        Some(if (status.evidence.values.exists { case Evidence.Confirmed(id,
            _) => id.phase == Phase.Prepare; case _ => false })
          ResultKind.Compensated else ResultKind.RejectedBeforeEffects)
      case StrictStatus.RecoveryRequired =>
        Some(if (status
            .evidence.values
                .exists(_.isInstanceOf[Evidence.Uncertain])) ResultKind.OutcomeUnknown else ResultKind.RecoveryRequired)
      case _ => None
    }

  /** The authoritative status must describe exactly this invocation: same
    * args bytes, same definition identity, same args digest, no identity
    * flip-flop, and a proto-round-trippable payload. */
  def validStatus(state: State, status: StrictState): Boolean =
    status.argsBytes == state.args && status.identity.exists { identity =>
      identity.transactionId == state.operation &&
      identity.definitionName == SagaId &&
      identity.definitionVersion == SagaDefinitionVersion &&
      identity.definitionDigest == SagaDefinitionDigest &&
      identity.argsCodec == BankPaymentSagaDefinition.ArgsCodecPin &&
      identity.argsDigest == hexSha256(state.args.toByteArray) &&
      state.identity.forall(_ == identity) &&
      scala.util.Try(StrictSagaProtoConverters.stateToProto(status)).isSuccess
    }

  def nextResult(current: Option[ResultKind], observed: Option[ResultKind]): Option[ResultKind] =
    if (current.exists(ResultKind.terminal)) None else observed.filterNot(current.contains)

  /** Derive the caller's reply from durable state only (R2 contract). */
  def completed(state: State, kind: ResultKind): Reply =
    state.identity match {
      case None => Pending("identity not yet observed") // unreachable: kinds answer only after observation; fail closed
      case Some(identity) =>
        kind match {
          case ResultKind.Succeeded =>
              Completed(BankCashPaymentExecution
                  .PayCashPurchaseSucceeded(example.bankwealth.domain.values.TxId(identity.transactionId)))
          case ResultKind.RejectedBeforeEffects => Completed(BankCashPaymentExecution.PayCashPurchaseRejected)
          case ResultKind.Compensated => Completed(BankCashPaymentExecution.PayCashPurchaseCompensated)
          case ResultKind.RecoveryRequired | ResultKind.OutcomeUnknown => Pending(kind.wire)
        }
    }

  def applyEvent(state: State, event: Event): State = event match {
    case Associated(original, args, operation) =>
      state.copy(original = original, args = args, operation = operation)
    case IdentityObserved(identity) => state.copy(identity = Some(identity))
    case ResultIntent(kind) => state.copy(result = Some(kind), delivered = false)
    case DeliveryAcknowledged(_) => state.copy(delivered = true)
    case AdmissionGranted => state.copy(admitted = true)
  }
}
