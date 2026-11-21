package example.stockreservation.application.services.transactor

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.{ActorRef, ActorSystem}
import akka.actor.typed.scaladsl.AskPattern._
import akka.actor.typed.scaladsl.adapter._
import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import akka.cluster.typed.Cluster
import akka.cluster.MemberStatus
import akka.util.Timeout
import com.typesafe.config.ConfigFactory
import example.stockreservation.application.aggregates.LotProtocol
import example.stockreservation.domain.entities.LotEntity
import net.imadz.infra.saga.strict.{StrictSagaCoordinator, StrictState, StrictStatus}
import org.mongodb.scala.MongoClient
import org.mongodb.scala.bson.collection.immutable.Document
import play.api.libs.json._
import java.nio.file.{Files, Path, Paths, StandardCopyOption}
import java.nio.charset.StandardCharsets
import scala.concurrent.{Await, ExecutionContext}
import scala.concurrent.duration._

/** 双 JVM SIGTERM 迁移套件（D 模板全量落地，编译面）：production 单例交接，
  * 只有本地观察/门不同。运行需可达 Mongo 与 fork 的测试 JVM（本门环境无
  * mongod 实证，F8 裁定编译面覆盖）；目录/数据库不自动删除。 */
private[transactor] object CompositionDeploymentFacts {
  val ReconcileToken = "composition-reconcile-token"
  val SeedWafers = Vector("w-001", "w-002", "w-003", "w-004")
  val SplitWafers = Vector("w-001", "w-002")
  val ChildBaseWafers = Vector("w-101")
  val ManifestSeed = "manifest-seed-v1"
  val From = "parent-lot"
  val To = "child-lot"

  private val OwnedUris = scala.collection.mutable.Set.empty[String]
  private def dbNameOf(uri: String): String = uri.split("/").last
  private def journalCollections(client: MongoClient, db: String): Vector[String] =
    Await.result(client.getDatabase(db).listCollectionNames().toFuture(), 10.seconds).toVector
      .filter(_.contains("journal")).sorted

  private final case class JournalBatch(collection: String, document: Document, from: Long,
                                        to: Long, events: Vector[org.bson.BsonDocument])
  private def number(d: org.bson.BsonDocument, key: String): Long =
    d.get(key).asNumber().longValue()

  private def batches(client: MongoClient, uri: String, pid: String): Vector[JournalBatch] = {
    val db = dbNameOf(uri)
    val result = journalCollections(client, db).flatMap { c =>
      Await.result(client.getDatabase(db).getCollection(c).find(Document("pid" -> pid)).toFuture(),
        10.seconds)
        .map { d =>
          val raw = d.toBsonDocument
          val events = raw.getArray("events").getValues.toArray.toVector
            .map(_.asInstanceOf[org.bson.BsonValue].asDocument())
          val from = number(raw, "from")
          val to = number(raw, "to")
          require(events.nonEmpty && events.head.getString("pid").getValue == pid,
            "wrong batch identity")
          require(events.forall(_.getString("pid").getValue == pid), "mixed batch identities")
          require(events.map(number(_, "sn")) == (from to to).toVector,
            "invalid batch bounds or sequence")
          JournalBatch(c, d, from, to, events)
        }
    }.sortBy(_.from)
    val sequence = result.flatMap(_.events.map(number(_, "sn")))
    require(sequence == (1L to sequence.size.toLong).toVector,
      "journal is not a contiguous global prefix")
    result
  }

  def rawEvents(uri: String, pid: String): Vector[String] = {
    val client = MongoClient(uri)
    try batches(client, uri, pid).flatMap(_.events.map(_.toJson)) finally client.close()
  }

  private def eventsOf(kit: ActorTestKit, pid: String): Vector[akka.persistence.query.EventEnvelope] = {
    implicit val mat: akka.stream.Materializer =
      akka.stream.SystemMaterializer(kit.system).materializer
    val journal = akka.persistence.query.PersistenceQuery(kit.system)
      .readJournalFor[akka.contrib.persistence.mongodb.ScalaDslMongoReadJournal](
        "akka-contrib-mongodb-persistence-readjournal")
    val events = Await.result(journal.currentEventsByPersistenceId(pid, 1L, Long.MaxValue)
      .runWith(akka.stream.scaladsl.Sink.seq), 15.seconds).toVector
    assert(events.map(_.sequenceNr) == (1L to events.size.toLong).toVector,
      "query must observe the full prefix")
    events
  }

  def hostPid(operation: String, occurrence: String): String =
    WaferTransferHost.persistenceIdFor(operation, occurrence).id
  def childPid(operation: String, occurrence: String): String =
    WaferTransferHost.childPersistenceId(operation, occurrence)
  val SplitSagaPid = WaferSplitSagaEntry.persistenceId.id
  val MergeSagaPid = WaferMergeSagaEntry.persistenceId.id

  def durableEffects(uri: String, operation: String): Map[String, Vector[String]] =
    Vector(SplitSagaPid, MergeSagaPid, childPid(operation, "occ-1"),
      lotPid(From), lotPid(To)).map(pid => pid -> rawEvents(uri, pid)).toMap

  def lotPid(entityId: String): String =
    akka.persistence.typed.PersistenceId(LotProtocol.entityKey.name, entityId).id

  def assertHostTrace(kit: ActorTestKit, operation: String): Unit = {
    val events = eventsOf(kit, hostPid(operation, "occ-1")).map(_.event)
    val start = events.collect { case e: WaferTransferHost.OperationStarted => e }
    assert(start.size == 1 && start.head.manifest == ManifestSeed &&
      start.head.wafers == SplitWafers)
    WaferTransferHost.StepIds.foreach { step =>
      val intents = events.zipWithIndex.collect {
        case (e: WaferTransferHost.InvocationIntentPersisted, i) if e.stepId == step => e -> i
      }
      val checkpoints = events.zipWithIndex.collect {
        case (e: WaferTransferHost.StepCheckpointed, i) if e.stepId == step => e -> i
      }
      assert(intents.size == 1 && checkpoints.size == 1 && intents.head._2 < checkpoints.head._2)
    }
    assert(events.count(_.isInstanceOf[WaferTransferHost.OperationConcluded]) == 1)
  }

  def assertExactlyOnce(kit: ActorTestKit, uri: String, operation: String): Unit = {
    val client = MongoClient(uri)
    val sagaPids = try journalCollections(client, dbNameOf(uri)).flatMap { c =>
      Await.result(client.getDatabase(dbNameOf(uri)).getCollection(c).find().toFuture(), 10.seconds)
        .map(_.toBsonDocument.getString("pid").getValue).filter(_.startsWith("strict-saga/"))
    }.toSet finally client.close()
    assert(sagaPids == Set(SplitSagaPid, MergeSagaPid),
      "exactly the two declared saga persistenceIds")
    Vector(SplitSagaPid -> WaferTransferHost.SplitStep,
      MergeSagaPid -> WaferTransferHost.MergeStep).foreach { case (pid, step) =>
      val events = eventsOf(kit, pid)
      val started = events.collect {
        case e if e.event.isInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started] =>
          e.event.asInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started]
      }
      assert(started.size == 1 && started.head.identity.transactionId ==
        WaferTransferHost.txidFor(operation, "occ-1", step),
        "each saga must start exactly once with its stable transaction identity")
    }
    val child = eventsOf(kit, childPid(operation, "occ-1")).map(_.event)
    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunStarted]) == 1)
    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1)
    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]) == 3)
  }

  def aggregateBehavior(entityId: String): akka.actor.typed.Behavior[LotProtocol.LotCommand] =
    akka.persistence.typed.scaladsl.EventSourcedBehavior(
      persistenceId = akka.persistence.typed.PersistenceId(LotProtocol.entityKey.name, entityId),
      emptyState = LotEntity.empty(entityId),
      commandHandler = LotProtocol.commandHandler,
      eventHandler = LotEntity.applyEvent)

  def initSharding(kit: ActorTestKit): ClusterSharding = {
    val sharding = ClusterSharding(kit.system)
    sharding.init(
      akka.cluster.sharding.typed.scaladsl.Entity(LotProtocol.entityKey)(ctx =>
        aggregateBehavior(ctx.entityId)))
    sharding
  }
  def entityRef(sharding: ClusterSharding, id: String): EntityRef[LotProtocol.LotCommand] =
    sharding.entityRefFor(LotProtocol.entityKey, id)
  def askNow[Cmd, Res](kit: ActorTestKit, ref: akka.actor.typed.RecipientRef[Cmd])(
      f: ActorRef[Res] => Cmd): Res = {
    implicit val system: ActorSystem[_] = kit.system
    implicit val askTimeout: Timeout = Timeout(15.seconds)
    Await.result(ref.ask(f), 15.seconds)
  }
  def carriedOf(kit: ActorTestKit,
      ref: akka.actor.typed.RecipientRef[LotProtocol.LotCommand]): Set[String] =
    askNow(kit, ref)(reply => LotProtocol.GetLotState(reply)).carried.keySet.toSet
  def seedFunds(kit: ActorTestKit, sharding: ClusterSharding, id: String, txid: String,
      wafers: Vector[String]): Unit = {
    val ref = entityRef(sharding, id)
    assert(askNow(kit, ref)(r =>
      LotProtocol.ReserveWaferAddition(txid, id, wafers.toList, r)).error.isEmpty)
    assert(askNow(kit, ref)(r => LotProtocol.CommitWaferAddition(txid, id, r)).error.isEmpty)
  }
  def begin(kit: ActorTestKit, ref: ActorRef[WaferTransferHost.Command],
      operation: String): WaferTransferHost.OperationReply =
    askNow(kit, ref)(r => WaferTransferHost.BeginOperation(operation, "occ-1", From, To,
      SplitWafers, ManifestSeed, r))
  def progress(kit: ActorTestKit,
      ref: ActorRef[WaferTransferHost.Command]): WaferTransferHost.ProgressReport =
    askNow(kit, ref)(r => WaferTransferHost.GetProgress(r))

  def write(path: Path, value: JsValue): Unit = {
    require(!Files.exists(path), "evidence must not overwrite: " + path)
    val temp = path.resolveSibling(path.getFileName.toString + ".tmp")
    Files.write(temp, Json.prettyPrint(value).getBytes(StandardCharsets.UTF_8))
    Files.move(temp, path, StandardCopyOption.ATOMIC_MOVE)
  }
  def read(path: Path): JsValue = Json.parse(Files.readAllBytes(path))
  def waitFile(path: Path, max: FiniteDuration): JsValue = {
    val deadline = max.fromNow
    while (!Files.exists(path) && deadline.hasTimeLeft()) Thread.sleep(50)
    require(Files.exists(path), "missing evidence: " + path)
    read(path)
  }
  def awaitUp(kit: ActorTestKit, count: Int): Unit = {
    val deadline = 40.seconds.fromNow
    while (Cluster(kit.system).state.members.count(_.status == MemberStatus.Up) < count &&
        deadline.hasTimeLeft()) Thread.sleep(100)
    require(Cluster(kit.system).state.members.count(_.status == MemberStatus.Up) == count,
      "members are not Up")
  }
  def identity(kit: ActorTestKit, operation: String): JsObject = Json.obj(
    "processPid" -> java.lang.ProcessHandle.current().pid(),
    "node" -> Cluster(kit.system).selfMember.uniqueAddress.toString,
    "hostPid" -> hostPid(operation, "occ-1"))

  def freeze(kit: ActorTestKit, uri: String, operation: String, mode: String, dir: Path): Unit = {
    val host = eventsOf(kit, hostPid(operation, "occ-1"))
    val typed = host.map(_.event)
    assert(typed.count(_.isInstanceOf[WaferTransferHost.OperationStarted]) == 1)
    assert(typed.exists {
      case e: WaferTransferHost.InvocationIntentPersisted => e.stepId == WaferTransferHost.SplitStep
      case _ => false
    })
    assert(!typed.exists(_.isInstanceOf[WaferTransferHost.OperationConcluded]))
    assert(rawEvents(uri, MergeSagaPid).isEmpty)
    if (mode == "first-start") {
      assert(host.map(_.sequenceNr) == Vector(1L, 2L))
      assert(rawEvents(uri, SplitSagaPid).isEmpty && rawEvents(uri,
        childPid(operation, "occ-1")).isEmpty)
    } else {
      assert(mode == "child-completed")
      assert(typed.exists {
        case e: WaferTransferHost.StepCheckpointed => e.stepId == WaferTransferHost.SplitStep
        case _ => false
      })
      assert(typed.exists {
        case e: WaferTransferHost.IdentityObserved => e.stepId == WaferTransferHost.SplitStep
        case _ => false
      })
      assert(typed.exists {
        case e: WaferTransferHost.InvocationIntentPersisted =>
          e.stepId == WaferTransferHost.AwaitStep
        case _ => false
      })
      assert(!typed.exists {
        case e: WaferTransferHost.StepCheckpointed => e.stepId == WaferTransferHost.AwaitStep
        case _ => false
      })
      assert(!typed.exists {
        case e: WaferTransferHost.InvocationIntentPersisted =>
          e.stepId == WaferTransferHost.MergeStep
        case _ => false
      })
      val split = eventsOf(kit, SplitSagaPid).map(_.event)
      assert(split.count(_.isInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started]) == 1)
      assert(split.contains(net.imadz.infra.saga.strict.StrictEvent.Succeeded))
      val child = eventsOf(kit, childPid(operation, "occ-1")).map(_.event)
      assert(child.count(
        _.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunStarted]) == 1)
      assert(child.count(
        _.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1)
      assert(child.count(
        _.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]) == 3)
    }
    write(dir.resolve("frozen.json"), identity(kit, operation) ++ Json.obj("mode" -> mode,
      "sequenceNr" -> host.last.sequenceNr, "hostRaw" -> rawEvents(uri, hostPid(operation, "occ-1")),
      "effectsRaw" -> durableEffects(uri, operation), "mergeStarted" -> 0))
    println("P17_FROZEN mode=" + mode + " hostPid=" + hostPid(operation, "occ-1") +
      " sequenceNr=" + host.last.sequenceNr)
  }
}

/** Emitted test node: production singleton handover, only local observations/gates differ. */
object FixtureCompositionDeploymentNode {
  import CompositionDeploymentFacts._
  def main(args: Array[String]): Unit = {
    require(args.length == 7,
      "usage: node owner|successor port seedAddr mongoUri operation mode evidenceDir")
    val role = args(0); val port = args(1).toInt; val seed = args(2); val uri = args(3)
    val operation = args(4); val mode = args(5); val dir = Paths.get(args(6))
    require((role == "owner" || role == "successor") &&
      Set("first-start", "child-completed").contains(mode))
    require(uri.split("/").last.startsWith("p17_composition_"), "unowned database")
    val name = seed.stripPrefix("akka://").takeWhile(_ != '@')
    val config = ConfigFactory.parseString(s"""
      akka.loglevel = "WARNING"
      akka.actor.provider = cluster
      akka.actor.allow-java-serialization = off
      akka.remote.artery.canonical.hostname = "127.0.0.1"
      akka.remote.artery.canonical.port = $port
      akka.remote.artery.bind.hostname = "127.0.0.1"
      akka.remote.artery.bind.port = $port
      akka.cluster.seed-nodes = ["$seed"]
      akka.persistence.journal.plugin = "akka-contrib-mongodb-persistence-journal"
      akka.persistence.snapshot-store.plugin = "akka-contrib-mongodb-persistence-snapshot"
      akka.contrib.persistence.mongodb.mongo.driver = "akka.contrib.persistence.mongodb.RxMongoPersistenceExtension"
      akka.contrib.persistence.mongodb.mongo.mongouri = "$uri"
    """).withFallback(ConfigFactory.load())
    val kit = ActorTestKit(name, config)
    try {
      implicit val ec: ExecutionContext = kit.system.executionContext
      val sharding = initSharding(kit)
      val split = WaferSplitSagaEntry.spawnClusterSingleton(kit.system, sharding, ReconcileToken)
      val merge = WaferMergeSagaEntry.spawnClusterSingleton(kit.system, sharding, ReconcileToken)
      val childJournal = example.stockreservation.infrastructure.bootstrap.CompositionBootstrap
        .childJournal(kit.system)
      val hooks = WaferTransferHost.TestHooks(
        beforeEffect = (step, _) => {
          if (role == "owner" && mode == "first-start" && step == WaferTransferHost.SplitStep) {
            freeze(kit, uri, operation, mode, dir); false
          } else true
        },
        beforeChildCheckpoint = () => {
          if (role == "owner" && mode == "child-completed") {
            freeze(kit, uri, operation, mode, dir); false
          } else true
        },
        recovered = (seq, state) => {
          if (role == "successor") {
            require(Files.exists(dir.resolve("owner-stopped.json")),
              "successor recovered before old host PostStop")
            val frozen = read(dir.resolve("frozen.json"))
            assert(seq == (frozen \ "sequenceNr").as[Long])
            assert(rawEvents(uri, hostPid(operation, "occ-1")) ==
              (frozen \ "hostRaw").as[Vector[String]])
            assert(state.started.isDefined && !state.terminal)
          } else assert(seq == 0L && state.started.isEmpty)
          write(dir.resolve(role + "-recovered.json"), identity(kit, operation) ++ Json.obj(
            "sequenceNr" -> seq, "started" -> state.started.isDefined,
            "terminal" -> state.terminal))
          println("P17_OWNER_RECOVERED role=" + role + " pid=" + hostPid(operation, "occ-1") +
            " sequenceNr=" + seq)
        },
        stopped = () => {
          write(dir.resolve(role + "-stopped.json"), identity(kit, operation))
          println("P17_OWNER_STOPPED role=" + role + " pid=" + hostPid(operation, "occ-1"))
        })
      val host = WaferTransferHost.spawnClusterSingletonForTest(kit.system, sharding, split,
        merge, childJournal, operation, "occ-1", hooks)
      if (role == "owner") {
        waitFile(dir.resolve("owner-recovered.json"), 40.seconds)
        waitFile(dir.resolve("frozen.json"), 90.seconds)
        assert(!begin(kit, host, operation).accepted)
        write(dir.resolve("owner-duplicate.json"), Json.obj("accepted" -> false))
        Await.result(kit.system.whenTerminated, Duration.Inf)
      } else {
        awaitUp(kit, 2)
        val owner = waitFile(dir.resolve("owner-recovered.json"), 40.seconds)
        assert((owner \ "processPid").as[Long] != java.lang.ProcessHandle.current().pid())
        assert(!Files.exists(dir.resolve("successor-recovered.json")),
          "a second writer started before handover")
        val serializer = akka.serialization.SerializationExtension(kit.system.classicSystem)
        val probe = kit.createTestProbe[WaferTransferHost.ProgressReport]().ref
        val messages = Vector[AnyRef](
          WaferTransferHost.GetProgress(probe), WaferTransferHost.OperationReply(false, "occupied"),
          WaferTransferHost.ProgressReport(true, Vector("split" -> "Succeeded"), None, Some("child")),
          WaferTransferHost.BeginOperation(operation, "occ-1", From, To, SplitWafers, ManifestSeed,
            kit.createTestProbe[WaferTransferHost.OperationReply]().ref))
        messages.foreach { message =>
          val selected = serializer.findSerializerFor(message)
          assert(!selected.isInstanceOf[akka.serialization.JavaSerializer])
          val manifest = akka.serialization.Serializers.manifestFor(selected, message)
          assert(serializer.deserialize(serializer.serialize(message).get, selected.identifier,
            manifest).get == message)
        }
        assert(!progress(kit, host).started) // remote request/reply, not the local proxy address
        val mismatch = askNow(kit, host)(r => WaferTransferHost.BeginOperation(operation + "-other",
          "occ-1", From, To, SplitWafers, ManifestSeed, r))
        assert(!mismatch.accepted && rawEvents(uri, hostPid(operation, "occ-1")).isEmpty)
        seedFunds(kit, sharding, From, "p17-seed-from", SeedWafers)
        seedFunds(kit, sharding, To, "p17-seed-to", ChildBaseWafers)
        assert(begin(kit, host, operation).accepted)
        assert(!begin(kit, host, operation).accepted)
        waitFile(dir.resolve("frozen.json"), 60.seconds)
        waitFile(dir.resolve("owner-duplicate.json"), 20.seconds)
        write(dir.resolve("ready-to-terminate.json"), Json.obj("remoteSerialization" -> true,
          "duplicateBegin" -> true, "membersUp" -> 2,
          "ownerPid" -> (owner \ "processPid").as[Long]))
        waitFile(dir.resolve("successor-recovered.json"), 90.seconds)
        val reconcileSink = kit.createTestProbe[StrictSagaCoordinator.Reply]().ref
        val deadline = 90.seconds.fromNow
        var report = progress(kit, host)
        while (report.concluded.isEmpty && deadline.hasTimeLeft()) {
          Vector(split, merge).foreach { coordinator =>
            try askNow(kit, coordinator)(r => StrictSagaCoordinator.GetStatus(r)) match {
              case StrictSagaCoordinator.Status(s) if !s.terminal && s.identity.isDefined =>
                coordinator ! StrictSagaCoordinator.Reconcile(s.identity.get, ReconcileToken, 32,
                  reconcileSink)
              case _ => ()
            } catch { case _: java.util.concurrent.TimeoutException => () }
          }
          Thread.sleep(150)
          report = progress(kit, host)
        }
        assert(report.concluded.contains("AllStepsSucceeded"))
        assertHostTrace(kit, operation)
        assertExactlyOnce(kit, uri, operation)
        val frozen = read(dir.resolve("frozen.json"))
        val frozenRaw = (frozen \ "hostRaw").as[Vector[String]]
        assert(rawEvents(uri, hostPid(operation, "occ-1")).take(frozenRaw.size) == frozenRaw)
        if (mode == "child-completed") {
          val before = (frozen \ "effectsRaw").as[Map[String, Vector[String]]]
          Vector(SplitSagaPid, childPid(operation, "occ-1")).foreach { pid =>
            assert(before(pid).nonEmpty && rawEvents(uri, pid) == before(pid),
              "migration repeated completed split/child effects")
          }
        }
        write(dir.resolve("result.json"), identity(kit, operation) ++ Json.obj(
          "concluded" -> report.concluded, "hostRaw" -> rawEvents(uri, hostPid(operation, "occ-1")),
          "effectsRaw" -> durableEffects(uri, operation), "sagaStarted" -> Vector(1, 1),
          "childStarted" -> 1, "childStages" -> 3, "businessEffects" -> Vector(4, 4)))
        println("P17_RESULT mode=" + mode + " hostPid=" + hostPid(operation, "occ-1") +
          " concluded=AllStepsSucceeded")
        kit.shutdownTestKit()
      }
    } catch {
      case t: Throwable => t.printStackTrace(); kit.shutdownTestKit(); sys.exit(1)
    }
  }
}

final class FixtureCompositionDeploymentSpec extends org.scalatest.funsuite.AnyFunSuite {
  import CompositionDeploymentFacts._
  private def freePort(): Int = {
    val socket = new java.net.ServerSocket(0)
    try socket.getLocalPort finally socket.close()
  }
  private def stop(process: java.lang.Process): Unit = {
    if (process.isAlive) process.destroy()
    if (!process.waitFor(30, java.util.concurrent.TimeUnit.SECONDS)) {
      process.destroyForcibly(); process.waitFor()
      fail("test node needed forced cleanup; SIGTERM certification failed")
    }
  }
  for (mode <- Vector("first-start", "child-completed")) {
    test("E-D physical composition-host SIGTERM migration: " + mode) {
      val hostPort = sys.env.getOrElse("SAGA_MONGO_HOSTPORT", "127.0.0.1:27017")
      val parts = hostPort.split(":")
      val socket = new java.net.Socket()
      try socket.connect(new java.net.InetSocketAddress(parts(0), parts(1).toInt), 2000)
      finally socket.close()
      val classpath = System.getProperty("java.class.path")
      assert(classpath.split(java.io.File.pathSeparator).exists(p =>
        p.contains("target") && p.contains("scala-2.13")), "Test/fork required")
      val run = System.nanoTime().toString
      val dir = Paths.get("target", "composition-deployment", mode + "-" + run).toAbsolutePath
      Files.createDirectories(dir)
      val operation = "op-p17-" + mode
      val uri = "mongodb://" + hostPort + "/p17_composition_" + run
      val portA = freePort(); var portB = freePort()
      while (portB == portA || Set(9000, 2551).contains(portB)) portB = freePort()
      assert(!Set(9000, 2551).contains(portA))
      val seed = "akka://CompositionP17" + run + "@127.0.0.1:" + portA
      val javaBin = Paths.get(System.getProperty("java.home"), "bin", "java").toString
      def node(role: String, port: Int): java.lang.Process = new java.lang.ProcessBuilder(
        (Vector(javaBin, "-cp", classpath,
          "example.stockreservation.application.services.transactor.FixtureCompositionDeploymentNode",
          role, port.toString, seed, uri, operation, mode, dir.toString)): _*)
        .redirectOutput(dir.resolve(role + ".log").toFile).redirectErrorStream(true).start()
      val owner = node("owner", portA)
      var successor: java.lang.Process = null
      try {
        val original = waitFile(dir.resolve("owner-recovered.json"), 50.seconds)
        assert((original \ "sequenceNr").as[Long] == 0L &&
          (original \ "processPid").as[Long] == owner.pid())
        successor = node("successor", portB)
        waitFile(dir.resolve("ready-to-terminate.json"), 100.seconds)
        val frozen = read(dir.resolve("frozen.json"))
        assert((frozen \ "processPid").as[Long] == owner.pid())
        assert(!Files.exists(dir.resolve("successor-recovered.json")))
        val prefix = (frozen \ "hostRaw").as[Vector[String]]
        assert(rawEvents(uri, hostPid(operation, "occ-1")) == prefix)
        write(dir.resolve("signal.json"), Json.obj("signal" -> "SIGTERM",
          "ownerPid" -> owner.pid(), "successorPid" -> successor.pid(), "portA" -> portA,
          "portB" -> portB, "mongoUri" -> uri))
        owner.destroy() // SIGTERM on the owned JVM, CoordinatedShutdown does the handover
        assert(owner.waitFor(45, java.util.concurrent.TimeUnit.SECONDS),
          "owner did not exit after SIGTERM")
        assert(owner.exitValue() == 0 || owner.exitValue() == 143,
          "unexpected owner exit: " + owner.exitValue())
        assert(Files.exists(dir.resolve("owner-stopped.json")))
        assert(successor.waitFor(180, java.util.concurrent.TimeUnit.SECONDS),
          "successor did not complete")
        assert(successor.exitValue() == 0, "successor failed; see " + dir)
        val resumed = read(dir.resolve("successor-recovered.json"))
        assert((resumed \ "processPid").as[Long] == successor.pid())
        assert((resumed \ "node").as[String] != (original \ "node").as[String])
        assert((resumed \ "hostPid").as[String] == (original \ "hostPid").as[String])
        assert((resumed \ "sequenceNr").as[Long] == (frozen \ "sequenceNr").as[Long])
        val result = read(dir.resolve("result.json"))
        assert((result \ "concluded").as[String] == "AllStepsSucceeded")
        assert((result \ "sagaStarted").as[Vector[Int]] == Vector(1, 1))
        assert((result \ "businessEffects").as[Vector[Int]] == Vector(4, 4))
        write(dir.resolve("process-result.json"), Json.obj("ownerExit" -> owner.exitValue(),
          "successorExit" -> successor.exitValue(), "waitedAndReaped" -> true,
          "forcedCleanup" -> false))
        println("P17_ACCEPTED mode=" + mode + " evidence=" + dir +
          " sequenceNr=" + (resumed \ "sequenceNr").as[Long])
      } finally {
        try if (successor != null) stop(successor) finally stop(owner)
      }
    }
  }
}
