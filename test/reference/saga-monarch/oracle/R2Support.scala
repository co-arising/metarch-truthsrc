package reference.inventory.oracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.{AskPattern, Behaviors}
import akka.actor.typed.scaladsl.adapter._
import akka.persistence.typed.PersistenceId
import akka.serialization.SerializationExtension
import akka.util.{ByteString, Timeout}
import com.typesafe.config.ConfigFactory
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.file.{Files, Path, StandardOpenOption}
import net.imadz.monarch.persistence._
import net.imadz.monarch.persistence.batch._
import net.imadz.monarch.persistence.operation.{ExternalOperationPort, OperationProtocol => Op}
import net.imadz.monarch.persistence.resource.{ResourceEvidenceValidator, ResourceProtocol => Resource}
import net.imadz.monarch.persistence.workflow._
import reference.inventory.kernel.BinaryCodecs
import scala.concurrent.{Await, ExecutionContext, Future}
import scala.concurrent.duration._
import scala.jdk.CollectionConverters._

/** Test-only observation/fixture utilities. Journal implementation is the separately pinned supply. */
object R2Support {
  def await[A](future: Future[A]): A = Await.result(future, 6.seconds)
  def eventually[A](read: => A)(predicate: A => Boolean): A = {
    val deadline = System.nanoTime() + 15.seconds.toNanos
    var value = read
    while (!predicate(value) && System.nanoTime() < deadline) { Thread.sleep(20); value = read }
    assert(predicate(value), "R2_EVENTUALLY: " + value); value
  }
  def forced(path: Path, bytes: Array[Byte]): Unit = synchronized {
    Files.createDirectories(path.getParent)
    if (Files.exists(path)) require(java.util.Arrays.equals(Files.readAllBytes(path), bytes), "fixture record conflict")
    else {
      val channel = FileChannel.open(path, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
      try { val b = ByteBuffer.wrap(bytes); while (b.hasRemaining) channel.write(b); channel.force(true) }
      finally channel.close()
    }
  }
  def append(path: Path, value: String): Unit = synchronized {
    Files.createDirectories(path.getParent)
    val channel = FileChannel.open(path, StandardOpenOption.CREATE, StandardOpenOption.APPEND, StandardOpenOption.WRITE)
    try { val b = ByteBuffer.wrap((value + "\n").getBytes("UTF-8")); while (b.hasRemaining) channel.write(b); channel.force(true) }
    finally channel.close()
  }
  def paths(dir: Path): Vector[Path] = if (!Files.exists(dir)) Vector.empty else {
    val stream = Files.walk(dir); try stream.iterator.asScala.filter(Files.isRegularFile(_)).toVector.sortBy(_.toString) finally stream.close()
  }
  def snapshots(dir: Path): Vector[(String, String)] = paths(dir).map(p => dir.relativize(p).toString -> BinaryCodecs.digest(Files.readAllBytes(p).toVector))
  def system(dir: Path, label: String): ActorSystem[Nothing] = {
    Files.createDirectories(dir)
    ActorSystem[Nothing](Behaviors.empty, label, ConfigFactory.parseString(s"""
      serialized-validation-journal.directory = "${dir.resolve("journal")}"
      akka.persistence.snapshot-store.plugin = "akka.persistence.no-snapshot-store"
      akka.loglevel = WARNING
      monarch.operation.check-interval = 30ms
      monarch.operation.io-timeout = 1s
      monarch.operation.max-checks = 80
      monarch.delivery.poll-interval = 30ms
      monarch.delivery.max-polls = 100
    """).withFallback(SerializedValidationJournal.config).withFallback(ConfigFactory.load()))
  }
  def fixture(label: String)(body: (Path, ActorSystem[Nothing]) => Unit): Unit = {
    val dir = java.nio.file.Paths.get(scala.sys.props("inventory.oracle.directory")).resolve(label)
    val sys = system(dir, "r2-" + label)
    try body(dir, sys) finally { sys.terminate(); await(sys.whenTerminated) }
  }
  def ask(job: akka.actor.typed.ActorRef[BatchProtocol.Command], command: akka.actor.typed.ActorRef[BatchProtocol.Reply] => BatchProtocol.Command)
      (implicit system: ActorSystem[_]): BatchProtocol.Reply = {
    import AskPattern._; implicit val timeout: Timeout = Timeout(3.seconds)
    await(job.ask[BatchProtocol.Reply](command))
  }
  def view(job: akka.actor.typed.ActorRef[BatchProtocol.Command])(implicit system: ActorSystem[_]): BatchProtocol.View =
    ask(job, BatchProtocol.Get(_)).asInstanceOf[BatchProtocol.Current].view
  def offer(job: akka.actor.typed.ActorRef[BatchProtocol.Command], n: Int, area: String = "work", key: String = "same", payload: String = "payload")
      (implicit system: ActorSystem[_]): BatchProtocol.Reply =
    ask(job, BatchProtocol.Offer(n.toLong, "item-" + n, ByteString(payload), area, key, _))
  def field(value: Any, name: String): Any = {
    val p = value.asInstanceOf[Product]; p.productElement(p.productElementNames.toVector.indexOf(name))
  }
  def eventName(value: Any): String = value.asInstanceOf[Product].productPrefix
  def events(dir: Path, pid: String)(implicit system: ActorSystem[_]): Vector[AnyRef] = {
    val serialization = SerializationExtension(system.toClassic)
    SerializedValidationJournal.readFile(SerializedValidationJournal.journalPath(dir.resolve("journal"), pid))
      .map(r => serialization.deserialize(r.bytes, r.serializerId, r.manifest).get)
  }
  def manifests(dir: Path, pid: String)(implicit system: ActorSystem[_]): Vector[BatchManifest] =
    events(dir, pid).filter(eventName(_) == "Sealed").map(e => field(field(e, "batch"), "manifest").asInstanceOf[BatchManifest])
  val settings: BatchSettings = BatchSettings(maxAcceptedItems = 8, maxActiveItems = 4, maxActiveBytes = 16384,
    maxConcurrentBatches = 2, pollIntervalMillis = 25, callTimeoutMillis = 2000)
  def area(id: String = "work", policy: BatchPolicy = BatchPolicy.single, resources: Map[String, Int] = Map("permit" -> 1), maxExecutions: Int = 3): AreaDefinition =
    AreaDefinition(id, "1", policy, resources, maxExecutions = maxExecutions)
  def proof(key: String): ByteString = ByteString("test-execution-proof/" + BinaryCodecs.digest(key.getBytes("UTF-8").toVector))

  /** Representative application policy, with a forced external operation ledger, never an in-memory receipt map.
    * This fixture is not an inventory service. All queues, retry clocks, claims and settlements are real R2 actors.
    */
  final class PolicyProgram(val definition: BatchDefinition, directory: Path,
      decide: BatchManifest => BatchCompletion, verification: (Item, String) => Either[String, Unit] = (_, _) => Left("not registered"),
      val capacities: Map[String, Int] = Map("permit" -> 1))(implicit ec: ExecutionContext) extends WorkflowProgram {
    val resourceEvidence = new ResourceEvidenceValidator {
      override def validate(g: Resource.Grant, p: Resource.Proof): Either[String, Unit] =
        if (p.operationKey == g.ownerOperationKey && p.evidence == proof(p.operationKey)) Right(()) else Left("invalid execution proof")
    }
    def operation(m: BatchManifest): Op.Request = Op.Request(m.operationKey, m.batchId, "execute", "test/" + m.area, "1", "test-ledger-1",
      BatchCodec.manifestToBytes(m), Some(m.reservationId))
    private def record(r: Op.Request): Path = directory.resolve(BinaryCodecs.digest(r.operationKey.getBytes("UTF-8").toVector) + ".receipt")
    private def terminal(r: Op.Request): Op.Terminal = Op.Succeeded(r.payload,
      Op.Evidence(r.operationKey, r.fingerprint, r.ledgerEpoch, Some(r.effectKey), proof(r.operationKey)))
    def connector(area: String): ExternalOperationPort = new ExternalOperationPort {
      val connectorId = "test/" + area; val connectorVersion = "1"
      def submit(r: Op.Request): Future[Op.Observation] = if (area == "verify") query(r, None) else Future {
        val m = BatchCodec.manifestFromBytes(r.payload); require(r == operation(m) && m.area == area)
        append(directory.resolve("submissions.log"), r.operationKey)
        forced(record(r), r.payload.toArray); Op.Confirmed(terminal(r))
      }
      def query(r: Op.Request, last: Option[Op.Evidence]): Future[Op.Observation] = Future {
        if (area == "verify") {
          // Read-only authority: verify only original payloads already present in another durable operation receipt.
          val m = BatchCodec.manifestFromBytes(r.payload)
          val saved = paths(directory).filter(_.toString.endsWith(".receipt")).flatMap(p => BatchCodec.manifestFromBytes(ByteString(Files.readAllBytes(p))).items)
          if (m.items.forall(i => saved.exists(s => s.itemId == i.itemId && s.payload == i.payload))) Op.Confirmed(terminal(r))
          else Op.Unknown("no durable original receipt")
        } else if (Files.exists(record(r)) && ByteString(Files.readAllBytes(record(r))) == r.payload) Op.Confirmed(terminal(r))
        else Op.Unknown("ordinary absence does not authorize resubmission")
      }
      override def validateEvidence(r: Op.Request, observed: Op.WithEvidence): Either[String, Unit] = observed match {
        case Op.Confirmed(t) if t == terminal(r) => Right(())
        case _ => Left("original operation identity/evidence mismatch")
      }
    }
    def complete(m: BatchManifest, t: Op.Terminal): Either[String, BatchCompletion] =
      if (t != terminal(operation(m))) Left("invalid terminal") else Right(decide(m))
    override def verifyRoute(item: Item, area: String): Either[String, Unit] = verification(item, area)
  }
  def released(m: BatchManifest, decide: Item => ItemDisposition): BatchCompletion = BatchCompletion(
    m.items.map(i => ItemDecision(i.itemId, decide(i))), ResourceDisposition.Release(proof(m.operationKey).toVector))
}
