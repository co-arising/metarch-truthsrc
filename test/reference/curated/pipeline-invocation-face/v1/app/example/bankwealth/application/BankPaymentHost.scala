package example.bankwealth.application

import scala.concurrent.Future

import akka.actor.typed.ActorRef
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import com.google.protobuf.ByteString
import net.imadz.infra.saga.strict._

/** Pipeline invocation host for the cash purchase payment: owns the durable
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

    val all: Vector[ResultKind] = Vector(Succeeded, RejectedBeforeEffects, Compensated, RecoveryRequired, OutcomeUnknown)
    val terminal: Set[ResultKind] = Set(Succeeded, RejectedBeforeEffects, Compensated)

    def fromWire(wire: String): Option[ResultKind] = all.find(_.wire == wire)
  }

  sealed trait Request
  final case class Invoke(state: bank_cash_payment_v1Execution.State, replyTo: ActorRef[Reply]) extends Request
  private final case class Observed(reply: StrictSagaCoordinator.Reply, replyTo: ActorRef[Reply]) extends Request
  private final case class Delivered(kind: ResultKind, ok: Boolean, replyTo: ActorRef[Reply]) extends Request
  private final case class Admitted(operation: String, outcome: Either[String, Unit]) extends Request

  sealed trait Reply
  final case class Completed(result: bank_cash_payment_v1Execution.pay_cash_purchaseResult) extends Reply
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
  private val SagaId = "bank-cash-payment-v1"
  private val SagaVersion = "bank-v1-1"
  private val SagaDefinitionVersion = 1
  private val SagaDefinitionDigest = "sha256:c13f703e76eaee9bfceeff701ecc5f41dd011d6db6890c6820a7faa944538f64"
  private val PipelineStep = "pay-cash-purchase"
  private val InvocationScheme = "truthsrc-pipeline-invocation-v1"
  private val InvocationMarkers = Vector("iteration", "absent", "chunk", "absent")

  def originalInput(state: bank_cash_payment_v1Execution.State): BankPaymentOriginal =
    BankPaymentOriginal(
      state.inputs.operation,
      state.inputs.fundOrderId,
      state.inputs.investorAccountId,
      state.inputs.fundCollectionAccountId,
      state.inputs.fundCode,
      state.inputs.amount,
    )

  def invocationArgs(state: bank_cash_payment_v1Execution.State): BankPaymentArgs =
    BankPaymentArgs(
      state.inputs.investorAccountId,
      state.inputs.fundOrderId,
      state.inputs.fundCollectionAccountId,
      state.inputs.amount,
    )

  /** Durable operation identity: the scheme, saga and invocation markers plus
    * the request's own keys, length-prefixed and SHA-256 digested. */
  def operationIdentity(state: bank_cash_payment_v1Execution.State): String = {
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
    "sha256:" + java.security.MessageDigest.getInstance("SHA-256").digest(bytes).iterator.map(b => f"${b & 0xff}%02x").mkString

  /** Classify an authoritative strict-saga status into a result kind. */
  def classify(status: StrictState): Option[ResultKind] =
    status.status match {
      case StrictStatus.Succeeded => Some(ResultKind.Succeeded)
      case StrictStatus.Aborted =>
        Some(if (status.evidence.values.exists { case Evidence.Confirmed(id, _) => id.phase == Phase.Prepare; case _ => false })
          ResultKind.Compensated else ResultKind.RejectedBeforeEffects)
      case StrictStatus.RecoveryRequired =>
        Some(if (status.evidence.values.exists(_.isInstanceOf[Evidence.Uncertain])) ResultKind.OutcomeUnknown else ResultKind.RecoveryRequired)
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
      identity.argsCodec == bank_payment_hostDefinition.argsCodec.pin &&
      identity.argsDigest == sha256Hex(state.args.toByteArray) &&
      state.identity.forall(_ == identity) &&
      scala.util.Try(StrictSagaProtoConverters.stateToProto(status)).isSuccess
    }

  private def nextResult(current: Option[ResultKind], observed: Option[ResultKind]): Option[ResultKind] =
    if (current.exists(ResultKind.terminal)) None else observed.filterNot(current.contains)

  /** Derive the caller's reply from durable state only (R2 contract). */
  private def completed(state: State, kind: ResultKind): Reply =
    state.identity match {
      case None => Pending("identity not yet observed") // unreachable: kinds answer only after observation; fail closed
      case Some(identity) =>
        kind match {
          case ResultKind.Succeeded => Completed(bank_cash_payment_v1Execution.pay_cash_purchase_Succeeded(example.bankwealth.domain.values.TxId(identity.transactionId)))
          case ResultKind.RejectedBeforeEffects => Completed(bank_cash_payment_v1Execution.pay_cash_purchase_Rejected)
          case ResultKind.Compensated => Completed(bank_cash_payment_v1Execution.pay_cash_purchase_Compensated)
          case ResultKind.RecoveryRequired | ResultKind.OutcomeUnknown => Pending(kind.wire)
        }
    }

  def apply(
    persistenceId: String,
    coordinator: ActorRef[StrictSagaCoordinator.Command],
    technical: BankPaymentTechnicalPorts.Installed,
  ): Behavior[Request] = Behaviors.setup { context =>
    require(persistenceId != null && persistenceId.nonEmpty && coordinator != null && technical != null,
      "explicit owned host identity, coordinator and installed technical ports required")
    implicit val ec: scala.concurrent.ExecutionContext = context.executionContext

    /** In-memory coalescing of admission waiters. Never persisted (R2: reply
      * targets do not survive restarts); a caller recovers by re-invoking. */
    final case class Admission(pending: Boolean, waiters: Vector[ActorRef[Reply]])
    val admissionIdle = Admission(pending = false, waiters = Vector.empty)
    var admission = admissionIdle

    def broadcaster(waiters: Vector[ActorRef[Reply]]): ActorRef[Reply] =
      context.spawnAnonymous(Behaviors.receiveMessage[Reply] { reply => waiters.foreach(_ ! reply); Behaviors.stopped })

    def deliver(state: State, kind: ResultKind, replyTo: ActorRef[Reply]): Unit = {
      val original = originalInput(parent(state))
      state.identity match {
        case None => context.log.error("delivery attempted without observed identity, operation {}", state.operation)
        case Some(identity) =>
          context.pipeToSelf(BankPaymentHostIO.deliver(kind, original, identity, technical))(ok => Delivered(kind, ok, replyTo))
      }
    }

    def parent(state: State): bank_cash_payment_v1Execution.State =
      bank_cash_payment_v1Execution.codec.decode(state.original.toByteArray)

    def observe(state: State, replyTo: ActorRef[Reply]): Unit =
      if (!state.admitted) {
        admission = admission.copy(waiters = admission.waiters :+ replyTo)
        if (!admission.pending) {
          admission = admission.copy(pending = true)
          val original = originalInput(parent(state))
          val verdict: Future[Either[String, Unit]] =
            BankPaymentHostIO.admit(original, technical).transform {
              case scala.util.Success(true) => scala.util.Success(Right(()))
              case scala.util.Success(false) => scala.util.Success(Left("entry or association not admitted"))
              case scala.util.Failure(error) => scala.util.Success(Left("admission unavailable: " + error.getMessage))
            }
          context.pipeToSelf(verdict)(admitted => Admitted(state.operation, admitted))
        }
      } else {
        val adapter = context.spawnAnonymous(Behaviors.receiveMessage[StrictSagaCoordinator.Reply] { reply =>
          context.self ! Observed(reply, replyTo); Behaviors.stopped
        })
        state.identity match {
          case Some(identity) => coordinator ! StrictSagaCoordinator.Attach(identity, adapter)
          case None => coordinator ! StrictSagaCoordinator.Start(state.operation, state.args, adapter)
        }
      }

    EventSourcedBehavior[Request, Event, State](
      PersistenceId.ofUniqueId(persistenceId),
      State(),
      (state, request) => request match {
        case Invoke(input, replyTo) =>
          val original = ByteString.copyFrom(bank_cash_payment_v1Execution.codec.encode(input))
          val args = bank_payment_hostDefinition.argsCodec.encode(invocationArgs(input))
          val operation = operationIdentity(input)
          if (state.operation.nonEmpty && (state.operation != operation || state.original != original || state.args != args)) {
            Effect.none.thenRun(_ => replyTo ! Conflict("different complete parent input or args under existing invocation"))
          } else if (state.delivered && state.result.exists(ResultKind.terminal)) {
            Effect.none.thenRun(s => replyTo ! completed(s, s.result.getOrElse(ResultKind.OutcomeUnknown)))
          } else if (state.operation.nonEmpty) {
            Effect.none.thenRun(s => observe(s, replyTo))
          } else {
            context.log.debug("associating invocation {} to saga {}", operation, SagaId)
            Effect.persist(Associated(original, args, operation)).thenRun(s => observe(s, replyTo))
          }

        case Observed(StrictSagaCoordinator.Status(status), replyTo) if !validStatus(state, status) =>
          Effect.none.thenRun(_ => replyTo ! Conflict("authoritative identity conflict"))

        case Observed(StrictSagaCoordinator.Status(status), replyTo) =>
          val observed = classify(status)
          val events =
            (state.identity, status.identity) match {
              case (None, Some(identity)) => Vector[Event](IdentityObserved(identity))
              case _ => Vector.empty
            } ++ nextResult(state.result, observed).map(ResultIntent).toVector
          Effect.persist(events).thenRun { s: State =>
            s.result match {
              case Some(kind) if !s.delivered => deliver(s, kind, replyTo)
              case Some(kind) => replyTo ! completed(s, kind)
              case None => replyTo ! Pending("awaiting authoritative result")
            }
          }

        case Admitted(operation, Right(())) if state.operation.nonEmpty && state.operation == operation && !state.admitted =>
          Effect.persist(AdmissionGranted).thenRun { s: State =>
            val waiters = admission.waiters
            admission = admissionIdle
            observe(s, broadcaster(waiters))
          }

        case Admitted(operation, Left(reason)) if state.operation == operation && !state.admitted =>
          Effect.none.thenRun { _ =>
            val waiters = admission.waiters
            admission = admissionIdle
            waiters.foreach(_ ! Pending(reason))
          }

        case _: Admitted => Effect.none

        case Observed(StrictSagaCoordinator.Denied(reason), replyTo) =>
          Effect.none.thenRun(_ => replyTo ! Pending(reason))

        case Observed(StrictSagaCoordinator.ConflictingIdentity, replyTo) =>
          Effect.none.thenRun(_ => replyTo ! Conflict("coordinator identity conflict"))

        case Delivered(kind, true, replyTo) if state.result.contains(kind) =>
          context.log.debug("receipt delivered for operation {} kind {}", state.operation, kind.wire)
          Effect.persist(DeliveryAcknowledged(kind)).thenRun(s => replyTo ! completed(s, kind))

        case Delivered(_, _, replyTo) =>
          Effect.none.thenRun(_ => replyTo ! Pending("delivery unacknowledged"))
      },
      (state, event) => event match {
        case Associated(original, args, operation) => state.copy(original = original, args = args, operation = operation)
        case IdentityObserved(identity) => state.copy(identity = Some(identity))
        case ResultIntent(kind) => state.copy(result = Some(kind), delivered = false)
        case DeliveryAcknowledged(_) => state.copy(delivered = true)
        case AdmissionGranted => state.copy(admitted = true)
      },
    )
  }
}
