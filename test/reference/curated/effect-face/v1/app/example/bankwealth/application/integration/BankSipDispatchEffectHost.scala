package example.bankwealth.application.integration

import scala.concurrent.Future

import akka.actor.typed.ActorRef
import com.google.protobuf.ByteString

/** Durable external-effect host of the SIP dispatch pipeline: owns the intent,
  * the observed external evidence and the authorized retry, for exactly one
  * dispatch operation.
  *
  * Semantics contracts:
  * - Invoke is idempotent: the same complete input under the same operation
  *   identity is coalesced; a different input under a live effect is a
  *   Conflict. Every reply is derived from durable state, so a caller that
  *   re-invokes after any crash recovers its answer (R2: reply targets are
  *   in-memory coalesced and never persisted; caller-side ask timeout and
  *   retry are part of the contract).
  * - No implicit retry: an unobserved effect answers Pending. A retry happens
    * only through Reconcile with explicit authorization and durable absent
    * evidence; the observation is cleared on the authorized retry (the journal
    * keeps the full evidence history) so stale evidence can never answer
    * during the retry window (R3).
  * - Observation validation is fail-closed: an unknown status wire refuses. */
object BankSipDispatchEffectHost {

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
    execute: EffectBinding[BankSipDispatchOperation, BankSipDispatchObservation],
    query: EffectBinding[BankSipDispatchOperation, Option[BankSipDispatchObservation]],
    reconcile: EffectBinding[BankSipDispatchReconcile, Boolean],
  )

  /** The obligation table drives install-time exact-binding checks and the
    * ownership evidence — written once, never per binding. */
  private val obligations: Vector[(String, String, Bindings => EffectBinding[_, _])] = Vector(
    ("BankSipDispatchExecute", "execute", _.execute),
    ("BankSipDispatchQuery", "query", _.query),
    ("BankSipDispatchReconcilePort", "reconcile", _.reconcile),
  )

  private val ImplementationVersion = "bank-v1-1"
  private val Artifact = "BankSipTechnical"

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

  final class Installed private[BankSipDispatchEffectHost] (private val bindings: Bindings) {
    def execute(input: BankSipDispatchOperation): Future[BankSipDispatchObservation] = bindings.execute.run(input)
    def query(input: BankSipDispatchOperation): Future[Option[BankSipDispatchObservation]] = bindings.query.run(input)
    def reconcile(input: BankSipDispatchReconcile): Future[Boolean] = bindings.reconcile.run(input)
  }

  sealed trait Request
  final case class Invoke(input: BankSipDispatchExecution.State, replyTo: ActorRef[Reply]) extends Request
  final case class Reconcile(input: BankSipDispatchExecution.State,
      decision: ReconcileDecision, authorization: String, replyTo: ActorRef[Reply]) extends Request
  private[bankwealth] final case class Observed(operation: String,
      round: Long, value: Option[BankSipDispatchObservation], fromQuery: Boolean) extends Request
  private[bankwealth] final case class Authorized(operation: String,
      round: Long, allowed: Boolean, decision: ReconcileDecision, authorization: String,
      proof: ByteString) extends Request

  sealed trait Reply
  final case class Completed(result: BankSipDispatchExecution.DispatchCashResult) extends Reply
  final case class Pending(reason: String) extends Reply
  final case class Conflict(reason: String) extends Reply

  sealed trait Event
  final case class Intent(original: ByteString, operation: String) extends Event
  final case class ObservationStored(value: ByteString) extends Event
  final case class RetryAuthorized(authorization: String, evidence: ByteString) extends Event

  final case class State(original: ByteString = ByteString.EMPTY,
      operation: String = "", observation: ByteString = ByteString.EMPTY)

  def request(input: BankSipDispatchExecution.State): BankSipDispatchRequest =
    BankSipDispatchRequest(input.inputs.occurrenceId, input.inputs.occurrence)

  /** Durable operation identity: scheme, saga and step tokens plus the
    * occurrence key, length-prefixed and SHA-256 digested. */
  def operationIdentity(input: BankSipDispatchExecution.State): String = {
    require(input != null && input.inputs != null, "complete durable external input required")
    val parts = Vector(
      "bankwealth",
      "bank-sip-dispatch-v1", "bank-v1-1",
      "bank-sip-dispatch", "bank-v1-1",
      "dispatch-cash", "DispatchSipCash",
      input.inputs.occurrenceId.value,
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

  def statusOf(value: BankSipDispatchObservation): ObservationStatus =
    ObservationStatus
        .fromWire(value.status).getOrElse(throw new IllegalArgumentException("unknown external observation status"))

  /** Full same-operation same-request observation with status-consistent
    * evidence; anything else refuses. */
  def checked(value: BankSipDispatchObservation, expected: BankSipDispatchOperation): BankSipDispatchObservation = {
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

  def terminalOutcome(observation: Option[BankSipDispatchObservation]):
      Option[BankSipDispatchExecution.DispatchCashResult] =
    observation.flatMap { value =>
      statusOf(value) match {
        case ObservationStatus.Confirmed =>
            Some(BankSipDispatchExecution.DispatchCashDispatched(value.result.get.operationId))
        case ObservationStatus.Rejected => Some(BankSipDispatchExecution.DispatchCashRefused)
        case ObservationStatus.Failed => Some(BankSipDispatchExecution.DispatchCashUnavailable)
        case ObservationStatus.Absent | ObservationStatus.Unknown => None
      }
    }

  def isReconcileAuthorized(decision: ReconcileDecision, proof: Option[BankSipDispatchObservation]): Boolean =
    (decision, proof) match {
      case (ReconcileDecision.Retry, Some(value))
          if statusOf(value) == ObservationStatus.Absent && value.evidence.nonEmpty => true
      case (ReconcileDecision.Query, Some(value)) if statusOf(value) == ObservationStatus.Unknown => true
      case _ => false
    }

  def applyEvent(state: State, event: Event): State = event match {
    case Intent(original, op) => state.copy(original = original, operation = op)
    case ObservationStored(value) => state.copy(observation = value)
    case RetryAuthorized(_, _) => state.copy(observation = ByteString.EMPTY)
  }
}
