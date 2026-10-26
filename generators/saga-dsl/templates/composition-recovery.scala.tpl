  // The test only mutates databases minted by this suite, after their writer stopped.
  private val OwnedUris = scala.collection.mutable.Set.empty[String]
  private def dbNameOf(uri: String): String = uri.split("/").last
  private def journalCollections(client: MongoClient, db: String): Vector[String] =
    Await.result(client.getDatabase(db).listCollectionNames().toFuture(), 10.seconds).toVector
      .filter(_.contains("journal")).sorted

  private final case class JournalBatch(collection: String, document: Document, from: Long, to: Long,
                                         events: Vector[org.bson.BsonDocument])
  private def number(d: org.bson.BsonDocument, key: String): Long = d.get(key).asNumber().longValue()
  private def batches(client: MongoClient, uri: String, pid: String): Vector[JournalBatch] = {
    val db = dbNameOf(uri)
    val result = journalCollections(client, db).flatMap { c =>
      Await.result(client.getDatabase(db).getCollection(c).find(Document("pid" -> pid)).toFuture(), 10.seconds)
        .map { d =>
          val raw = d.toBsonDocument
          val events = raw.getArray("events").getValues.toArray.toVector.map(_.asInstanceOf[org.bson.BsonValue].asDocument())
          val from = number(raw, "from")
          val to = number(raw, "to")
          require(events.nonEmpty && events.head.getString("pid").getValue == pid, "wrong batch identity")
          require(events.forall(_.getString("pid").getValue == pid), "mixed batch identities")
          require(events.map(number(_, "sn")) == (from to to).toVector, "invalid batch bounds or sequence")
          JournalBatch(c, d, from, to, events)
        }
    }.sortBy(_.from)
    val sequence = result.flatMap(_.events.map(number(_, "sn")))
    require(sequence == (1L to sequence.size.toLong).toVector, "journal is not a contiguous global prefix")
    result
  }

  private def rawEvents(uri: String, pid: String): Vector[String] = {
    val client = MongoClient(uri)
    try batches(client, uri, pid).flatMap(_.events.map(_.toJson)) finally client.close()
  }
  private def countJournal(uri: String, pid: String): Long = rawEvents(uri, pid).size.toLong

  private def eventsOf(kit: ActorTestKit, pid: String): Vector[akka.persistence.query.EventEnvelope] = {
    implicit val mat: akka.stream.Materializer = akka.stream.SystemMaterializer(kit.system).materializer
    val journal = akka.persistence.query.PersistenceQuery(kit.system)
      .readJournalFor[akka.contrib.persistence.mongodb.ScalaDslMongoReadJournal]("akka-contrib-mongodb-persistence-readjournal")
    val events = Await.result(journal.currentEventsByPersistenceId(pid, 1L, Long.MaxValue)
      .runWith(akka.stream.scaladsl.Sink.seq), 15.seconds).toVector
    assert(events.map(_.sequenceNr) == (1L to events.size.toLong).toVector, "query must observe the full prefix")
    events
  }

  private def stoppedWriter(kit: ActorTestKit, uri: String): Unit = {
    kit.shutdownTestKit()
    require(kit.system.whenTerminated.isCompleted, "writer must terminate before journal surgery")
    require(OwnedUris.contains(uri) && dbNameOf(uri).startsWith("p16_composition_"), "database is not owned by this run")
  }

  private def assertPrefix(uri: String, pid: String, keep: Int, expected: Vector[String]): Unit = {
    val actual = rawEvents(uri, pid)
    assert(actual == expected.take(keep) && actual.size == keep, "injection did not retain the exact prefix")
    println("P16_PREFIX " + dbNameOf(uri) + " pid=" + pid + " keep=" + keep +
      " sequence=" + (1 to keep).mkString(",") + " events=" + actual.mkString("[", ",", "]"))
  }

  /** RxMongo stores one document per atomic batch, not one per persistenceId.
    * Trim a crossing batch and remove every later batch, preserving event bytes. */
  private def truncateJournal(stopped: ActorTestKit, uri: String, pid: String, keep: Int): Unit = {
    require(stopped.system.whenTerminated.isCompleted, "live writer cannot be truncated")
    require(OwnedUris.contains(uri) && dbNameOf(uri).startsWith("p16_composition_"), "unowned journal")
    val client = MongoClient(uri)
    try {
      val before = batches(client, uri, pid)
      val expected = before.flatMap(_.events.map(_.toJson))
      require(keep > 0 && keep < expected.size, "cut must remove a nonempty journal tail")
      val db = client.getDatabase(dbNameOf(uri))
      val collections = Await.result(db.listCollectionNames().toFuture(), 10.seconds)
      collections.filter(_.contains("snap")).foreach { c =>
        require(Await.result(db.getCollection(c).find(Document("pid" -> pid)).toFuture(), 10.seconds).isEmpty,
          "snapshot would mask the requested prefix")
      }
      before.foreach { batch =>
        val raw = batch.document.toBsonDocument
        val filter = Document("_id" -> raw.get("_id"), "pid" -> pid, "from" -> batch.from, "to" -> batch.to)
        val collection = db.getCollection(batch.collection)
        if (batch.from > keep) {
          val result = Await.result(collection.deleteOne(filter).toFuture(), 10.seconds)
          require(result.getDeletedCount == 1L, "tail batch delete did not match exactly one document")
        } else if (batch.to > keep) {
          val survivors = batch.events.takeWhile(number(_, "sn") <= keep)
          val change = Document("$set" -> Document("events" -> org.mongodb.scala.bson.BsonArray(survivors), "to" -> keep.toLong))
          val result = Await.result(collection.updateOne(filter, change).toFuture(), 10.seconds)
          require(result.getMatchedCount == 1L && result.getModifiedCount == 1L, "crossing batch update failed")
        }
      }
      assertPrefix(uri, pid, keep, expected)
    } finally client.close()
  }

  private def hostPid(operation: String, occurrence: String): String = @HOST@.persistenceIdFor(operation, occurrence).id
  private def childPid(operation: String, occurrence: String): String = @HOST@.childPersistenceId(operation, occurrence)
  private val SplitSagaPid = @SPLIT_ENTRY@.persistenceId.id
  private val MergeSagaPid = @MERGE_ENTRY@.persistenceId.id
  private def lotPid(entityId: String): String = akka.persistence.typed.PersistenceId(@ENTITY_KEY@.entityTypeKey.name, entityId).id

  private def durableEffects(uri: String, operation: String): Map[String, Vector[String]] =
    Vector(SplitSagaPid, MergeSagaPid, childPid(operation, "occ-1"), lotPid(From), lotPid(To))
      .map(pid => pid -> rawEvents(uri, pid)).toMap

  private def assertExactlyOnce(kit: ActorTestKit, uri: String, operation: String): Unit = {
    val client = MongoClient(uri)
    val sagaPids = try journalCollections(client, dbNameOf(uri)).flatMap { c =>
      Await.result(client.getDatabase(dbNameOf(uri)).getCollection(c).find().toFuture(), 10.seconds)
        .map(_.toBsonDocument.getString("pid").getValue).filter(_.startsWith("strict-saga/"))
    }.toSet finally client.close()
    assert(sagaPids == Set(SplitSagaPid, MergeSagaPid), "exactly the two declared saga persistenceIds")
    Vector(SplitSagaPid -> @HOST@.SplitStep, MergeSagaPid -> @HOST@.MergeStep).foreach { case (pid, step) =>
      val events = eventsOf(kit, pid)
      assert(events.nonEmpty, "real saga journal must not be empty")
      val started = events.collect { case e if e.event.isInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started] =>
        e.event.asInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started] }
      assert(started.size == 1 && started.head.identity.transactionId == @HOST@.txidFor(operation, "occ-1", step),
        "each saga must start exactly once with its stable transaction identity")
    }
    val child = eventsOf(kit, childPid(operation, "occ-1")).map(_.event)
    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunStarted]) == 1)
    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1)
    val checkpoints = child.collect { case e: net.imadz.monarch.persistence.PersistentMonarch.StageDone => e }
    assert(checkpoints.map(_.cursor) == Vector("receive#0", "process#1", "finalize#2"))
    val processed = @CHILD_PLAN@.@CHILD_STATE@.codec.decode(checkpoints.last.snapshot)
    assert(processed.wafers == SplitWafers && processed.processedCount == SplitWafers.size)
    val business = Vector(From, To).flatMap(id => eventsOf(kit, lotPid(id)).map(_.event)).collect { case p: Product => p }
    Vector(@HOST@.SplitStep, @HOST@.MergeStep).foreach { step =>
      val txid = @HOST@.txidFor(operation, "occ-1", step)
      val effects = business.filter(p => p.productArity > 0 && p.productElement(0) == txid)
      assert(effects.map(_.productPrefix).sorted == Vector("CommitAddWaferConfirmed", "CommitWaferRemovalConfirmed",
        "ReserveAddWaferConfirmed", "ReserveWaferRemovalConfirmed").sorted, "exactly four persisted TCC effects per saga")
    }
    assert(carriedOf(kit, entityRef(shardingOf(kit), From)) == SeedWafers.toSet)
    assert(carriedOf(kit, entityRef(shardingOf(kit), To)) == ChildBaseWafers.toSet)
    println("P16_EFFECTS " + dbNameOf(uri) + " sagaPids=" + sagaPids.toVector.sorted.mkString(",") +
      " started=1,1 childStarted=1 childStages=3 businessEffects=4,4")
  }

  private def shardingOf(kit: ActorTestKit): ClusterSharding = ClusterSharding(kit.system)
  private def assertHostTrace(kit: ActorTestKit, operation: String): Unit = {
    val events = eventsOf(kit, hostPid(operation, "occ-1")).map(_.event)
    val start = events.collect { case e: @HOST@.OperationStarted => e }
    assert(start.size == 1 && start.head.manifest == ManifestSeed && start.head.wafers == SplitWafers)
    @HOST@.StepIds.foreach { step =>
      val intents = events.zipWithIndex.collect { case (e: @HOST@.InvocationIntentPersisted, i) if e.stepId == step => e -> i }
      val checkpoints = events.zipWithIndex.collect { case (e: @HOST@.StepCheckpointed, i) if e.stepId == step => e -> i }
      assert(intents.size == 1 && checkpoints.size == 1 && intents.head._2 < checkpoints.head._2)
      val expectedKey = if (step == @HOST@.AwaitStep) @HOST@.childRunKey(operation, "occ-1") else @HOST@.txidFor(operation, "occ-1", step)
      assert(intents.head._1.key == expectedKey)
      if (step != @HOST@.AwaitStep) {
        val identities = events.zipWithIndex.collect { case (e: @HOST@.IdentityObserved, i) if e.stepId == step => e -> i }
        assert(identities.size == 1 && identities.head._1.transactionId == expectedKey)
        assert(intents.head._2 < identities.head._2 && identities.head._2 < checkpoints.head._2)
      }
    }
    val completedChild = events.collect { case e: @HOST@.StepCheckpointed if e.stepId == @HOST@.AwaitStep => e }.head
    assert(completedChild.outputs("wafers").split(",").toVector == SplitWafers)
    assert(completedChild.outputs("childRun") == @HOST@.childRunKey(operation, "occ-1"))
    val childIndex = events.indexOf(completedChild)
    val mergeIntent = events.indexWhere { case e: @HOST@.InvocationIntentPersisted => e.stepId == @HOST@.MergeStep; case _ => false }
    assert(childIndex < mergeIntent, "merge intent follows the authoritative child checkpoint")
    assert(events.count(_.isInstanceOf[@HOST@.OperationConcluded]) == 1)
  }

  private def effectAudit(kit: ActorTestKit, operation: String, blocked: Option[String] = None,
                         hit: Option[ActorRef[(String, String)]] = None): (String, String) => Boolean = { (step, key) =>
    val events = eventsOf(kit, hostPid(operation, "occ-1")).map(_.event)
    assert(events.exists { case e: @HOST@.InvocationIntentPersisted => e.stepId == step && e.key == key; case _ => false },
      "intent must be durably query-visible before Start/StartRun")
    hit.foreach(_ ! (step -> key))
    println("P16_INTENT_BEFORE_EFFECT " + operation + " step=" + step + " key=" + key + " send=" + !blocked.contains(step))
    !blocked.contains(step)
  }

  private def recover(name: String, uri: String, operation: String)(body: (ActorTestKit, ClusterSharding, ActorRef[@HOST@.Command]) => Unit): Unit = {
    val kit = ActorTestKit(name, compositionConfig(name, freePort(), uri))
    try {
      val sharding = initSharding(kit)
      waitClusterUp(kit)
      val host = spawnHost(kit, sharding, operation, "occ-1", Some(effectAudit(kit, operation)))
      body(kit, sharding, host)
    } finally kit.shutdownTestKit()
  }

  private def withCluster[T](name: String)(body: (ActorTestKit, ClusterSharding, String) => T): T = {
    assume(mongoReachable(), "MongoDB unavailable — recovery certification must not count canceled tests as passing")
    val uri = mongoUri("p16_composition_" + System.nanoTime())
    OwnedUris += uri
    val kit = ActorTestKit(name, compositionConfig(name, freePort(), uri))
    try {
      val sharding = initSharding(kit)
      waitClusterUp(kit)
      body(kit, sharding, uri)
    } finally if (!kit.system.whenTerminated.isCompleted) kit.shutdownTestKit()
  }

  "E0 journal injection: crossing batch, tail removal and fail-closed guards" in withCluster("CompositionE0") { (kit, _, uri) =>
    val pid = "p16-prefix-probe"
    intercept[IllegalArgumentException] { truncateJournal(kit, uri, pid, 4) }
    stoppedWriter(kit, uri)
    val client = MongoClient(uri)
    try {
      val collection = client.getDatabase(dbNameOf(uri)).getCollection("p16_probe_journal")
      def batch(id: String, from: Long, to: Long): Document =
        Document("pid" -> id, "from" -> from, "to" -> to,
          "events" -> org.mongodb.scala.bson.BsonArray((from to to).map(sn => Document("pid" -> id, "sn" -> sn).toBsonDocument)))
      Await.result(collection.insertMany(Vector(batch(pid, 1L, 2L), batch(pid, 3L, 5L), batch(pid, 6L, 7L),
        batch("p16-protected-pid", 1L, 2L))).toFuture(), 10.seconds)
      val before = rawEvents(uri, pid)
      val protectedBefore = rawEvents(uri, "p16-protected-pid")
      intercept[IllegalArgumentException] { truncateJournal(kit, "mongodb://127.0.0.1:27017/unowned", pid, 4) }
      intercept[IllegalArgumentException] { truncateJournal(kit, uri, pid, 0) }
      intercept[IllegalArgumentException] { truncateJournal(kit, uri, pid, 7) }
      intercept[IllegalArgumentException] { truncateJournal(kit, uri, "missing", 4) }
      assert(rawEvents(uri, pid) == before, "rejected surgery must not write")
      truncateJournal(kit, uri, pid, 4)
      assert(rawEvents(uri, pid) == before.take(4))
      assert(rawEvents(uri, "p16-protected-pid") == protectedBefore, "other pids must remain unchanged")
      val survivors = batches(client, uri, pid)
      assert(survivors.map(b => b.from -> b.to) == Vector(1L -> 2L, 3L -> 4L))
      val malformed = Document("pid" -> "p16-malformed-pid", "from" -> 1L, "to" -> 2L,
        "events" -> org.mongodb.scala.bson.BsonArray(Vector(Document("pid" -> "p16-malformed-pid", "sn" -> 2L).toBsonDocument)))
      Await.result(collection.insertOne(malformed).toFuture(), 10.seconds)
      intercept[IllegalArgumentException] { truncateJournal(kit, uri, "p16-malformed-pid", 1) }
    } finally client.close()
  }

  "E1 composition full chain: every intent precedes its effect" in withCluster("CompositionE1") { (kit, sharding, uri) =>
    seedFunds(kit, sharding, From, "seed-e1-from")
    seedFunds(kit, sharding, To, "seed-e1-to", ChildBaseWafers)
    val host = spawnHost(kit, sharding, "op-e1", "occ-1", Some(effectAudit(kit, "op-e1")))
    assert(begin(kit, host, "op-e1", "occ-1", SplitWafers).accepted)
    assert(awaitConcluded(kit, host).concluded.contains("AllStepsSucceeded"))
    assertHostTrace(kit, "op-e1")
    assertExactlyOnce(kit, uri, "op-e1")
  }

  private def completedWindow(name: String, operation: String, cut: Any => Boolean, expectedKeep: Option[Int]): Unit =
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
        assert(durableEffects(uri, operation) == before, "all saga/child/business journal bytes must be unchanged")
        assertHostTrace(kit2, operation)
        assertExactlyOnce(kit2, uri, operation)
      }
    }

  "E2 saga terminal stored, checkpoint missing: reattach with zero new events" in {
    completedWindow("CompositionE2", "op-e2", {
      case e: @HOST@.IdentityObserved => e.stepId == @HOST@.SplitStep
      case _ => false
    }, Some(3))
  }

  "E3 await intent stored, all mirrors and child checkpoint missing: authoritative reconciliation" in {
    completedWindow("CompositionE3", "op-e3", {
      case e: @HOST@.InvocationIntentPersisted => e.stepId == @HOST@.AwaitStep
      case _ => false
    }, Some(5))
  }

  "E4 intent stored, identity lost after completed Start: same identity reissue" in {
    completedWindow("CompositionE4", "op-e4", {
      case e: @HOST@.InvocationIntentPersisted => e.stepId == @HOST@.SplitStep
      case _ => false
    }, Some(2))
  }

  "E4b intent stored, first Start not sent: deterministic barrier" in withCluster("CompositionE4b") { (kit, sharding, uri) =>
    seedFunds(kit, sharding, From, "seed-e4b-from")
    seedFunds(kit, sharding, To, "seed-e4b-to", ChildBaseWafers)
    val hit = kit.createTestProbe[(String, String)]()
    val host = spawnHost(kit, sharding, "op-e4b", "occ-1",
      Some(effectAudit(kit, "op-e4b", Some(@HOST@.SplitStep), Some(hit.ref))))
    assert(begin(kit, host, "op-e4b", "occ-1", SplitWafers).accepted)
    assert(hit.receiveMessage(15.seconds) == (@HOST@.SplitStep -> @HOST@.txidFor("op-e4b", "occ-1", @HOST@.SplitStep)))
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
    "child-checkpoint" -> { case e: @HOST@.StepCheckpointed => e.stepId == @HOST@.AwaitStep; case _ => false },
    "merge-intent" -> { case e: @HOST@.InvocationIntentPersisted => e.stepId == @HOST@.MergeStep; case _ => false },
    "merge-identity" -> { case e: @HOST@.IdentityObserved => e.stepId == @HOST@.MergeStep; case _ => false })) {
    ("E6 confirmed-prefix boundary " + label + ": no second effects") in {
      completedWindow("CompositionE6" + label.replace("-", ""), "op-e6-" + label, cut, None)
    }
  }

