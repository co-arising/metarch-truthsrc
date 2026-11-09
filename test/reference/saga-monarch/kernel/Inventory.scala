package reference.inventory.kernel

import scala.concurrent.Future

/** Reference ABI v1. Kernel deliberately has no Akka, protobuf or storage dependency. */
final case class RequestId(value: String) { require(value != null && value.nonEmpty) }
final case class Warehouse(value: String) { require(value != null && value.nonEmpty) }
final case class Sku(value: String) { require(value != null && value.nonEmpty) }
final case class Quantity(value: Int) { require(value > 0, "quantity must be positive") }
final case class TransactionId(value: String) { require(value != null && value.nonEmpty) }
final case class ReservationRequest(requestId: RequestId, warehouseA: Warehouse,
    warehouseB: Warehouse, sku: Sku, quantity: Quantity) {
  require(warehouseA != warehouseB, "two distinct warehouses required")
}
final case class CodecIdentity(id: String, version: Int)
final case class SagaIdentity(transactionId: TransactionId, definitionName: String,
    definitionVersion: Int, argsDigest: String, definitionDigest: String,
    argsCodec: CodecIdentity, planDigest: String)
sealed trait ReservationPhase
object ReservationPhase {
  case object Prepare extends ReservationPhase
  case object Commit extends ReservationPhase
  case object Compensate extends ReservationPhase
}
final case class PhaseIdentity(saga: SagaIdentity, participantId: String, resource: Warehouse,
    stepId: String, phase: ReservationPhase)
final case class ItemIdentity(jobId: String, sequence: Long, itemId: String) {
  require(jobId.nonEmpty && sequence >= 0 && itemId.nonEmpty)
}
final case class Association(item: ItemIdentity, request: ReservationRequest,
    saga: SagaIdentity, resultKey: String)
final case class ReservationResult(transactionId: TransactionId, originalRequest: ReservationRequest)

/** Exactly five cases: three deliverable terminal cases and two observations. */
sealed trait SagaResult { def payload: ReservationResult; def terminal: Boolean }
object SagaResult {
  final case class Succeeded(payload: ReservationResult) extends SagaResult { val terminal = true }
  final case class RejectedBeforeEffects(payload: ReservationResult) extends SagaResult { val terminal = true }
  final case class Compensated(payload: ReservationResult) extends SagaResult { val terminal = true }
  final case class RecoveryRequired(payload: ReservationResult) extends SagaResult { val terminal = false }
  final case class OutcomeUnknown(payload: ReservationResult) extends SagaResult { val terminal = false }
}
final case class PrepareReceipt(identity: PhaseIdentity, reservationId: String, proof: String)
final case class CommitReceipt(identity: PhaseIdentity, reservationId: String, proof: String)
final case class CompensateReceipt(identity: PhaseIdentity, reservationId: String, proof: String)
final case class PrepareCommand(identity: PhaseIdentity, request: ReservationRequest,
    priorPrepare: Option[PrepareReceipt])
final case class CommitCommand(identity: PhaseIdentity, request: ReservationRequest,
    prepareA: PrepareReceipt, prepareB: PrepareReceipt, priorCommit: Option[CommitReceipt])
final case class CompensateCommand(identity: PhaseIdentity, request: ReservationRequest,
    prepared: PrepareReceipt)
sealed trait ParticipantObservation[+A] { def identity: PhaseIdentity }
object ParticipantObservation {
  final case class Confirmed[A](identity: PhaseIdentity, receipt: A) extends ParticipantObservation[A]
  final case class SafeAbsent(identity: PhaseIdentity, proof: String) extends ParticipantObservation[Nothing]
  final case class NotFound(identity: PhaseIdentity) extends ParticipantObservation[Nothing]
  final case class Unknown(identity: PhaseIdentity, reason: String) extends ParticipantObservation[Nothing]
  final case class Rejected(identity: PhaseIdentity, reason: String) extends ParticipantObservation[Nothing]
}
trait WarehouseParticipant {
  def prepare(command: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]]
  def queryPrepare(command: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]]
  def commit(command: CommitCommand): Future[ParticipantObservation[CommitReceipt]]
  def queryCommit(command: CommitCommand): Future[ParticipantObservation[CommitReceipt]]
  def compensate(command: CompensateCommand): Future[ParticipantObservation[CompensateReceipt]]
  def queryCompensate(command: CompensateCommand): Future[ParticipantObservation[CompensateReceipt]]
}
/** Every ensure must durably compare the entire record before any participant effect. */
trait AssociationPort {
  def ensure(value: Association): Future[Association]
  def query(item: ItemIdentity): Future[Option[Association]]
}
final case class ResultEnvelope(key: String, identity: SagaIdentity, result: SagaResult,
    codec: CodecIdentity, bytes: Vector[Byte])
final case class ResultReceipt(key: String, identity: SagaIdentity, bytes: Vector[Byte], proof: String)
final case class ItemResult(item: ItemIdentity, result: SagaResult, delivery: Option[ResultReceipt])
final case class ManifestResult(items: Vector[ItemResult])
sealed trait ResultObservation
object ResultObservation {
  final case class Confirmed(receipt: ResultReceipt) extends ResultObservation
  case object NotFound extends ResultObservation
  final case class Unknown(reason: String) extends ResultObservation
  final case class Conflict(reason: String) extends ResultObservation
}
trait ReservationResultPort {
  def deliver(envelope: ResultEnvelope): Future[ResultObservation]
  def query(envelope: ResultEnvelope): Future[ResultObservation]
}
/** Proof validation is an injected authority, never `proof.nonEmpty` as certification. */
trait EvidenceValidator {
  def prepare(expected: PhaseIdentity, receipt: PrepareReceipt): Either[String, Unit]
  def commit(expected: PhaseIdentity, receipt: CommitReceipt): Either[String, Unit]
  def compensate(expected: PhaseIdentity, receipt: CompensateReceipt): Either[String, Unit]
  def absence(expected: PhaseIdentity, proof: String): Either[String, Unit]
  def result(expected: ResultEnvelope, receipt: ResultReceipt): Either[String, Unit]
  def release(operationKey: String, terminalDigest: String, proof: String): Either[String, Unit]
}
trait ExecutionEvidencePort {
  /** Pure certificate over confirmed terminal data; R2 durably records it before release. */
  def certify(operationKey: String, terminalBytes: Vector[Byte]): String
}
trait RecoveryAuthorization {
  def authorize(identity: SagaIdentity, token: String): Either[String, String]
}
final case class ApplicationPorts(warehouseA: WarehouseParticipant, warehouseB: WarehouseParticipant,
    associations: AssociationPort, results: ReservationResultPort, evidence: EvidenceValidator,
    executionEvidence: ExecutionEvidencePort, recoveryAuthorization: RecoveryAuthorization)
trait ReservationFacade {
  def start(item: ItemIdentity, request: ReservationRequest): Future[SagaResult]
  def query(item: ItemIdentity): Future[SagaResult]
  def publish(item: ItemIdentity): Future[ResultObservation]
  def reconcile(item: ItemIdentity, authorization: String, maxInteractions: Int): Future[SagaResult]
}
