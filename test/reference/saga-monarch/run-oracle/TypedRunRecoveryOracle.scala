package reference.inventory.runoracle

import akka.actor.typed.ActorSystem
import akka.util.ByteString
import java.nio.file.{Files, Paths}
import net.imadz.monarch.persistence.batch._
import net.imadz.monarch.persistence.workflow.BatchManifest
import reference.inventory.ext.{FileInventoryPorts, ManagedCheck}
import reference.inventory.glue._
import reference.inventory.kernel._
import reference.inventory.kernel.ManagedCheckRunProtocol.{Check, Input}
import reference.inventory.oracle.R2Support
import reference.inventory.root.InventoryApplication
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._

/** Fresh JVMs share only original journals and the external forced receipt. */
object TypedRunRecoveryOracle {
  import R2Support._
  private val request = ReservationRequest(RequestId("success"), Warehouse("a"), Warehouse("b"), Sku("sku"), Quantity(2))
  private val item = ItemIdentity("job", 0L, "item-0")
  private val association = InventorySaga.expected(item, request)
  private val authorization = new RecoveryAuthorization {
    def authorize(id: SagaIdentity, token: String): Either[String, String] =
      if (id == association.saga && token == "operator") Right("explicit-operator") else Left("denied")
  }
  def main(args: Array[String]): Unit = {
    require(args.length == 2); val Array(mode, directory) = args; val dir = Paths.get(directory)
    val sys = system(dir, "typed-ack-" + mode)
    implicit val active: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
    try {
      val external = new FileInventoryPorts(dir.resolve("external"), request.warehouseA, request.warehouseB, authorization)
      val underlying = new ManagedCheck(dir.resolve("external"))
      val leaf: Check.Leaf = if (mode != "fault") underlying else new Check.Leaf {
        def submit(r: Check.Request): Future[Check.Observation] = underlying.submit(r).map { value =>
          require(value.isInstanceOf[Check.Observation.Confirmed])
          val frozen = manifests(dir, "typed-ack/workflow|job|job").head
          forced(dir.resolve("manifest.bin"), BatchCodec.manifestToBytes(frozen).toArray)
          forced(dir.resolve("fault.record"), r.operationId.getBytes("UTF-8"))
          Console.out.println("EXPECTED_TYPED_ACK code=78"); Console.out.flush(); Runtime.getRuntime.halt(78)
          value
        }
        def query(r: Check.Request): Future[Check.Observation] = underlying.query(r)
        def validateEvidence(r: Check.Request, value: Check.Evidence): Either[String, Unit] = underlying.validateEvidence(r, value)
      }
      val app = new InventoryApplication(sys, "typed-ack", external.ports, ApplicationSettings(), SystemOwnership.CallerOwned,
        ManagedCheckRun.Leaves(leaf))
      if (mode == "fault") {
        val job = app.workflow.job("job")
        ask(job, BatchProtocol.Offer(0, "item-0", ByteString(BinaryCodecs.request.encode(request).toArray), "reserve", "same", _))
        ask(job, BatchProtocol.CloseInput(_)); Thread.sleep(15000)
        throw new AssertionError("TYPED_ACK_FAULT_NOT_REACHED")
      }
      require(Files.exists(dir.resolve("fault.record")))
      val m = BatchCodec.manifestFromBytes(ByteString(Files.readAllBytes(dir.resolve("manifest.bin"))))
      val input = Input(request, association.saga.transactionId)
      val runId = BinaryCodecs.identityDigest(Vector("managed-check".getBytes("UTF-8").toVector, BinaryCodecs.item.encode(item), m.operationKey.getBytes("UTF-8").toVector))
      val cold = snapshots(dir)
      assert(await(app.managedCheckRunHost.query(runId, input)).isLeft)
      Thread.sleep(80); assert(snapshots(dir) == cold, "cold query created journals or effects")
      if (mode == "recover") {
        assert(await(app.recoverRuns(m, "denied")).isInstanceOf[BatchProtocol.Rejected])
        assert(snapshots(dir) == cold, "denied recovery activated actor")
        val changed = m.copy(items = m.items.map(i => i.copy(payload = BinaryCodecs.request.encode(request.copy(quantity = Quantity(4))))))
        assert(await(app.recoverRuns(changed, "operator")).isInstanceOf[BatchProtocol.Rejected])
        assert(snapshots(dir) == cold, "forged recovery created effects")
        val job = app.workflow.job("job")
        eventually(view(job))(_.batches.exists(_.phase == "Blocked"))
        val result = await(app.recoverRuns(m, "operator"))
        assert(!result.isInstanceOf[BatchProtocol.Rejected], "original recovery rejected: " + result)
        eventually(await(app.managedCheckRunHost.query(runId, input)))(_.exists(_.nonEmpty))
        assert(!await(app.resumeRuns(m, "operator")).isInstanceOf[BatchProtocol.Rejected])
        val end = eventually(view(job))(_.phase == "Drained")
        assert(end.succeeded == 1 && end.failed == 0 && end.active == 0)
      } else require(mode == "read")
      val end = view(app.workflow.job("job"))
      assert(end.phase == "Drained" && end.succeeded == 1 && end.active == 0)
      assert(paths(dir.resolve("external/managed-check")).count(_.toString.endsWith(".receipt")) == 1, "duplicate business effect")
      assert(BinaryCodecs.result.decode(end.items.head.result.toArray.toVector).get.isInstanceOf[SagaResult.Succeeded])
      Console.out.println("TYPED_ACK_RECOVERY_PASS " + mode + " original-run operation receipt conserved"); Console.out.flush()
    } finally { sys.terminate(); await(sys.whenTerminated) }
  }
}
