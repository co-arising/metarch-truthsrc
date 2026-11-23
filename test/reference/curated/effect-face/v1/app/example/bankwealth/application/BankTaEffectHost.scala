package example.bankwealth.application

import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal

import akka.actor.typed.{ActorRef, Behavior}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.{PersistenceId, RecoveryCompleted}
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import com.google.protobuf.ByteString
import example.bankwealth.domain.values.{BankTaEffectOperation, BankTaEffectObservation, BankTaEffectReconcile, BankTaEffectRequest}

/** Durable external-effect host of the TA submission pipeline: owns the
  * intent, the observed TA evidence and the authorized retry, for exactly one
  * submission operation.
  *
  * Semantics contracts (identical to the dispatch effect host — the effect
  * face's one shape, per-case knowledge):
  * - Invoke is idempotent; every reply derives from durable state (R2:
    * waiters are in-memory coalesced, never persisted; callers own ask
    * timeout and retry).
  * - No implicit retry; Reconcile demands explicit authorization and durable
    * absent evidence; the authorized retry clears the observation (the
    * journal keeps the evidence history) so stale evidence cannot answer
    * during the retry window (R3).
  * - Observation validation is fail-closed: an unknown status wire refuses. */
object BankTaEffectHost {

  /** External observation status; `wire` is the domain value's spelling. */
  sealed trait ObservationStatus { def wire: String }
  object ObservationStatus {
    case object Confirmed extends ObservationStatus { val wire = "confirmed" }
    case object Rejected extends ObservationStatus { val wire = "rejected" }
    case object Failed extends ObservationStatus { val wire = "failed" }
    case object Absent extends ObservationStatus { val wire = "absent" }
    case object Unknown extends ObservationStatus { val wire = "unknown" }

    val all: Vector[ObservationStatus] = Vector(Confirmed, Rejected, Failed, Absent, Unknown)

    def fromWire(wire: String): Option[ObservationStatus] = all.find(_.wire == wire)
  }

  /** Reconciliation decision; `wire` is the authorized-command spelling. */
  sealed trait ReconcileDecision { def wire: String }
  object ReconcileDecision {
    case object Query extends ReconcileDecision { val wire = "query" }
    case object Retry extends ReconcileDecision { val wire = "retry" }

    def fromWire(wire: String): Option[ReconcileDecision] =
      Vector(Query, Retry).find(_.wire == wire)
  }

  /** Exact-binding record of one handwritten effect implementation: one face,
    * no optional slots, a null face fails at construction. */
  final case class EffectBinding[I, O](id: String, version: String, run: I => Future[O]) {
    require(run != null, s"effect implementation $id carries no run face")
  }

  final case class Bindings(
    execute: EffectBinding[BankTaEffectOperation, BankTaEffectObservation],
    query: EffectBinding[BankTaEffectOperation, Option[BankTaEffectObservation]],
    reconcile: EffectBinding[BankTaEffectReconcile, Boolean],
  )

  /** The obligation table drives install-time exact-binding checks and the
    * ownership evidence — written once, never per binding. */
  private val obligations: Vector[(String, String, Bindings => EffectBinding[_, _])] = Vector(
    ("BankTaEffectExecute", "execute", _.execute),
    ("BankTaEffectQuery", "query", _.query),
    ("BankTaEffectReconcilePort", "reconcile", _.reconcile),
  )

  private val ImplementationVersion = "bank-v1-1"
  private val Artifact = "BankTaTechnical"

  /** Static binding ownership per implementation: (id, role, artifact,
    * version, boundary). Ownership is a static binding obligation, not proof
    * of business authorization, replay or deployment. */
  def bindingOwnership(bindings: Bindings): Vector[(String, String, String, String, String)] =
    obligations.map { case (_, role, bound) =>
      val b = bound(bindings)
      (b.id, role, Artifact, ImplementationVersion, "handwritten-composition-root")
    }

  def install(bindings: Bindings): Installed = {
    require(bindings != null, "complete effect callback bindings required")
    for ((declaredId, role, bound) <- obligations) {
      val b = bound(bindings)
      require(b.id == "bankwealth." + declaredId,
          s"effect implementation identity mismatch for $role: expected bankwealth.$declaredId, got ${b.id}")
      require(b.version == ImplementationVersion, s"effect implementation version mismatch for $role")
    }
    new Installed(bindings)
  }

  final class Installed private[BankTaEffectHost] (private val bindings: Bindings) {
    def execute(input: BankTaEffectOperation): Future[BankTaEffectObservation] = bindings.execute.run(input)
    def query(input: BankTaEffectOperation): Future[Option[BankTaEffectObservation]] = bindings.query.run(input)
    def reconcile(input: BankTaEffectReconcile): Future[Boolean] = bindings.reconcile.run(input)
  }

  sealed trait Request
  final case class Invoke(input: BankTaSubmissionExecution.State, replyTo: ActorRef[Reply]) extends Request
  final case class Reconcile(input: BankTaSubmissionExecution.State,
      decision: ReconcileDecision, authorization: String, replyTo: ActorRef[Reply]) extends Request
  private final case class Observed(operation: String,
      round: Long, value: Option[BankTaEffectObservation], fromQuery: Boolean) extends Request
  private final case class Authorized(operation: String,
      round: Long, allowed: Boolean, decision: ReconcileDecision, authorization: String,
      proof: ByteString) extends Request

  sealed trait Reply
  final case class Completed(result: BankTaSubmissionExecution.SubmitTaResult) extends Reply
  final case class Pending(reason: String) extends Reply
  final case class Conflict(reason: String) extends Reply

  sealed trait Event
  final case class Intent(original: ByteString, operation: String) extends Event
  final case class ObservationStored(value: ByteString) extends Event
  final case class RetryAuthorized(authorization: String, evidence: ByteString) extends Event

  final case class State(original: ByteString = ByteString.EMPTY,
      operation: String = "", observation: ByteString = ByteString.EMPTY)

  def request(input: BankTaSubmissionExecution.State): BankTaEffectRequest =
    BankTaEffectRequest(input.inputs.taRequestId, input.inputs.fundOrderId, input.inputs.paymentTxId)

  /** Durable operation identity: scheme, saga and step tokens plus the
    * request key, length-prefixed and SHA-256 digested. */
  def operationIdentity(input: BankTaSubmissionExecution.State): String = {
    require(input != null && input.inputs != null, "complete durable external input required")
    val parts = Vector(
      "bankwealth",
      "bank-ta-submission-v1", "bank-v1-1",
      "bank-ta-effect", "bank-v1-1",
      "submit-ta", "SubmitPaidTaRequest",
      input.inputs.taRequestId.value,
    )
    parts.foreach(part => require(part != null && part.nonEmpty, "stable initial external identity required"))
    val buffer = new java.io.ByteArrayOutputStream()
    val out = new java.io.DataOutputStream(buffer)
    parts.foreach { part =>
      val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      out.writeInt(bytes.length)
      out.write(bytes)
    }
    out.flush()
    java.security.MessageDigest.getInstance("SHA-256").digest(buffer.toByteArray).map(b => f"${b & 0xff}%02x").mkString
  }

  private def decode(bytes: ByteString): Option[BankTaEffectObservation] =
    if (bytes.isEmpty) None
    else Some(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankTaEffectObservationPB(
      example.bankwealth.infrastructure.proto.BankTaEffectObservationPB.parseFrom(bytes.toByteArray)))

  private def encode(value: BankTaEffectObservation): ByteString =
    example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankTaEffectObservationPB(value).toByteString

  private def statusOf(value: BankTaEffectObservation): ObservationStatus =
    ObservationStatus
        .fromWire(value.status).getOrElse(throw new IllegalArgumentException("unknown external observation status"))

  /** Full same-operation same-request observation with status-consistent
    * evidence; anything else refuses. */
  private def checked(value: BankTaEffectObservation, expected: BankTaEffectOperation): BankTaEffectObservation = {
    require(value != null && value.operation == expected.operation && value.request == expected.request &&
      value.result != null &&
          value.evidence != null, "complete same-operation same-request effect observation required")
    statusOf(value) match {
      case ObservationStatus.Confirmed => require(value.result.nonEmpty &&
          value.result.get != null && value.evidence.nonEmpty, "full durable result and evidence required")
      case ObservationStatus.Rejected | ObservationStatus.Failed | ObservationStatus.Absent =>
          require(value.result.isEmpty && value.evidence.nonEmpty,
              "authoritative non-success or absent evidence required")
      case ObservationStatus.Unknown => require(value.result.isEmpty, "unknown is not a result")
    }
    value
  }

  private def terminal(state: State): Option[BankTaSubmissionExecution.SubmitTaResult] =
    decode(state.observation).flatMap { value =>
      statusOf(value) match {
        case ObservationStatus.Confirmed =>
            Some(BankTaSubmissionExecution.SubmitTaObserved(value.result.get.taRequestId))
        case ObservationStatus.Rejected => Some(BankTaSubmissionExecution.SubmitTaRefused)
        case ObservationStatus.Failed => Some(BankTaSubmissionExecution.SubmitTaUnavailable)
        case ObservationStatus.Absent | ObservationStatus.Unknown => None
      }
    }

  def apply(persistenceId: String, installed: Installed): Behavior[Request] = Behaviors.setup { context =>
    require(persistenceId != null && persistenceId.nonEmpty && installed != null,
        "owned effect persistence and all installed callbacks required")
    implicit val ec: ExecutionContext = context.executionContext

    // In-memory coalescing of pending waiters; never persisted (R2). A caller
    // recovers by re-invoking: every reply is derived from durable state.
    var pending = false
    var round = 0L
    var waiters = Vector.empty[ActorRef[Reply]]

    def answer(value: Reply): Unit = { waiters.distinct.foreach(_ ! value); waiters = Vector.empty }

    def safe[A](body: => Future[A]): Future[A] =
      try { val future = body; require(future != null, "effect callback future required"); future }
      catch { case NonFatal(e) => Future.failed(e) }

    def operation(state: State): BankTaEffectOperation =
      BankTaEffectOperation(state.operation,
          request(BankTaSubmissionExecution.codec.decode(state.original.toByteArray)))

    def execute(state: State): Unit = {
      pending = true
      round += 1
      val current = round
      val expected = operation(state)
      context.log.debug("effect execute attempt {} for operation {}", current, state.operation)
      context.pipeToSelf(safe(installed.execute(expected)).map(v => Some(checked(v, expected)))) {
        case scala.util.Success(value) => Observed(state.operation, current, value, fromQuery = false)
        case scala.util.Failure(_) => Observed(state.operation, current, None, fromQuery = false)
      }
    }

    def query(state: State): Unit = {
      pending = true
      round += 1
      val current = round
      val expected = operation(state)
      context.pipeToSelf(safe(installed.query(expected)).map { value =>
        require(value != null, "optional query observation required")
        value.map(v => checked(v, expected))
      }) {
        case scala.util.Success(value) => Observed(state.operation, current, value, fromQuery = true)
        case scala.util.Failure(_) => Observed(state.operation, current, None, fromQuery = true)
      }
    }

    def completed(state: State, fromQuery: Boolean): Unit = terminal(state) match {
      case Some(value) => answer(Completed(value))
      case None if !fromQuery => query(state)
      case None => answer(Pending("effect outcome remains unknown or absent; no implicit retry"))
    }

    EventSourcedBehavior[Request, Event, State](
      PersistenceId.ofUniqueId(persistenceId),
      State(),
      (state, command) => command match {
        case Invoke(input, replyTo) =>
          val original = ByteString.copyFrom(BankTaSubmissionExecution.codec.encode(input))
          val op = operationIdentity(input)
          if (state.operation.nonEmpty && (state.operation != op || state.original != original)) {
            Effect.none.thenRun(_ => replyTo ! Conflict("different complete original input under effect identity"))
          } else {
            waiters :+= replyTo
            if (state.operation.isEmpty) Effect.persist(Intent(original, op)).thenRun(execute)
            else terminal(state) match {
              case Some(value) => Effect.none.thenRun(_ => answer(Completed(value)))
              case None => if (!pending) query(state); Effect.none
            }
          }

        case Observed(op,
            observedRound, value, fromQuery) if pending && op == state.operation && observedRound == round =>
          pending = false
          val bytes = value.map(encode).getOrElse(ByteString.EMPTY)
          // A no-answer callback (None) never wipes the durable observation —
          // the evidence chain is cleared only by an authorized retry (R3).
          if (value.isDefined && bytes != state.observation) {
            Effect.persist(ObservationStored(bytes)).thenRun(completed(_, fromQuery))
          } else {
            Effect.none.thenRun(completed(_, fromQuery))
          }

        case Reconcile(input, decision, authorization, replyTo) =>
          val original = ByteString.copyFrom(BankTaSubmissionExecution.codec.encode(input))
          val op = operationIdentity(input)
          val proof = decode(state.observation)
          val authorizedFor = (decision, proof) match {
            case (ReconcileDecision.Retry, Some(value))
                 if statusOf(value) == ObservationStatus.Absent && value.evidence.nonEmpty => true
            case (ReconcileDecision.Query, Some(value)) if statusOf(value) == ObservationStatus.Unknown => true
            case _ => false
          }
          if (state.operation != op || state.original != original) {
            Effect.none.thenRun(_ => replyTo ! Conflict("reconcile must retain exact durable original and operation"))
          } else if (pending ||
              terminal(state).nonEmpty || authorization == null || authorization.isEmpty || !authorizedFor) {
            Effect.none.thenRun(_ =>
                replyTo ! Pending("reconcile requires authority and durable absent or unknown evidence"))
          } else {
            waiters :+= replyTo
            pending = true
            round += 1
            val current = round
            val evidence = state.observation
            context.pipeToSelf(safe(installed.reconcile(
              BankTaEffectReconcile(op, request(input), decision.wire, proof, authorization)))) {
              case scala.util.Success(allowed) => Authorized(op, current, allowed, decision, authorization, evidence)
              case scala.util.Failure(_) => Authorized(op, current, allowed = false, decision, authorization, evidence)
            }
            Effect.none
          }

        case Authorized(op,
            observedRound, allowed, decision, authorization, proof) if pending &&
                op == state.operation && observedRound == round =>
          pending = false
          if (!allowed || proof != state.observation) {
            context.log.debug("reconciliation denied for operation {}", state.operation)
            Effect.none.thenRun(_ => answer(Pending("reconciliation not authorized")))
          } else if (decision == ReconcileDecision.Query) {
            Effect.none.thenRun(query)
          } else {
            context.log.debug("retry authorized for operation {}", state.operation)
            Effect.persist(RetryAuthorized(authorization, proof)).thenRun(execute)
          }

        case _ => Effect.none
      },
      (state, event) => event match {
        case Intent(original, op) => state.copy(original = original, operation = op)
        case ObservationStored(value) => state.copy(observation = value)
        case RetryAuthorized(_, _) => state.copy(observation = ByteString.EMPTY)
      },
    ).receiveSignal { case (state, RecoveryCompleted) if state.operation.nonEmpty &&
        terminal(state).isEmpty => query(state) }
  }
}
