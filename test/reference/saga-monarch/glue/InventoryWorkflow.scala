package reference.inventory.glue

import akka.util.ByteString
import net.imadz.monarch.persistence.batch._
import net.imadz.monarch.persistence.operation.{ExternalOperationPort, OperationProtocol => Op}
import net.imadz.monarch.persistence.resource.{ResourceEvidenceValidator, ResourceProtocol}
import net.imadz.monarch.persistence.workflow._
import reference.inventory.kernel._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

final class InventoryWorkflow(reservations: InventorySaga, ports: ApplicationPorts)(implicit ec: ExecutionContext)
    extends WorkflowProgram {
  val definition: BatchDefinition = BatchDefinition("inventory-job", "1", Vector(
    AreaDefinition("reserve", "1", BatchPolicy.CountOrWait(2, 100L, 1, true), Map("execution-permit" -> 1)),
    AreaDefinition("publish-result", "1", BatchPolicy.single, Map("execution-permit" -> 1))),
    BatchSettings(maxAcceptedItems = 3, maxActiveItems = 3, maxActiveBytes = 12288,
      maxConcurrentBatches = 2, pollIntervalMillis = 25L, callTimeoutMillis = 2000L))
  val capacities: Map[String, Int] = Map("execution-permit" -> 1)
  val resourceEvidence: ResourceEvidenceValidator = new ResourceEvidenceValidator {
    override def validate(grant: ResourceProtocol.Grant, proof: ResourceProtocol.Proof): Either[String, Unit] = {
      val split = proof.evidence.utf8String.split("\\n", -1)
      if (proof.operationKey != grant.ownerOperationKey || split.length != 2) Left("release identity/envelope mismatch")
      else ports.evidence.release(proof.operationKey, split(0), split(1))
    }
  }
  private def key(m: BatchManifest, i: Item): ItemIdentity = ItemIdentity(m.jobId, i.sequence, i.itemId)
  private def resultBytes(value: ManifestResult): ByteString = ByteString.fromArray(BinaryCodecs.manifestResult.encode(value).toArray)
  def operation(m: BatchManifest): Op.Request = {
    require(definition.byId.contains(m.area), "unknown area")
    Op.Request(m.operationKey, m.batchId, "execute", "inventory/" + m.area, "1", "inventory-ledger-1",
      BatchCodec.manifestToBytes(m), Some(m.reservationId))
  }
  private def manifest(r: Op.Request, area: String): BatchManifest = {
    val m = BatchCodec.manifestFromBytes(r.payload)
    require(m.area == area && r == operation(m), "operation original identity mismatch")
    require(m.items.nonEmpty && m.items.size <= definition.byId(area).batch.maxItems &&
      m.items.map(_.itemId).distinct.size == m.items.size, "manifest cardinality mismatch")
    m
  }
  private def evidence(r: Op.Request, bytes: ByteString): Op.Evidence = {
    val proof = ports.executionEvidence.certify(r.operationKey, bytes.toArray.toVector)
    Op.Evidence(r.operationKey, r.fingerprint, r.ledgerEpoch, Some(r.effectKey),
      ByteString(BinaryCodecs.digest(bytes.toArray.toVector) + "\n" + proof))
  }
  def connector(area: String): ExternalOperationPort = {
    require(definition.byId.contains(area), "unknown area")
    new ExternalOperationPort {
      val connectorId = "inventory/" + area; val connectorVersion = "1"
      private def observe(r: Op.Request, submit: Boolean): Future[Op.Observation] = {
        val m = manifest(r, area)
        val reads = m.items.map { item =>
          val id = key(m, item); val request = BinaryCodecs.request.decode(item.payload).get
          val read = if (area == "reserve" && submit) reservations.start(id, request) else reservations.query(id)
          read.flatMap { result =>
            require(result.payload.originalRequest == request, "manifest original payload mismatch")
            if (area == "publish-result" && result.terminal) {
              (if (submit) reservations.publish(id) else reservations.queryPublished(id)).map {
                case ResultObservation.Confirmed(receipt) => ItemResult(id, result, Some(receipt))
                case _ => ItemResult(id, SagaResult.OutcomeUnknown(result.payload), None)
              }
            } else Future.successful(ItemResult(id, result, None))
          }
        }
        Future.sequence(reads).map { items =>
          if (!items.forall(_.result.terminal)) Op.Unknown("one or more original items are nonterminal")
          else {
            val bytes = resultBytes(ManifestResult(items)); Op.Confirmed(Op.Succeeded(bytes, evidence(r, bytes)))
          }
        }.recover { case scala.util.control.NonFatal(e) => Op.Unknown(e.getMessage) }
      }
      def submit(r: Op.Request): Future[Op.Observation] = observe(r, true)
      def query(r: Op.Request, last: Option[Op.Evidence]): Future[Op.Observation] = observe(r, false)
      override def validateEvidence(r: Op.Request, observation: Op.WithEvidence): Either[String, Unit] =
        observation match {
          case Op.Confirmed(t) => validateTerminal(manifest(r, area), t).map(_ => ())
          case _ => Left("only confirmed item results provide evidence")
        }
    }
  }
  private def validateTerminal(m: BatchManifest, terminal: Op.Terminal): Either[String, ManifestResult] = Try {
    require(terminal.isInstanceOf[Op.Succeeded], "operation not successful")
    val r = operation(m); val e = terminal.evidence
    require(e.operationKey == r.operationKey && e.requestDigest == r.fingerprint && e.ledgerEpoch == r.ledgerEpoch &&
      e.taskId.contains(r.effectKey), "operation terminal identity mismatch")
    val proof = e.payload.utf8String.split("\\n", -1)
    val digest = BinaryCodecs.digest(terminal.result.toArray.toVector)
    require(proof.length == 2 && proof(0) == digest, "operation terminal bytes mismatch")
    ports.evidence.release(r.operationKey, digest, proof(1)).fold(e => throw new IllegalArgumentException(e), identity)
    val result = BinaryCodecs.manifestResult.decode(terminal.result.toArray.toVector).get
    require(result.items.map(_.item).toSet == m.items.map(key(m, _)).toSet &&
      result.items.size == m.items.size && result.items.map(_.item).distinct.size == result.items.size, "manifest item conservation")
    result.items.foreach { entry =>
      val original = m.items.find(_.itemId == entry.item.itemId).get
      val request = BinaryCodecs.request.decode(original.payload).get
      val association = InventorySaga.expected(entry.item, request)
      require(entry.result.payload == ReservationResult(association.saga.transactionId, request) && entry.result.terminal,
        "nonterminal or changed original result payload")
      if (m.area == "publish-result") {
        val receipt = entry.delivery.getOrElse(throw new IllegalArgumentException("settle before result acknowledgement"))
        val envelope = ResultEnvelope(association.resultKey, association.saga, entry.result, BinaryCodecs.result.pin,
          BinaryCodecs.result.encode(entry.result))
        require(receipt.key == envelope.key && receipt.identity == envelope.identity && receipt.bytes == envelope.bytes,
          "result acknowledgement identity mismatch")
        ports.evidence.result(envelope, receipt).fold(e => throw new IllegalArgumentException(e), identity)
      }
    }
    result
  }.toEither.left.map(_.getMessage)
  def complete(m: BatchManifest, terminal: Op.Terminal): Either[String, BatchCompletion] =
    validateTerminal(m, terminal).flatMap { result =>
      val decisions = result.items.map { entry => ItemDecision(entry.item.itemId,
        if (m.area == "reserve") ItemDisposition.Route("publish-result", "results")
        else ItemDisposition.Completed(BinaryCodecs.result.encode(entry.result))) }
      val completion = BatchCompletion(decisions, ResourceDisposition.Release(terminal.evidence.payload.toArray.toVector), retainCarried = false)
      BatchConservation.validate(m, completion, definition.byId, definition.settings.maxTransitions).toLeft(completion)
    }
  override def verifyRoute(item: Item, area: String): Either[String, Unit] = Left("main workflow has no query-only verification area")
}
