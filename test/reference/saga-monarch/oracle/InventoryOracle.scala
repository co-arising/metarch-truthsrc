package reference.inventory.oracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.{Behaviors, AskPattern}
import akka.util.{ByteString, Timeout}
import com.typesafe.config.ConfigFactory
import java.nio.file.{Files, Path, Paths}
import net.imadz.infra.saga.strict._
import net.imadz.monarch.persistence._
import net.imadz.monarch.persistence.batch._
import net.imadz.monarch.persistence.workflow._
import reference.inventory.kernel._
import reference.inventory.ext.FileInventoryPorts
import reference.inventory.glue._
import reference.inventory.root.InventoryApplication
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.{Await, ExecutionContext, Future, Promise}
import scala.concurrent.duration._

/** Fixed external assertions: no generator/model/template dependency or expected production emitter. */
class InventoryOracle extends AnyFunSuite {
  private val base = Paths.get(sys.props("inventory.oracle.directory"))
  private val request = ReservationRequest(RequestId("request-1"), Warehouse("warehouseA"), Warehouse("warehouseB"), Sku("sku-1"), Quantity(2))
  private def await[A](f: Future[A]): A = Await.result(f, 8.seconds)
  private val authorization = new RecoveryAuthorization {
    def authorize(id: SagaIdentity, token: String): Either[String, String] =
      if (token == "explicit-test-authorization") Right("test-operator") else Left("authorization denied")
  }
  private def fixture(label: String)(run: (ActorSystem[Nothing], FileInventoryPorts, InventoryApplication) => Unit): Unit = {
    val dir = base.resolve(label); Files.createDirectories(dir)
    val config = ConfigFactory.parseString(s"""
      serialized-validation-journal.directory = "${dir.resolve("journal") }"
      akka.persistence.snapshot-store.plugin = "akka.persistence.no-snapshot-store"
      akka.loglevel = WARNING
      monarch.operation.check-interval = 30ms
      monarch.operation.io-timeout = 1s
      monarch.operation.max-checks = 80
      monarch.delivery.poll-interval = 30ms
      monarch.delivery.max-polls = 100
    """).withFallback(SerializedValidationJournal.config).withFallback(ConfigFactory.load())
    val system = ActorSystem[Nothing](Behaviors.empty, "inventory-" + label, config)
    implicit val ec: ExecutionContext = system.executionContext
    val external = new FileInventoryPorts(dir.resolve("external"), request.warehouseA, request.warehouseB, authorization)
    val app = new InventoryApplication(system, "oracle-" + label, external.ports, ApplicationSettings(200.millis), SystemOwnership.CallerOwned)
    try run(system, external, app) finally { system.terminate(); await(system.whenTerminated) }
  }
  private def eventually[A](read: => A)(predicate: A => Boolean): A = {
    // Observation budget only; the JVM remains capped at 120s and runtime settings are unchanged.
    val until = System.nanoTime() + 30.seconds.toNanos
    var value = read
    while (!predicate(value) && System.nanoTime() < until) { Thread.sleep(20); value = read }
    assert(predicate(value), "ORACLE_EVENTUALLY: " + value); value
  }
  private def item(label: String): ItemIdentity = ItemIdentity(label, 0L, "item-1")
  private def status(app: InventoryApplication, id: ItemIdentity)(implicit system: ActorSystem[_]): StrictState = {
    import AskPattern._
    implicit val timeout: Timeout = Timeout(2.seconds)
    val a = await(app.reservations.association(id))
    await(app.reservations.actor(a.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.GetStatus(_))) match {
      case StrictSagaCoordinator.Status(s) => s
      case other => fail("unexpected status " + other)
    }
  }
  test("PURE-VALUES: positive quantities and two distinct resources") {
    intercept[IllegalArgumentException](Quantity(0)); intercept[IllegalArgumentException](Quantity(-1))
    intercept[IllegalArgumentException](request.copy(warehouseB = request.warehouseA))
  }
  test("WIRE-CODEC: independent request bytes and strict trailing/version rejection") {
    val out = new java.io.ByteArrayOutputStream; val data = new java.io.DataOutputStream(out)
    def text(s: String): Unit = { val b = s.getBytes("UTF-8"); data.writeInt(b.length); data.write(b) }
    text("inventory.request"); data.writeInt(1)
    Vector("request-1", "warehouseA", "warehouseB", "sku-1").foreach(text); data.writeInt(2); data.flush()
    val expected = out.toByteArray.toVector
    assert(BinaryCodecs.request.encode(request) == expected)
    assert(BinaryCodecs.request.decode(expected).get == request)
    assert(BinaryCodecs.request.decode(expected :+ 0.toByte).isFailure)
    assert(BinaryCodecs.request.decode(expected.dropRight(1)).isFailure)
  }
  test("FIVE-RESULTS: fixed tags three terminals and two observations") {
    val p = ReservationResult(TransactionId("tx"), request)
    val cases = Vector[SagaResult](SagaResult.Succeeded(p), SagaResult.RejectedBeforeEffects(p), SagaResult.Compensated(p),
      SagaResult.RecoveryRequired(p), SagaResult.OutcomeUnknown(p))
    assert(cases.map(_.terminal) == Vector(true, true, true, false, false))
    cases.zipWithIndex.foreach { case (value, i) =>
      val bytes = BinaryCodecs.result.encode(value)
      val in = new java.io.DataInputStream(new java.io.ByteArrayInputStream(bytes.toArray))
      val length = in.readInt(); in.skipBytes(length); assert(in.readInt() == 1); assert(in.readInt() == i + 1)
      assert(BinaryCodecs.result.decode(bytes).get == value)
    }
  }
  test("RUN-IDENTITY: each of six fields and committed terminal required") {
    implicit val ec: ExecutionContext = ExecutionContext.global
    val d = RunDefinition[String]("pure", "1", "codec-1", Vector("execute"))
    val s = RunSubmission("run", d.id, d.version, d.codecVersion, ByteString("original"))
    val facade = new CheckedRunFacade(null, d)
    val id = facade.expected(s)
    val v = RunProtocol.View(Some("run"), RunProtocol.Status.Completed, d.cursors, Some(ByteString("result")), Some(id), None, None)
    assert(facade.validate(s, RunProtocol.Current(v)) == Right(Some(ByteString("result"))))
    Vector(id.copy(runId = "other"), id.copy(definitionId = "other"), id.copy(definitionVersion = "2"),
      id.copy(codecVersion = "2"), id.copy(initialDigest = "wrong"), id.copy(planDigest = "wrong")).foreach { bad =>
      assert(facade.validate(s, RunProtocol.Current(v.copy(identity = Some(bad)))).isLeft)
    }
    assert(facade.validate(s, RunProtocol.Current(v.copy(lastState = None))).isLeft)
    assert(facade.validate(s, RunProtocol.Current(v.copy(status = RunProtocol.Status.Failed))).isLeft)
    assert(facade.validate(s, RunProtocol.Current(v.copy(status = RunProtocol.Status.Running))) == Right(None))
  }
  test("SAGA-HAPPY: two warehouse receipts and commit decision before both commits") {
    fixture("happy") { (sys, ext, app) =>
      implicit val system: ActorSystem[_] = sys
      val id = item("happy"); await(app.reservations.start(id, request))
      assert(eventually(await(app.reservations.query(id)))(_.terminal).isInstanceOf[SagaResult.Succeeded])
      val s = status(app, id)
      assert(s.commitDecision && s.participants.size == 2, "DROP-PARTICIPANT")
      assert(s.participants.forall(p => s.confirmed(s.operation(p, Phase.Prepare)) && s.confirmed(s.operation(p, Phase.Commit))))
      assert(!s.evidence.keys.exists(_.phase == Phase.Compensate), "COMPENSATE-COMMITTED")
      val association = await(app.reservations.association(id))
      intercept[IllegalArgumentException](app.reservations.classify(association, StrictSagaCoordinator.Status(s.copy(evidence = Map.empty))))
      intercept[IllegalArgumentException](app.reservations.classify(association, StrictSagaCoordinator.Status(s.copy(participants = s.participants.take(1)))))
      intercept[IllegalArgumentException](app.reservations.classify(association, StrictSagaCoordinator.Status(s.copy(identity = s.identity.map(_.copy(argsDigest = "wrong"))))))
      val receipt = await(app.reservations.publish(id)); assert(receipt.isInstanceOf[ResultObservation.Confirmed])
      assert(await(app.reservations.queryPublished(id)) == receipt)
      assert(await(app.reservations.publish(id)) == receipt)
      await(app.close()); assert(!sys.whenTerminated.isCompleted, "caller-owned system closed")
    }
  }
  test("PREPARE-REJECT: fenced A produces rejected-before-effects without compensation") {
    fixture("reject") { (sys, ext, app) =>
      implicit val system: ActorSystem[_] = sys
      val id = item("reject"); val a = InventorySaga.expected(id, request)
      await(ext.fence(PhaseIdentity(a.saga, "warehouse-a", request.warehouseA, "reserve-a", ReservationPhase.Prepare)))
      await(app.reservations.start(id, request))
      assert(eventually(await(app.reservations.query(id)))(_.terminal).isInstanceOf[SagaResult.RejectedBeforeEffects])
      assert(status(app, id).evidence.values.forall(!_.isInstanceOf[Evidence.Confirmed]))
    }
  }
  test("COMPENSATED: rejected B compensates only confirmed A") {
    fixture("compensated") { (sys, ext, app) =>
      implicit val system: ActorSystem[_] = sys
      val id = item("compensated"); val a = InventorySaga.expected(id, request)
      await(ext.fence(PhaseIdentity(a.saga, "warehouse-b", request.warehouseB, "reserve-b", ReservationPhase.Prepare)))
      await(app.reservations.start(id, request))
      assert(eventually(await(app.reservations.query(id)))(_.terminal).isInstanceOf[SagaResult.Compensated])
      val s = status(app, id); assert(!s.commitDecision)
      assert(s.evidence.collect { case (id, _: Evidence.Confirmed) if id.phase == Phase.Compensate => id.resource }.toSet == Set("warehouseA"))
    }
  }
  test("CONFLICTING-INPUT: durable association rejects changed original payload") {
    fixture("conflict") { (_, _, app) =>
      val id = item("conflict"); await(app.reservations.start(id, request))
      intercept[IllegalArgumentException](await(app.reservations.start(id, request.copy(quantity = Quantity(3)))))
    }
  }
  test("SAFE-ABSENCE: normal NotFound does not establish a durable fence") {
    fixture("absence") { (_, ext, _) =>
      val a = InventorySaga.expected(item("absence"), request); await(ext.ports.associations.ensure(a))
      val phase = PhaseIdentity(a.saga, "warehouse-a", request.warehouseA, "reserve-a", ReservationPhase.Prepare)
      val c = PrepareCommand(phase, request, None)
      assert(await(ext.ports.warehouseA.queryPrepare(c)).isInstanceOf[ParticipantObservation.NotFound])
      assert(await(ext.ports.warehouseA.prepare(c)).isInstanceOf[ParticipantObservation.Confirmed[_]])
      intercept[IllegalArgumentException](await(ext.fence(phase)))
    }
  }
  test("CANCEL-FENCE: fence survives reopening and rejects delayed prepare") {
    fixture("fence") { (sys, ext, _) =>
      implicit val ec: ExecutionContext = sys.executionContext
      val a = InventorySaga.expected(item("fence"), request); await(ext.ports.associations.ensure(a))
      val phase = PhaseIdentity(a.saga, "warehouse-a", request.warehouseA, "reserve-a", ReservationPhase.Prepare)
      await(ext.fence(phase))
      val reopened = new FileInventoryPorts(base.resolve("fence/external"), request.warehouseA, request.warehouseB, authorization)
      assert(await(reopened.ports.warehouseA.prepare(PrepareCommand(phase, request, None))).isInstanceOf[ParticipantObservation.SafeAbsent])
    }
  }
  test("COUNT-WAIT-EOF: max count window partial EOF and compatibility hard minimum") {
    val main = BatchPolicy.CountOrWait(2, 100, 1, true)
    assert(!main.ready(1, 0, 99, false, false)); assert(main.ready(2, 0, 0, false, false))
    assert(main.ready(1, 0, 100, false, false)); assert(main.ready(1, 0, 0, true, false))
    assert(!BatchPolicy.compatible(2, 2, 1).ready(1, 0, 10000, true, true))
  }
  test("ITEM-CONSERVATION: missing duplicate and foreign decisions rejected") {
    val items = Vector("one", "two").zipWithIndex.map { case (id, n) => Item(n, id, Vector(1.toByte), "key", "reserve") }
    val m = BatchManifest("job", "batch", "reserve", "1", items, 1)
    val area = AreaDefinition("reserve", "1", BatchPolicy.CountOrWait(2, 1), Map("permit" -> 1))
    def check(ids: Vector[String]) = BatchConservation.validate(m, BatchCompletion(ids.map(id => ItemDecision(id, ItemDisposition.Completed(Vector(1.toByte)))),
      ResourceDisposition.Release(Vector(1.toByte))), Map("reserve" -> area), 4)
    assert(check(Vector("one", "two")).isEmpty)
    assert(check(Vector("one")).nonEmpty, "DROP-ITEM"); assert(check(Vector("one", "one")).nonEmpty); assert(check(Vector("one", "foreign")).nonEmpty)
  }
  test("RESOURCE-PROOF: malformed release proof rejected by injected validator") {
    fixture("resource-proof") { (_, _, app) =>
      val grant = net.imadz.monarch.persistence.resource.ResourceProtocol.Grant("reservation", "operation", "token", Map("execution-permit" -> 1))
      val proof = net.imadz.monarch.persistence.resource.ResourceProtocol.Proof("operation", ByteString("fake\nproof"))
      assert(app.program.resourceEvidence.validate(grant, proof).isLeft, "RELEASE-EARLY")
    }
  }
  test("UNKNOWN-AUTHORIZATION: unknown never succeeds queries inert and unauthorized or excessive recovery denied") {
    fixture("unknown-auth") { (sys, ext, _) =>
      implicit val ec: ExecutionContext = sys.executionContext
      implicit val system: ActorSystem[_] = sys
      val calls = new java.util.concurrent.atomic.AtomicInteger()
      val unknown = new ParticipantDelegate(ext.ports.warehouseA) {
        override def prepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = {
          calls.incrementAndGet(); Future.successful(ParticipantObservation.Unknown(c.identity, "unknown external outcome"))
        }
      }
      val app = new InventoryApplication(sys, "unknown-adversary", ext.ports.copy(warehouseA = unknown),
        ApplicationSettings(200.millis), SystemOwnership.CallerOwned)
      val id = item("unknown-auth")
      assert(await(app.reservations.start(id, request)).isInstanceOf[SagaResult.OutcomeUnknown])
      assert(eventually(await(app.reservations.query(id)))(_.isInstanceOf[SagaResult.RecoveryRequired]).terminal == false, "UNKNOWN-SUCCESS")
      assert(await(app.reservations.publish(id)).isInstanceOf[ResultObservation.Unknown])
      intercept[IllegalArgumentException](await(app.reservations.reconcile(id, "denied", 2)))
      intercept[IllegalArgumentException](await(app.reservations.reconcile(id, "explicit-test-authorization", 17)))
      intercept[IllegalArgumentException](await(app.reservations.reconcile(id, "explicit-test-authorization", 0)))
      await(app.reservations.start(id, request)); await(app.reservations.query(id))
      assert(calls.get == 1 && !status(app, id).commitDecision)
      await(app.reservations.reconcile(id, "explicit-test-authorization", 1))
      eventually(await(app.reservations.query(id)))(_.isInstanceOf[SagaResult.RecoveryRequired])
      assert(calls.get == 1, "NOTFOUND-SAFEABSENT: ordinary missing query must not resubmit")
    }
  }
  test("STALE-CALLBACK: lost prepare ACK late callback inert explicit reconciliation queries durable receipt") {
    fixture("stale") { (sys, ext, _) =>
      implicit val ec: ExecutionContext = sys.executionContext
      implicit val system: ActorSystem[_] = sys
      val delayed = Promise[ParticipantObservation[PrepareReceipt]]()
      val durable = Promise[ParticipantObservation[PrepareReceipt]]()
      val participant = new ParticipantDelegate(ext.ports.warehouseA) {
        override def prepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] =
          super.prepare(c).flatMap { r => durable.success(r); delayed.future }
      }
      val app = new InventoryApplication(sys, "stale-adversary", ext.ports.copy(warehouseA = participant),
        ApplicationSettings(200.millis), SystemOwnership.CallerOwned)
      val id = item("stale"); await(app.reservations.start(id, request)); val receipt = await(durable.future)
      eventually(await(app.reservations.query(id)))(_.isInstanceOf[SagaResult.RecoveryRequired])
      delayed.success(receipt); Thread.sleep(80)
      assert(await(app.reservations.query(id)).isInstanceOf[SagaResult.RecoveryRequired])
      assert(!status(app, id).commitDecision)
      await(app.reservations.reconcile(id, "explicit-test-authorization", 8))
      assert(eventually(await(app.reservations.query(id)))(_.terminal).isInstanceOf[SagaResult.Succeeded])
    }
  }
  test("AFTER-COMMIT: unknown commit never compensates and recovers forward from durable receipt") {
    fixture("after-commit") { (sys, ext, _) =>
      implicit val ec: ExecutionContext = sys.executionContext
      implicit val system: ActorSystem[_] = sys
      val participant = new ParticipantDelegate(ext.ports.warehouseA) {
        override def commit(c: CommitCommand): Future[ParticipantObservation[CommitReceipt]] =
          super.commit(c).map(_ => ParticipantObservation.Unknown(c.identity, "lost commit ACK"))
      }
      val app = new InventoryApplication(sys, "commit-adversary", ext.ports.copy(warehouseA = participant),
        ApplicationSettings(500.millis), SystemOwnership.CallerOwned)
      val id = item("after-commit"); await(app.reservations.start(id, request))
      eventually(await(app.reservations.query(id)))(_.isInstanceOf[SagaResult.RecoveryRequired])
      val s = status(app, id); assert(s.commitDecision && !s.evidence.keys.exists(_.phase == Phase.Compensate), "COMPENSATE-COMMITTED")
      await(app.reservations.reconcile(id, "explicit-test-authorization", 4))
      assert(eventually(await(app.reservations.query(id)))(_.terminal).isInstanceOf[SagaResult.Succeeded])
    }
  }
  test("RESULT-ACK: lost delivery ACK queries exact durable identity and conflicting bytes rejected") {
    fixture("result-ack") { (sys, ext, _) =>
      implicit val ec: ExecutionContext = sys.executionContext
      val queries = new java.util.concurrent.atomic.AtomicInteger()
      val port = new ReservationResultPort {
        def deliver(e: ResultEnvelope): Future[ResultObservation] = ext.ports.results.deliver(e).map(_ => ResultObservation.Unknown("lost ACK"))
        def query(e: ResultEnvelope): Future[ResultObservation] = { queries.incrementAndGet(); ext.ports.results.query(e) }
      }
      val app = new InventoryApplication(sys, "result-adversary", ext.ports.copy(results = port), ApplicationSettings(500.millis), SystemOwnership.CallerOwned)
      val id = item("result-ack"); await(app.reservations.start(id, request))
      val result = eventually(await(app.reservations.query(id)))(_.terminal)
      assert(await(app.reservations.publish(id)).isInstanceOf[ResultObservation.Confirmed] && queries.get == 1)
      val a = await(app.reservations.association(id)); val other = SagaResult.Compensated(result.payload)
      val envelope = ResultEnvelope(a.resultKey, a.saga, other, BinaryCodecs.result.pin, BinaryCodecs.result.encode(other))
      assert(await(ext.ports.results.query(envelope)).isInstanceOf[ResultObservation.Conflict])
      intercept[IllegalArgumentException](await(ext.ports.results.deliver(envelope)))
    }
  }
  test("R2-MAIN: three items two areas EOF and exactly one result per item") {
    fixture("workflow") { (sys, _, app) =>
      implicit val system: ActorSystem[_] = sys
      implicit val timeout: Timeout = Timeout(3.seconds)
      import AskPattern._
      val job = app.workflow.job("job-main")
      (0 until 3).foreach { n =>
        val payload = ByteString.fromArray(BinaryCodecs.request.encode(request.copy(requestId = RequestId("request-" + n))).toArray)
        assert(await(job.ask[BatchProtocol.Reply](BatchProtocol.Offer(n, "item-" + n, payload, "reserve", "same", _))).isInstanceOf[BatchProtocol.Accepted])
      }
      await(job.ask[BatchProtocol.Reply](BatchProtocol.CloseInput(_)))
      def view: BatchProtocol.View = await(job.ask[BatchProtocol.Reply](BatchProtocol.Get(_))).asInstanceOf[BatchProtocol.Current].view
      val result = eventually(view)(v => v.active == 0 && v.inputClosed)
      assert(result.accepted == 3 && result.succeeded == 3 && result.failed == 0 && result.held == 0,
        "DRAIN-NOT-SUCCESS: " + result)
      assert(result.items.size == 3 && result.items.map(_.itemId).distinct.size == 3)
      result.items.foreach(i => assert(BinaryCodecs.result.decode(i.result.toArray.toVector).get.isInstanceOf[SagaResult.Succeeded]))
    }
  }
}
