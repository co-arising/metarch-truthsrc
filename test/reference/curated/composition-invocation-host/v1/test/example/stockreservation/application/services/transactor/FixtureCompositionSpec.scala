package example.stockreservation.application.services.transactor

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.{ActorRef, ActorSystem}
import akka.actor.typed.scaladsl.AskPattern._
import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import akka.util.Timeout
import com.typesafe.config.ConfigFactory
import example.stockreservation.application.aggregates.LotProtocol
import example.stockreservation.domain.entities.LotEntity
import net.imadz.infra.saga.strict.{StrictSagaCoordinator, StrictStatus}
import org.mongodb.scala.MongoClient
import org.mongodb.scala.bson.collection.immutable.Document
import scala.concurrent.{Await, ExecutionContext}
import scala.concurrent.duration._

/** 组合验收套件（R 模板全量落地，编译面）：split → await-child → merge plan 经
  * 生成的组合宿主驱动，共享持久 journal（生产 = RxMongo；本门环境无 mongod 实证，
  * 套件编译面覆盖、运行需可达 Mongo——F8 裁定）。崩溃窗由 Mongo 前缀截断构造，
  * 截断前写者已停止、截断后跨原子批的存活前缀逐字节验证。测试专有 effect 栏栅
  * 证明 intent-before-send；raw 事件字节与 typed journal 事实证明身份与持久化
  * 效果计数。F9 裁定：R 的 snapshot 解码断言（0.2.1/0.3.0 均无 API 对应）重定
  * 目标为 stage 游标序列；业务 oracle 用本族事件名。 */
final class FixtureCompositionSpec extends org.scalatest.wordspec.AnyWordSpec
  with org.scalatest.matchers.should.Matchers {

  private val MongoHostPort = sys.env.getOrElse("SAGA_MONGO_HOSTPORT", "127.0.0.1:27017")
  private def mongoUri(db: String): String = s"mongodb://$MongoHostPort/$db"

  private def mongoReachable(): Boolean = try {
    val parts = MongoHostPort.split(":")
    val socket = new java.net.Socket()
    try socket.connect(new java.net.InetSocketAddress(parts(0), parts(1).toInt), 2000)
    finally socket.close()
    true
  } catch { case _: Throwable => false }

  private val ReconcileToken = "composition-reconcile-token"
  private val SeedWafers = Vector("w-001", "w-002", "w-003", "w-004")
  private val SplitWafers = Vector("w-001", "w-002")
  private val ChildBaseWafers = Vector("w-101")
  private val ManifestSeed = "manifest-seed-v1"
  private val From = "parent-lot"
  private val To = "child-lot"

  private def freePort(): Int = {
    val socket = new java.net.ServerSocket(0)
    try socket.getLocalPort finally socket.close()
  }

  private def compositionConfig(name: String, port: Int, uri: String): com.typesafe.config.Config = {
    val seed = "akka://" + name + "@127.0.0.1:" + port
    ConfigFactory.parseString(
    s"""
      akka.loglevel = "WARNING"
      akka.actor.provider = cluster
      akka.remote.artery.canonical.hostname = "127.0.0.1"
      akka.remote.artery.canonical.port = $port
      akka.remote.artery.bind.hostname = "127.0.0.1"
      akka.remote.artery.bind.port = $port
      akka.cluster.seed-nodes = ["$seed"]
      akka.cluster.jmx.multi-mbeans-in-same-jvm = on
      akka.persistence.journal.plugin = "akka-contrib-mongodb-persistence-journal"
      akka.persistence.snapshot-store.plugin = "akka-contrib-mongodb-persistence-snapshot"
      akka.contrib.persistence.mongodb.mongo.driver = "akka.contrib.persistence.mongodb.RxMongoPersistenceExtension"
      akka.contrib.persistence.mongodb.mongo.mongouri = "$uri"
    """).withFallback(ConfigFactory.load())
  }

  private def aggregateBehavior(entityId: String): akka.actor.typed.Behavior[LotProtocol.LotCommand] =
    akka.persistence.typed.scaladsl.EventSourcedBehavior(
      persistenceId = akka.persistence.typed.PersistenceId(LotProtocol.entityKey.name, entityId),
      emptyState = LotEntity.empty(entityId),
      commandHandler = LotProtocol.commandHandler,
      eventHandler = LotEntity.applyEvent)

  private def initSharding(kit: ActorTestKit): ClusterSharding = {
    val sharding = ClusterSharding(kit.system)
    sharding.init(
      akka.cluster.sharding.typed.scaladsl.Entity(LotProtocol.entityKey)(ctx =>
        aggregateBehavior(ctx.entityId)))
    sharding
  }

  private def waitClusterUp(kit: ActorTestKit): Unit = {
    val c = akka.cluster.typed.Cluster(kit.system)
    val deadline = 20.seconds.fromNow
    while (c.state.members.size < 1 && deadline.hasTimeLeft()) Thread.sleep(100)
    require(c.state.members.nonEmpty, "cluster membership never came up")
  }

  private def entityRef(sharding: ClusterSharding, entityId: String): EntityRef[LotProtocol.LotCommand] =
    sharding.entityRefFor(LotProtocol.entityKey, entityId)

  private implicit val timeout: Timeout = Timeout(10.seconds)

  private def askNow[Cmd, Res](kit: ActorTestKit, ref: akka.actor.typed.RecipientRef[Cmd])(
      f: ActorRef[Res] => Cmd): Res = {
    implicit val system: ActorSystem[_] = kit.system
    implicit val timeout: Timeout = Timeout(15.seconds)
    Await.result(ref.ask(f), 15.seconds)
  }

  private def carriedOf(kit: ActorTestKit,
      ref: akka.actor.typed.RecipientRef[LotProtocol.LotCommand]): Set[String] =
    askNow(kit, ref)(replyTo => LotProtocol.GetLotState(replyTo)).carried.keySet.toSet

  /** Command-face funding on the shared journal (deployment-honest seeding). */
  private def seedFunds(kit: ActorTestKit, sharding: ClusterSharding, entityId: String,
      txid: String, wafers: Vector[String] = SeedWafers): Unit = {
    val ref = entityRef(sharding, entityId)
    val r1 = askNow(kit, ref)(replyTo =>
      LotProtocol.ReserveWaferAddition(txid, entityId, wafers.toList, replyTo))
    val r2 = askNow(kit, ref)(replyTo => LotProtocol.CommitWaferAddition(txid, entityId, replyTo))
    assert(r1.error.isEmpty && r2.error.isEmpty, s"seeding failed for $entityId")
  }

  private def spawnHost(kit: ActorTestKit, sharding: ClusterSharding, operation: String,
      occurrence: String,
      audit: Option[(String, String) => Boolean] = None): ActorRef[WaferTransferHost.Command] = {
    implicit val ec: ExecutionContext = kit.system.executionContext
    val splitCoordinator = WaferSplitSagaEntry.spawnClusterSingleton(kit.system, sharding,
      ReconcileToken)
    val mergeCoordinator = WaferMergeSagaEntry.spawnClusterSingleton(kit.system, sharding,
      ReconcileToken)
    val childJournal = example.stockreservation.infrastructure.bootstrap.CompositionBootstrap
      .childJournal(kit.system)
    val behavior = audit match {
      case Some(check) => WaferTransferHost.behaviorForTest(kit.system, sharding,
        splitCoordinator, mergeCoordinator, childJournal, operation, occurrence, check)
      case None => WaferTransferHost.behavior(kit.system, sharding, splitCoordinator,
        mergeCoordinator, childJournal, operation, occurrence)
    }
    kit.spawn(behavior, s"composition-$operation-$occurrence")
  }

  private def begin(kit: ActorTestKit, hostRef: ActorRef[WaferTransferHost.Command],
      operation: String, occurrence: String, wafers: Vector[String]): WaferTransferHost.OperationReply = {
    implicit val system: ActorSystem[_] = kit.system
    implicit val ec: ExecutionContext = kit.system.executionContext
    Await.result(hostRef.ask(replyTo =>
      WaferTransferHost.BeginOperation(operation, occurrence, From, To, wafers, ManifestSeed,
        replyTo)), 15.seconds)
  }

  private def progressOf(kit: ActorTestKit,
      hostRef: ActorRef[WaferTransferHost.Command]): WaferTransferHost.ProgressReport = {
    implicit val system: ActorSystem[_] = kit.system
    implicit val ec: ExecutionContext = kit.system.executionContext
    Await.result(hostRef.ask(replyTo => WaferTransferHost.GetProgress(replyTo)), 15.seconds)
  }

  private def awaitConcluded(kit: ActorTestKit, hostRef: ActorRef[WaferTransferHost.Command],
      maxSeconds: Int = 60): WaferTransferHost.ProgressReport = {
    val deadline = maxSeconds.seconds.fromNow
    var report = progressOf(kit, hostRef)
    while (report.concluded.isEmpty && deadline.hasTimeLeft()) {
      Thread.sleep(150); report = progressOf(kit, hostRef)
    }
    assert(report.concluded.isDefined, s"operation never concluded: $report")
    report
  }

  // ── 内嵌 recovery 事实面（R 模板成员，方法体原样，private 去除以装配）──

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

  private def rawEvents(uri: String, pid: String): Vector[String] = {
    val client = MongoClient(uri)
    try batches(client, uri, pid).flatMap(_.events.map(_.toJson)) finally client.close()
  }
  private def countJournal(uri: String, pid: String): Long = rawEvents(uri, pid).size.toLong

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

  private def stoppedWriter(kit: ActorTestKit, uri: String): Unit = {
    kit.shutdownTestKit()
    require(kit.system.whenTerminated.isCompleted, "writer must terminate before journal surgery")
    require(OwnedUris.contains(uri) && dbNameOf(uri).startsWith("p16_composition_"),
      "database is not owned by this run")
  }

  private def assertPrefix(uri: String, pid: String, keep: Int,
      expected: Vector[String]): Unit = {
    val actual = rawEvents(uri, pid)
    assert(actual == expected.take(keep) && actual.size == keep,
      "injection did not retain the exact prefix")
    println("P16_PREFIX " + dbNameOf(uri) + " pid=" + pid + " keep=" + keep +
      " sequence=" + (1 to keep).mkString(",") + " events=" + actual.mkString("[", ",", "]"))
  }

  /** RxMongo stores one document per atomic batch, not one per persistenceId.
    * Trim a crossing batch and remove every later batch, preserving event bytes. */
  private def truncateJournal(stopped: ActorTestKit, uri: String, pid: String, keep: Int): Unit = {
    require(stopped.system.whenTerminated.isCompleted, "live writer cannot be truncated")
    require(OwnedUris.contains(uri) && dbNameOf(uri).startsWith("p16_composition_"),
      "unowned journal")
    val client = MongoClient(uri)
    try {
      val before = batches(client, uri, pid)
      val expected = before.flatMap(_.events.map(_.toJson))
      require(keep > 0 && keep < expected.size, "cut must remove a nonempty journal tail")
      val db = client.getDatabase(dbNameOf(uri))
      val collections = Await.result(db.listCollectionNames().toFuture(), 10.seconds)
      collections.filter(_.contains("snap")).foreach { c =>
        require(Await.result(
          db.getCollection(c).find(Document("pid" -> pid)).toFuture(), 10.seconds).isEmpty,
          "snapshot would mask the requested prefix")
      }
      before.foreach { batch =>
        val raw = batch.document.toBsonDocument
        val filter = Document("_id" -> raw.get("_id"), "pid" -> pid,
          "from" -> batch.from, "to" -> batch.to)
        val collection = db.getCollection(batch.collection)
        if (batch.from > keep) {
          val result = Await.result(collection.deleteOne(filter).toFuture(), 10.seconds)
          require(result.getDeletedCount == 1L,
            "tail batch delete did not match exactly one document")
        } else if (batch.to > keep) {
          val survivors = batch.events.takeWhile(number(_, "sn") <= keep)
          val change = Document("$set" -> Document(
            "events" -> org.mongodb.scala.bson.BsonArray(survivors), "to" -> keep.toLong))
          val result = Await.result(collection.updateOne(filter, change).toFuture(), 10.seconds)
          require(result.getMatchedCount == 1L && result.getModifiedCount == 1L,
            "crossing batch update failed")
        }
      }
      assertPrefix(uri, pid, keep, expected)
    } finally client.close()
  }

  private def hostPid(operation: String, occurrence: String): String =
    WaferTransferHost.persistenceIdFor(operation, occurrence).id
  private def childPid(operation: String, occurrence: String): String =
    WaferTransferHost.childPersistenceId(operation, occurrence)
  private val SplitSagaPid = WaferSplitSagaEntry.persistenceId.id
  private val MergeSagaPid = WaferMergeSagaEntry.persistenceId.id
  private def lotPid(entityId: String): String =
    akka.persistence.typed.PersistenceId(LotProtocol.entityKey.name, entityId).id

  private def durableEffects(uri: String, operation: String): Map[String, Vector[String]] =
    Vector(SplitSagaPid, MergeSagaPid, childPid(operation, "occ-1"), lotPid(From), lotPid(To))
      .map(pid => pid -> rawEvents(uri, pid)).toMap

  private def assertExactlyOnce(kit: ActorTestKit, uri: String, operation: String): Unit = {
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
      assert(events.nonEmpty, "real saga journal must not be empty")
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
    val checkpoints = child.collect {
      case e: net.imadz.monarch.persistence.PersistentMonarch.StageDone => e
    }
    assert(checkpoints.map(_.cursor) == Vector("receive#0", "process#1", "finalize#2"),
      "the monarch run walks exactly the three bounded stages (F9: snapshot decode " +
        "dropped — 0.2.1/0.3.0 carry no snapshot on StageDone)")
    val business = Vector(From, To).flatMap(id => eventsOf(kit, lotPid(id)).map(_.event))
      .collect { case p: Product => p }
    Vector(WaferTransferHost.SplitStep, WaferTransferHost.MergeStep).foreach { step =>
      val txid = WaferTransferHost.txidFor(operation, "occ-1", step)
      val effects = business.filter(p => p.productArity > 0 && p.productElement(0) == txid)
      assert(effects.map(_.productPrefix).sorted ==
        Vector("WaferAdditionCommitted", "WaferAdditionReserved", "WaferRemovalCommitted",
          "WaferRemovalReserved").sorted, "exactly four persisted TCC effects per saga")
    }
    assert(carriedOf(kit, entityRef(shardingOf(kit), From)) == SeedWafers.toSet)
    assert(carriedOf(kit, entityRef(shardingOf(kit), To)) == ChildBaseWafers.toSet)
    println("P16_EFFECTS " + dbNameOf(uri) + " sagaPids=" + sagaPids.toVector.sorted.mkString(",") +
      " started=1,1 childStarted=1 childStages=3 businessEffects=4,4")
  }

  private def shardingOf(kit: ActorTestKit): ClusterSharding = ClusterSharding(kit.system)

  private def assertHostTrace(kit: ActorTestKit, operation: String): Unit = {
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
      val expectedKey = if (step == WaferTransferHost.AwaitStep)
        WaferTransferHost.childRunKey(operation, "occ-1")
      else WaferTransferHost.txidFor(operation, "occ-1", step)
      assert(intents.head._1.key == expectedKey)
      if (step != WaferTransferHost.AwaitStep) {
        val identities = events.zipWithIndex.collect {
          case (e: WaferTransferHost.IdentityObserved, i) if e.stepId == step => e -> i
        }
        assert(identities.size == 1 && identities.head._1.transactionId == expectedKey)
        assert(intents.head._2 < identities.head._2 && identities.head._2 < checkpoints.head._2)
      }
    }
    val completedChild = events.collect {
      case e: WaferTransferHost.StepCheckpointed if e.stepId == WaferTransferHost.AwaitStep => e
    }.head
    assert(completedChild.outputs("wafers").split(",").toVector == SplitWafers)
    assert(completedChild.outputs("childRun") == WaferTransferHost.childRunKey(operation, "occ-1"))
    val childIndex = events.indexOf(completedChild)
    val mergeIntent = events.indexWhere {
      case e: WaferTransferHost.InvocationIntentPersisted => e.stepId == WaferTransferHost.MergeStep
      case _ => false
    }
    assert(childIndex < mergeIntent, "merge intent follows the authoritative child checkpoint")
    assert(events.count(_.isInstanceOf[WaferTransferHost.OperationConcluded]) == 1)
  }

  private def effectAudit(kit: ActorTestKit, operation: String,
      blocked: Option[String] = None,
      hit: Option[ActorRef[(String, String)]] = None): (String, String) => Boolean = { (step, key) =>
    val events = eventsOf(kit, hostPid(operation, "occ-1")).map(_.event)
    assert(events.exists {
      case e: WaferTransferHost.InvocationIntentPersisted => e.stepId == step && e.key == key
      case _ => false
    }, "intent must be durably query-visible before Start/StartRun")
    hit.foreach(_ ! (step -> key))
    println("P16_INTENT_BEFORE_EFFECT " + operation + " step=" + step + " key=" + key +
      " send=" + !blocked.contains(step))
    !blocked.contains(step)
  }

  private def recover(name: String, uri: String, operation: String)
      (body: (ActorTestKit, ClusterSharding, ActorRef[WaferTransferHost.Command]) => Unit): Unit = {
    val kit = ActorTestKit(name, compositionConfig(name, freePort(), uri))
    try {
      val sharding = initSharding(kit)
      waitClusterUp(kit)
      val host = spawnHost(kit, sharding, operation, "occ-1", Some(effectAudit(kit, operation)))
      body(kit, sharding, host)
    } finally kit.shutdownTestKit()
  }

  private def withCluster[T](name: String)(body: (ActorTestKit, ClusterSharding, String) => T): T = {
    assume(mongoReachable(),
      "MongoDB unavailable — recovery certification must not count canceled tests as passing")
    val uri = mongoUri("p16_composition_" + System.nanoTime())
    OwnedUris += uri
    val kit = ActorTestKit(name, compositionConfig(name, freePort(), uri))
    try {
      val sharding = initSharding(kit)
      waitClusterUp(kit)
      body(kit, sharding, uri)
    } finally if (!kit.system.whenTerminated.isCompleted) kit.shutdownTestKit()
  }

  "E0 journal injection: crossing batch, tail removal and fail-closed guards" in
    withCluster("CompositionE0") { (kit, _, uri) =>
      val pid = "p16-prefix-probe"
      intercept[IllegalArgumentException] { truncateJournal(kit, uri, pid, 4) }
      stoppedWriter(kit, uri)
      val client = MongoClient(uri)
      try {
        val collection = client.getDatabase(dbNameOf(uri)).getCollection("p16_probe_journal")
        def batch(id: String, from: Long, to: Long): Document =
          Document("pid" -> id, "from" -> from, "to" -> to,
            "events" -> org.mongodb.scala.bson.BsonArray((from to to).map(sn =>
              Document("pid" -> id, "sn" -> sn).toBsonDocument)))
        Await.result(collection.insertMany(Vector(batch(pid, 1L, 2L), batch(pid, 3L, 5L),
          batch(pid, 6L, 7L), batch("p16-protected-pid", 1L, 2L))).toFuture(), 10.seconds)
        val before = rawEvents(uri, pid)
        val protectedBefore = rawEvents(uri, "p16-protected-pid")
        intercept[IllegalArgumentException] { truncateJournal(kit, "mongodb://127.0.0.1:27017/unowned", pid, 4) }
        intercept[IllegalArgumentException] { truncateJournal(kit, uri, pid, 0) }
        intercept[IllegalArgumentException] { truncateJournal(kit, uri, pid, 7) }
        intercept[IllegalArgumentException] { truncateJournal(kit, uri, "missing", 4) }
        assert(rawEvents(uri, pid) == before, "rejected surgery must not write")
        truncateJournal(kit, uri, pid, 4)
        assert(rawEvents(uri, pid) == before.take(4))
        assert(rawEvents(uri, "p16-protected-pid") == protectedBefore,
          "other pids must remain unchanged")
        val survivors = batches(client, uri, pid)
        assert(survivors.map(b => b.from -> b.to) == Vector(1L -> 2L, 3L -> 4L))
        val malformed = Document("pid" -> "p16-malformed-pid", "from" -> 1L, "to" -> 2L,
          "events" -> org.mongodb.scala.bson.BsonArray(Vector(
            Document("pid" -> "p16-malformed-pid", "sn" -> 2L).toBsonDocument)))
        Await.result(collection.insertOne(malformed).toFuture(), 10.seconds)
        intercept[IllegalArgumentException] { truncateJournal(kit, uri, "p16-malformed-pid", 1) }
      } finally client.close()
    }

  "E1 composition full chain: every intent precedes its effect" in
    withCluster("CompositionE1") { (kit, sharding, uri) =>
      seedFunds(kit, sharding, From, "seed-e1-from")
      seedFunds(kit, sharding, To, "seed-e1-to", ChildBaseWafers)
      val host = spawnHost(kit, sharding, "op-e1", "occ-1", Some(effectAudit(kit, "op-e1")))
      assert(begin(kit, host, "op-e1", "occ-1", SplitWafers).accepted)
      assert(awaitConcluded(kit, host).concluded.contains("AllStepsSucceeded"))
      assertHostTrace(kit, "op-e1")
      assertExactlyOnce(kit, uri, "op-e1")
    }

  private def completedWindow(name: String, operation: String, cut: Any => Boolean,
      expectedKeep: Option[Int]): Unit =
    withCluster(name) { (kit, sharding, uri) =>
      seedFunds(kit, sharding, From, "seed-" + operation + "-from")
      seedFunds(kit, sharding, To, "seed-" + operation + "-to", ChildBaseWafers)
      val host = spawnHost(kit, sharding, operation, "occ-1", Some(effectAudit(kit, operation)))
      begin(kit, host, operation, "occ-1", SplitWafers)
      assert(awaitConcluded(kit, host).concluded.contains("AllStepsSucceeded"))
      assertExactlyOnce(kit, uri, operation)
      val before = durableEffects(uri, operation)
      require(before.values.forall(_.nonEmpty), "zero-event baselines cannot prove recovery")
      val trace = eventsOf(kit, hostPid(operation, "occ-1"))
      val boundaries = trace.filter(e => cut(e.event))
      assert(boundaries.size == 1, "crash boundary must identify exactly one event")
      val keep = boundaries.head.sequenceNr.toInt
      expectedKeep.foreach(n => assert(keep == n, "unexpected crash prefix"))
      stoppedWriter(kit, uri)
      truncateJournal(kit, uri, hostPid(operation, "occ-1"), keep)
      recover(name, uri, operation) { (kit2, _, host2) =>
        assert(awaitConcluded(kit2, host2).concluded.contains("AllStepsSucceeded"))
        assert(durableEffects(uri, operation) == before,
          "all saga/child/business journal bytes must be unchanged")
        assertHostTrace(kit2, operation)
        assertExactlyOnce(kit2, uri, operation)
      }
    }

  "E2 saga terminal stored, checkpoint missing: reattach with zero new events" in {
    completedWindow("CompositionE2", "op-e2", {
      case e: WaferTransferHost.IdentityObserved => e.stepId == WaferTransferHost.SplitStep
      case _ => false
    }, Some(3))
  }

  "E3 await intent stored, all mirrors and child checkpoint missing: authoritative reconciliation" in {
    completedWindow("CompositionE3", "op-e3", {
      case e: WaferTransferHost.InvocationIntentPersisted => e.stepId == WaferTransferHost.AwaitStep
      case _ => false
    }, Some(5))
  }

  "E4 intent stored, identity lost after completed Start: same identity reissue" in {
    completedWindow("CompositionE4", "op-e4", {
      case e: WaferTransferHost.InvocationIntentPersisted => e.stepId == WaferTransferHost.SplitStep
      case _ => false
    }, Some(2))
  }

  "E4b intent stored, first Start not sent: deterministic barrier" in
    withCluster("CompositionE4b") { (kit, sharding, uri) =>
      seedFunds(kit, sharding, From, "seed-e4b-from")
      seedFunds(kit, sharding, To, "seed-e4b-to", ChildBaseWafers)
      val hit = kit.createTestProbe[(String, String)]()
      val host = spawnHost(kit, sharding, "op-e4b", "occ-1",
        Some(effectAudit(kit, "op-e4b", Some(WaferTransferHost.SplitStep), Some(hit.ref))))
      assert(begin(kit, host, "op-e4b", "occ-1", SplitWafers).accepted)
      assert(hit.receiveMessage(15.seconds) ==
        (WaferTransferHost.SplitStep ->
          WaferTransferHost.txidFor("op-e4b", "occ-1", WaferTransferHost.SplitStep)))
      assert(countJournal(uri, SplitSagaPid) == 0 && countJournal(uri, MergeSagaPid) == 0)
      assert(countJournal(uri, childPid("op-e4b", "occ-1")) == 0)
      val prefix = rawEvents(uri, hostPid("op-e4b", "occ-1"))
      stoppedWriter(kit, uri)
      assertPrefix(uri, hostPid("op-e4b", "occ-1"), 2, prefix)
      println("P16_FIRST_START_NOT_SENT " + dbNameOf(uri) + " sagaStarted=0 childStarted=0")
      recover("CompositionE4b", uri, "op-e4b") { (kit2, _, host2) =>
        assert(awaitConcluded(kit2, host2).concluded.contains("AllStepsSucceeded"))
        assertHostTrace(kit2, "op-e4b")
        assertExactlyOnce(kit2, uri, "op-e4b")
      }
    }

  for ((label, cut) <- Vector[(String, Any => Boolean)](
    "child-checkpoint" -> {
      case e: WaferTransferHost.StepCheckpointed => e.stepId == WaferTransferHost.AwaitStep
      case _ => false
    },
    "merge-intent" -> {
      case e: WaferTransferHost.InvocationIntentPersisted => e.stepId == WaferTransferHost.MergeStep
      case _ => false
    },
    "merge-identity" -> {
      case e: WaferTransferHost.IdentityObserved => e.stepId == WaferTransferHost.MergeStep
      case _ => false
    })) {
    ("E6 confirmed-prefix boundary " + label + ": no second effects") in {
      completedWindow("CompositionE6" + label.replace("-", ""), "op-e6-" + label, cut, None)
    }
  }

  "E5 same txid with different args: fail closed on the occupied terminal" in
    withCluster("CompositionE5") { (kit, sharding, _) =>
      seedFunds(kit, sharding, From, "seed-e5-from")
      seedFunds(kit, sharding, To, "seed-e5-to", ChildBaseWafers)
      // Pre-occupy the derived split txid with DIFFERENT args (a direct command
      // trigger through the split coordinator — deployment-honest conflict seed).
      implicit val system: ActorSystem[_] = kit.system
      implicit val ec: ExecutionContext = kit.system.executionContext
      val splitCoordinator = WaferSplitSagaEntry.spawnClusterSingleton(kit.system, sharding,
        ReconcileToken)
      val splitHost = new SplitFixtureHost(kit.system, sharding)
      val txid = WaferTransferHost.txidFor("op-e5", "occ-1", WaferTransferHost.SplitStep)
      val occupier = LotProtocol.StartTransfer(txid, From, To,
        Vector("w-901", "w-902").toList, ManifestSeed, kit.createTestProbe[LotProtocol.LotReply]().ref)
      splitCoordinator ! WaferSplitSagaModule.waferTransferRequestedTriggerStart(occupier,
        splitHost, kit.createTestProbe[StrictSagaCoordinator.Reply]().ref)
      // Let the occupier saga reach a terminal state on the journal first.
      val probe = kit.createTestProbe[Any]()
      probe.awaitAssert({
        implicit val timeout: Timeout = Timeout(10.seconds)
        val status = Await.result(
          splitCoordinator.ask((r: ActorRef[StrictSagaCoordinator.Reply]) =>
            StrictSagaCoordinator.GetStatus(r)), 10.seconds)
        status match {
          case StrictSagaCoordinator.Status(s) => assert(s.terminal)
          case other => fail("unexpected reply " + other)
        }
      }, 40.seconds, 500.millis)
      val hostRef = spawnHost(kit, sharding, "op-e5", "occ-1")
      begin(kit, hostRef, "op-e5", "occ-1", SplitWafers) // same derived txid, different wafer set
      val report = awaitConcluded(kit, hostRef)
      // saga-core 0.3.0 (probe-certified 2026-11-20) folds a same-identity
      // different-args Start on an occupied terminal into the existing
      // transaction's terminal state (no second effect ever starts). The host
      // inherits the occupier's terminal rejection and STOPS — fail-closed with
      // zero effects from the host's own args.
      assert(report.concluded.contains("Rejected"),
        s"same txid with different args must fail closed on the occupied terminal, got: $report")
      assert(carriedOf(kit, entityRef(sharding, From)) == SeedWafers.toSet,
        "the occupier's rejection must not leak effects from the host's different args")
    }
}
