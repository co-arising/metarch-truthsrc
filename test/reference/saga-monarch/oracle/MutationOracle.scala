package reference.inventory.oracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.AskPattern._
import akka.util.{ByteString, Timeout}
import net.imadz.infra.saga.strict._
import net.imadz.monarch.persistence.batch._
import net.imadz.monarch.persistence.operation.{OperationProtocol => Op}
import net.imadz.monarch.persistence.resource.{ResourceProtocol => Resource}
import net.imadz.monarch.persistence.workflow._
import org.scalatest.funsuite.AnyFunSuite
import reference.inventory.ext.FileInventoryPorts
import reference.inventory.glue._
import reference.inventory.kernel._
import reference.inventory.root.InventoryApplication
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.Try

class MutationOracle extends AnyFunSuite {
  import R2Support._
  private val request = ReservationRequest(RequestId("edge"), Warehouse("warehouseA"), Warehouse("warehouseB"), Sku("sku"), Quantity(2))
  private val authorization = new RecoveryAuthorization {
    def authorize(id: SagaIdentity, token: String): Either[String, String] = if (token == "operator") Right("explicit-operator") else Left("denied")
  }
  private def inventory(label: String)(body: (ActorSystem[Nothing], FileInventoryPorts, InventoryApplication) => Unit): Unit = fixture(label) { (dir, sys) =>
    implicit val ec: ExecutionContext = sys.executionContext
    val ext = new FileInventoryPorts(dir.resolve("external"), request.warehouseA, request.warehouseB, authorization)
    val app = new InventoryApplication(sys, label, ext.ports, ApplicationSettings(300.millis), SystemOwnership.CallerOwned)
    body(sys, ext, app)
  }
  private def manifest(area: String, count: Int): BatchManifest = BatchManifest("job", "batch/" + area, area, "1",
    (0 until count).map(n => Item(n, "item-" + n, BinaryCodecs.request.encode(request.copy(requestId = RequestId("r-" + n))), "same", area)).toVector, 1L)
  private def completed(app: InventoryApplication, m: BatchManifest): Op.Terminal = {
    m.items.foreach { i => val id = ItemIdentity(m.jobId, i.sequence, i.itemId); await(app.reservations.start(id, BinaryCodecs.request.decode(i.payload).get));
      eventually(await(app.reservations.query(id)))(_.terminal) }
    val port = app.program.connector(m.area); val r = app.program.operation(m)
    eventually(await(port.submit(r)))(_.isInstanceOf[Op.Confirmed]).asInstanceOf[Op.Confirmed].terminal
  }
  test("MUTATION_DROP_PARTICIPANT: real Saga must materialize and complete both original warehouse participants") {
    inventory("mut-participant") { (_, _, app) =>
      val result = Try { val id = ItemIdentity("drop", 0, "one"); await(app.reservations.start(id, request));
        eventually(await(app.reservations.query(id)))(_.terminal) }
      assert(result.toOption.exists(_.isInstanceOf[SagaResult.Succeeded]), "MUTATION_DROP_PARTICIPANT")
    }
  }
  test("MUTATION_UNKNOWN_SUCCESS: unknown participant cannot yield terminal success or publish") {
    inventory("mut-unknown") { (sys, ext, _) =>
      implicit val ec: ExecutionContext = sys.executionContext
      val unknown = new ParticipantDelegate(ext.ports.warehouseA) {
        override def prepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = Future.successful(ParticipantObservation.Unknown(c.identity, "uncertain"))
      }
      val app = new InventoryApplication(sys, "mut-unknown-special", ext.ports.copy(warehouseA = unknown), ApplicationSettings(200.millis), SystemOwnership.CallerOwned)
      val id = ItemIdentity("unknown", 0, "one"); await(app.reservations.start(id, request))
      val value = eventually(await(app.reservations.query(id)))(r => !r.isInstanceOf[SagaResult.OutcomeUnknown])
      assert(!value.terminal && value.isInstanceOf[SagaResult.RecoveryRequired], "MUTATION_UNKNOWN_SUCCESS")
      assert(await(app.reservations.publish(id)).isInstanceOf[ResultObservation.Unknown])
    }
  }
  test("MUTATION_COMPENSATE_COMMITTED: durable committed participant rejects a compensation effect") {
    inventory("mut-compensate") { (sys, ext, app) =>
      implicit val system: ActorSystem[_] = sys; implicit val timeout: Timeout = Timeout(3.seconds)
      val id = ItemIdentity("committed", 0, "one"); await(app.reservations.start(id, request)); eventually(await(app.reservations.query(id)))(_.terminal)
      val a = await(app.reservations.association(id))
      val s = await(app.reservations.actor(a.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.GetStatus(_))).asInstanceOf[StrictSagaCoordinator.Status].state
      val prepared = s.evidence.collectFirst { case (op, Evidence.Confirmed(_, bytes)) if op.phase == Phase.Prepare && op.resource == "warehouseA" => InventorySaga.prepareCodec.decode(bytes).get }.get
      val command = CompensateCommand(prepared.identity.copy(phase = ReservationPhase.Compensate), request, prepared)
      assert(Try(await(ext.ports.warehouseA.compensate(command))).isFailure, "MUTATION_COMPENSATE_COMMITTED")
      assert(await(ext.ports.warehouseA.queryCompensate(command)).isInstanceOf[ParticipantObservation.NotFound])
    }
  }
  test("MUTATION_OPERATION_IDENTITY: public completion rejects foreign terminal request digest") {
    inventory("mut-identity") { (_, _, app) =>
      val m = manifest("reserve", 1); val good = completed(app, m).asInstanceOf[Op.Succeeded]
      assert(app.program.complete(m, good).isRight)
      val bad = good.copy(evidence = good.evidence.copy(requestDigest = "0" * 64))
      assert(app.program.complete(m, bad).isLeft, "MUTATION_OPERATION_IDENTITY")
    }
  }
  test("MUTATION_NOTFOUND_SAFEABSENT: ordinary missing receipt never authorizes repeat Prepare") {
    inventory("mut-notfound") { (sys, ext, _) =>
      implicit val ec: ExecutionContext = sys.executionContext
      val executes = new java.util.concurrent.atomic.AtomicInteger; val queries = new java.util.concurrent.atomic.AtomicInteger
      val unknown = new ParticipantDelegate(ext.ports.warehouseA) {
        override def prepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = {
          executes.incrementAndGet(); Future.successful(ParticipantObservation.Unknown(c.identity, "uncertain"))
        }
        override def queryPrepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = {
          queries.incrementAndGet(); Future.successful(ParticipantObservation.NotFound(c.identity))
        }
      }
      val app = new InventoryApplication(sys, "mut-notfound-special", ext.ports.copy(warehouseA = unknown), ApplicationSettings(200.millis), SystemOwnership.CallerOwned)
      val id = ItemIdentity("notfound", 0, "one"); await(app.reservations.start(id, request)); eventually(await(app.reservations.query(id)))(_.isInstanceOf[SagaResult.RecoveryRequired])
      await(app.reservations.reconcile(id, "operator", 2)); eventually(queries.get)(_ == 1)
      Thread.sleep(150); assert(executes.get == 1, "MUTATION_NOTFOUND_SAFEABSENT")
      assert(!await(app.reservations.query(id)).terminal)
    }
  }
  test("MUTATION_RELEASE_EARLY: actual resource actor retains permit after forged result proof") {
    inventory("mut-release") { (sys, _, app) =>
      implicit val system: ActorSystem[_] = sys; implicit val timeout: Timeout = Timeout(3.seconds)
      val resources = app.workflow.resourceDomain
      val r = Resource.Request("unsettled", "original-operation", Map("execution-permit" -> 1))
      val g = eventually(await(resources.ask[Resource.Reply](Resource.Reserve(r, _))))(_.isInstanceOf[Resource.Granted]).asInstanceOf[Resource.Granted].grant
      val reply = await(resources.ask[Resource.Reply](Resource.Release(g.reservationId, g.token, Resource.Proof(g.ownerOperationKey, ByteString("fake-digest\nfake-proof")), _)))
      assert(reply.isInstanceOf[Resource.Rejected], "MUTATION_RELEASE_EARLY")
      assert(await(resources.ask[Resource.Reply](Resource.Query(g.reservationId, _))).isInstanceOf[Resource.Granted])
    }
  }
  test("MUTATION_DROP_ITEM: completed real two-item manifest yields exactly both original dispositions") {
    inventory("mut-item") { (_, _, app) =>
      val m = manifest("reserve", 2); val terminal = completed(app, m)
      val completion = app.program.complete(m, terminal)
      assert(completion.exists(c => c.decisions.map(_.itemId) == Vector("item-0", "item-1")), "MUTATION_DROP_ITEM")
    }
  }
  test("MUTATION_SETTLE_BEFORE_RESULT: confirmed execution without durable result ACK cannot settle publish area") {
    inventory("mut-settle") { (_, ext, app) =>
      val m = manifest("publish-result", 1); val i = m.items.head; val original = BinaryCodecs.request.decode(i.payload).get
      val id = ItemIdentity(m.jobId, i.sequence, i.itemId); await(app.reservations.start(id, original)); val result = eventually(await(app.reservations.query(id)))(_.terminal)
      assert(await(app.reservations.queryPublished(id)) == ResultObservation.NotFound)
      val bytes = ByteString(BinaryCodecs.manifestResult.encode(ManifestResult(Vector(ItemResult(id, result, None)))).toArray)
      val request = app.program.operation(m); val digest = BinaryCodecs.digest(bytes.toVector)
      val evidence = Op.Evidence(request.operationKey, request.fingerprint, request.ledgerEpoch, Some(request.effectKey),
        ByteString(digest + "\n" + ext.ports.executionEvidence.certify(request.operationKey, bytes.toVector)))
      assert(app.program.complete(m, Op.Succeeded(bytes, evidence)).isLeft, "MUTATION_SETTLE_BEFORE_RESULT")
    }
  }
  test("B-PREPARE-REJECT-REAL: refusal alone stays unknown until cancellation authority fences absence") {
    Vector(true, false).foreach { rejectA => inventory("edge-reject-" + rejectA) { (sys, ext, _) =>
      implicit val ec: ExecutionContext = sys.executionContext
      val rejected = new ParticipantDelegate(if (rejectA) ext.ports.warehouseA else ext.ports.warehouseB) {
        private val first = new java.util.concurrent.atomic.AtomicBoolean(true)
        override def prepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] =
          if (first.getAndSet(false)) Future.successful(ParticipantObservation.Rejected(c.identity, "refusal without absence proof")) else super.prepare(c)
      }
      val ports = if (rejectA) ext.ports.copy(warehouseA = rejected) else ext.ports.copy(warehouseB = rejected)
      val app = new InventoryApplication(sys, "reject-special", ports, ApplicationSettings(200.millis), SystemOwnership.CallerOwned)
      val id = ItemIdentity("reject", 0, "one"); await(app.reservations.start(id, request))
      assert(!eventually(await(app.reservations.query(id)))(_.isInstanceOf[SagaResult.RecoveryRequired]).terminal)
      val identity = InventorySaga.expected(id, request).saga
      await(ext.fence(PhaseIdentity(identity, if (rejectA) "warehouse-a" else "warehouse-b",
        if (rejectA) request.warehouseA else request.warehouseB, if (rejectA) "reserve-a" else "reserve-b", ReservationPhase.Prepare)))
      await(app.reservations.reconcile(id, "operator", 8))
      val end = eventually(await(app.reservations.query(id)))(_.terminal)
      assert(if (rejectA) end.isInstanceOf[SagaResult.RejectedBeforeEffects] else end.isInstanceOf[SagaResult.Compensated])
    }}
  }
  test("B-BOUNDED-RECONCILE: one authorized query cannot spend a second interaction on Prepare B") {
    inventory("edge-budget") { (sys, ext, _) =>
      implicit val system: ActorSystem[_] = sys; implicit val timeout: Timeout = Timeout(3.seconds); implicit val ec: ExecutionContext = sys.executionContext
      val a = new ParticipantDelegate(ext.ports.warehouseA) {
        override def prepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = super.prepare(c).map(_ => ParticipantObservation.Unknown(c.identity, "lost ACK"))
      }
      val app = new InventoryApplication(sys, "budget-special", ext.ports.copy(warehouseA = a), ApplicationSettings(200.millis), SystemOwnership.CallerOwned)
      val id = ItemIdentity("budget", 0, "one"); await(app.reservations.start(id, request)); eventually(await(app.reservations.query(id)))(_.isInstanceOf[SagaResult.RecoveryRequired])
      await(app.reservations.reconcile(id, "operator", 1)); val association = await(app.reservations.association(id))
      def state = await(app.reservations.actor(association.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.GetStatus(_))).asInstanceOf[StrictSagaCoordinator.Status].state
      val s = eventually(state)(s => s.status == StrictStatus.RecoveryRequired && s.evidence.exists { case (_, _: Evidence.Confirmed) => true; case _ => false })
      assert(!s.commitDecision && s.evidence.count { case (_, _: Evidence.Confirmed) => true; case _ => false } == 1)
      assert(!s.evidence.keys.exists(_.resource == "warehouseB"))
      await(app.reservations.reconcile(id, "operator", 8)); assert(eventually(await(app.reservations.query(id)))(_.terminal).isInstanceOf[SagaResult.Succeeded])
    }
  }
  test("B-CONFLICTING-PINS: real Attach rejects definition args codec and plan identity changes") {
    inventory("edge-pins") { (sys, _, app) =>
      implicit val system: ActorSystem[_] = sys; implicit val timeout: Timeout = Timeout(3.seconds)
      val id = ItemIdentity("pins", 0, "one"); await(app.reservations.start(id, request)); eventually(await(app.reservations.query(id)))(_.terminal)
      val a = await(app.reservations.association(id)); val original = InventorySaga.runtime(a.saga)
      Vector(original.copy(definitionVersion = 2), original.copy(definitionDigest = "changed"), original.copy(argsDigest = "changed"),
        original.copy(argsCodec = CodecPin(original.argsCodec.id, 2)), original.copy(planDigest = "changed")).foreach { bad =>
        assert(await(app.reservations.actor(a.saga).ask[StrictSagaCoordinator.Reply](StrictSagaCoordinator.Attach(bad, _))) == StrictSagaCoordinator.ConflictingIdentity)
      }
    }
  }
}
