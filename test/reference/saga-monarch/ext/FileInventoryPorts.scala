package reference.inventory.ext

import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.file.{Files, Path, StandardOpenOption}
import reference.inventory.kernel._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** External protocol fixture, not an inventory algorithm or a replacement Akka journal.
  * One effective writer; immutable records are forced before ACK. Validators perform no I/O.
  * Checksums are fixture evidence, NOT cryptographic authorization for a production trust boundary.
  */
final class FileInventoryPorts(directory: Path, warehouseA: Warehouse, warehouseB: Warehouse,
    recoveryAuthorization: RecoveryAuthorization)(implicit ec: ExecutionContext) {
  Files.createDirectories(directory)
  private val lock = new Object
  private def name(kind: String, key: Vector[Byte]): Path = directory.resolve(kind + "-" + BinaryCodecs.digest(key) + ".record")
  private def read(path: Path): Option[Vector[Byte]] = if (Files.exists(path)) Some(Files.readAllBytes(path).toVector) else None
  private def put(path: Path, bytes: Vector[Byte]): Unit = lock.synchronized {
    read(path) match {
      case Some(existing) => require(existing == bytes, "durable record conflict")
      case None =>
        val channel = FileChannel.open(path, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
        try { val buffer = ByteBuffer.wrap(bytes.toArray); while (buffer.hasRemaining) channel.write(buffer); channel.force(true) }
        finally channel.close()
    }
  }
  private def text(v: String): Vector[Byte] = v.getBytes(java.nio.charset.StandardCharsets.UTF_8).toVector
  private def seal(kind: String, bytes: Vector[Byte]): String = "fixture-v1/" + kind + "/" + BinaryCodecs.digest(text(kind + "|") ++ bytes)
  private def prepareProof(id: PhaseIdentity, reservation: String): String =
    seal("prepare", BinaryCodecs.prepare.encode(PrepareReceipt(id, reservation, "")))
  private def commitProof(id: PhaseIdentity, reservation: String): String =
    seal("commit", BinaryCodecs.commit.encode(CommitReceipt(id, reservation, "")))
  private def compensateProof(id: PhaseIdentity, reservation: String): String =
    seal("compensate", BinaryCodecs.compensate.encode(CompensateReceipt(id, reservation, "")))
  private def absenceProof(id: PhaseIdentity): String = seal("fenced-absence", BinaryCodecs.phaseIdentity.encode(id))
  private def resultProof(key: String, id: SagaIdentity, bytes: Vector[Byte]): String =
    seal("result", text(key) ++ BinaryCodecs.identity.encode(id) ++ bytes)
  private def releaseProof(key: String, digest: String): String = seal("execution-permit", text(key + "|" + digest))
  private def check(ok: Boolean, reason: String): Either[String, Unit] = if (ok) Right(()) else Left(reason)
  val evidence: EvidenceValidator = new EvidenceValidator {
    def prepare(id: PhaseIdentity, r: PrepareReceipt): Either[String, Unit] = check(r.identity == id &&
      id.phase == ReservationPhase.Prepare && r.reservationId.nonEmpty && r.proof == prepareProof(id, r.reservationId), "prepare proof mismatch")
    def commit(id: PhaseIdentity, r: CommitReceipt): Either[String, Unit] = check(r.identity == id &&
      id.phase == ReservationPhase.Commit && r.reservationId.nonEmpty && r.proof == commitProof(id, r.reservationId), "commit proof mismatch")
    def compensate(id: PhaseIdentity, r: CompensateReceipt): Either[String, Unit] = check(r.identity == id &&
      id.phase == ReservationPhase.Compensate && r.reservationId.nonEmpty && r.proof == compensateProof(id, r.reservationId), "compensate proof mismatch")
    def absence(id: PhaseIdentity, proof: String): Either[String, Unit] = check(proof == absenceProof(id), "absence proof mismatch")
    def result(e: ResultEnvelope, r: ResultReceipt): Either[String, Unit] = check(e.result.terminal &&
      e.codec == BinaryCodecs.result.pin && BinaryCodecs.result.encode(e.result) == e.bytes &&
      r.key == e.key && r.identity == e.identity && r.bytes == e.bytes && r.proof == resultProof(e.key, e.identity, e.bytes), "result proof mismatch")
    def release(key: String, digest: String, proof: String): Either[String, Unit] =
      check(proof == releaseProof(key, digest), "execution permit proof mismatch")
  }
  private val associations = new AssociationPort {
    def ensure(value: Association): Future[Association] = Future {
      require(value.saga.argsDigest == BinaryCodecs.digest(BinaryCodecs.request.encode(value.request)))
      put(name("association", BinaryCodecs.item.encode(value.item)), BinaryCodecs.association.encode(value)); value
    }
    def query(item: ItemIdentity): Future[Option[Association]] = Future {
      read(name("association", BinaryCodecs.item.encode(item))).map(BinaryCodecs.association.decode(_).get)
    }
  }
  private def associationBeforeEffects(id: PhaseIdentity, request: ReservationRequest): Unit = {
    require(id.saga.transactionId.value.startsWith("inventory-tx/"), "foreign transaction key")
    val path = directory.resolve("association-" + id.saga.transactionId.value.stripPrefix("inventory-tx/") + ".record")
    val a = BinaryCodecs.association.decode(read(path).getOrElse(throw new IllegalArgumentException("association must precede effects"))).get
    require(a.saga == id.saga && a.request == request, "association/phase request mismatch")
  }
  private def phasePath(id: PhaseIdentity): Path = name("phase", BinaryCodecs.phaseIdentity.encode(id))
  private def fencePath(id: PhaseIdentity): Path = name("fence", BinaryCodecs.phaseIdentity.encode(id.copy(phase = ReservationPhase.Prepare)))
  /** Test/participant cancellation authority. Persist before returning safe absence. Never derives a fence from NotFound. */
  def fence(identity: PhaseIdentity): Future[Unit] = Future { lock.synchronized {
    val prepare = identity.copy(phase = ReservationPhase.Prepare)
    require(read(phasePath(prepare)).isEmpty, "cannot fence confirmed prepare as absent")
    put(fencePath(prepare), BinaryCodecs.phaseIdentity.encode(prepare))
  }}
  private def participant(warehouse: Warehouse): WarehouseParticipant = new WarehouseParticipant {
    private def valid(id: PhaseIdentity, request: ReservationRequest): Unit = {
      require(id.resource == warehouse && (warehouse == request.warehouseA || warehouse == request.warehouseB), "warehouse mismatch")
      associationBeforeEffects(id, request)
    }
    private def reservation(id: PhaseIdentity): String = "reservation/" + BinaryCodecs.digest(
      BinaryCodecs.phaseIdentity.encode(id.copy(phase = ReservationPhase.Prepare)))
    private def observed[A](id: PhaseIdentity, codec: BinaryCodec[A]): ParticipantObservation[A] = read(phasePath(id)) match {
      case Some(bytes) => ParticipantObservation.Confirmed(id, codec.decode(bytes).get)
      case None if id.phase == ReservationPhase.Prepare && read(fencePath(id)).nonEmpty => ParticipantObservation.SafeAbsent(id, absenceProof(id))
      case None => ParticipantObservation.NotFound(id)
    }
    def prepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = Future { lock.synchronized {
      valid(c.identity, c.request); require(c.identity.phase == ReservationPhase.Prepare)
      if (warehouse == c.request.warehouseB) {
        val prior = c.priorPrepare.getOrElse(throw new IllegalArgumentException("prepare B requires A receipt"))
        require(prior.identity.saga == c.identity.saga && prior.identity.resource == c.request.warehouseA)
        evidence.prepare(prior.identity, prior).fold(e => throw new IllegalArgumentException(e), identity)
      } else require(c.priorPrepare.isEmpty)
      if (read(fencePath(c.identity)).isEmpty) {
        val id = reservation(c.identity); val receipt = PrepareReceipt(c.identity, id, prepareProof(c.identity, id))
        put(phasePath(c.identity), BinaryCodecs.prepare.encode(receipt))
      }
      observed(c.identity, BinaryCodecs.prepare)
    }}
    def queryPrepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = Future {
      valid(c.identity, c.request); observed(c.identity, BinaryCodecs.prepare)
    }
    def commit(c: CommitCommand): Future[ParticipantObservation[CommitReceipt]] = Future { lock.synchronized {
      valid(c.identity, c.request); require(c.identity.phase == ReservationPhase.Commit)
      Vector(c.prepareA, c.prepareB).foreach { p =>
        require(p.identity.saga == c.identity.saga)
        evidence.prepare(p.identity, p).fold(e => throw new IllegalArgumentException(e), identity)
        require(read(phasePath(p.identity)).contains(BinaryCodecs.prepare.encode(p)), "prepare receipt not durable")
      }
      require(c.prepareA.identity.resource == c.request.warehouseA && c.prepareB.identity.resource == c.request.warehouseB)
      if (warehouse == c.request.warehouseB) {
        val prior = c.priorCommit.getOrElse(throw new IllegalArgumentException("commit B requires A receipt"))
        require(prior.identity.saga == c.identity.saga && prior.identity.resource == c.request.warehouseA)
        evidence.commit(prior.identity, prior).fold(e => throw new IllegalArgumentException(e), identity)
        require(read(phasePath(prior.identity)).contains(BinaryCodecs.commit.encode(prior)))
      } else require(c.priorCommit.isEmpty)
      require(read(phasePath(c.identity.copy(phase = ReservationPhase.Compensate))).isEmpty, "commit after compensation")
      val id = reservation(c.identity); val r = CommitReceipt(c.identity, id, commitProof(c.identity, id))
      put(phasePath(c.identity), BinaryCodecs.commit.encode(r)); observed(c.identity, BinaryCodecs.commit)
    }}
    def queryCommit(c: CommitCommand): Future[ParticipantObservation[CommitReceipt]] = Future {
      valid(c.identity, c.request); observed(c.identity, BinaryCodecs.commit)
    }
    def compensate(c: CompensateCommand): Future[ParticipantObservation[CompensateReceipt]] = Future { lock.synchronized {
      valid(c.identity, c.request); require(c.identity.phase == ReservationPhase.Compensate)
      require(c.prepared.identity == c.identity.copy(phase = ReservationPhase.Prepare))
      evidence.prepare(c.prepared.identity, c.prepared).fold(e => throw new IllegalArgumentException(e), identity)
      require(read(phasePath(c.prepared.identity)).contains(BinaryCodecs.prepare.encode(c.prepared)))
      require(read(phasePath(c.identity.copy(phase = ReservationPhase.Commit))).isEmpty, "compensate after commit")
      val id = c.prepared.reservationId; val r = CompensateReceipt(c.identity, id, compensateProof(c.identity, id))
      put(phasePath(c.identity), BinaryCodecs.compensate.encode(r)); observed(c.identity, BinaryCodecs.compensate)
    }}
    def queryCompensate(c: CompensateCommand): Future[ParticipantObservation[CompensateReceipt]] = Future {
      valid(c.identity, c.request); observed(c.identity, BinaryCodecs.compensate)
    }
  }
  private val results = new ReservationResultPort {
    private def receipt(e: ResultEnvelope): ResultReceipt = ResultReceipt(e.key, e.identity, e.bytes, resultProof(e.key, e.identity, e.bytes))
    private def record(e: ResultEnvelope): Vector[Byte] = BinaryCodecs.identity.encode(e.identity) ++ e.bytes
    private def valid(e: ResultEnvelope): Unit = {
      require(e.result.terminal && e.result.payload.transactionId == e.identity.transactionId)
      require(e.codec == BinaryCodecs.result.pin && BinaryCodecs.result.encode(e.result) == e.bytes)
    }
    def deliver(e: ResultEnvelope): Future[ResultObservation] = Future {
      valid(e); put(name("result", text(e.key)), record(e)); ResultObservation.Confirmed(receipt(e))
    }
    def query(e: ResultEnvelope): Future[ResultObservation] = Future {
      valid(e); read(name("result", text(e.key))) match {
        case None => ResultObservation.NotFound
        case Some(bytes) if bytes == record(e) => ResultObservation.Confirmed(receipt(e))
        case _ => ResultObservation.Conflict("same key, different original identity or result bytes")
      }
    }
  }
  private val executionEvidence = new ExecutionEvidencePort {
    def certify(key: String, bytes: Vector[Byte]): String = {
      val result = BinaryCodecs.manifestResult.decode(bytes).get
      require(result.items.nonEmpty && result.items.forall(_.result.terminal), "cannot certify unknown item result")
      releaseProof(key, BinaryCodecs.digest(bytes))
    }
  }
  val ports: ApplicationPorts = ApplicationPorts(participant(warehouseA), participant(warehouseB), associations,
    results, evidence, executionEvidence, recoveryAuthorization)
}
