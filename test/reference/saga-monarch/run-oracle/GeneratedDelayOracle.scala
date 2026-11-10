package reference.inventory.runoracle

import akka.actor.typed.ActorSystem
import akka.util.ByteString
import java.nio.file.{Files, Paths}
import net.imadz.monarch.persistence.SerializedValidationJournal
import net.imadz.monarch.persistence.batch._
import reference.inventory.glue._
import reference.inventory.kernel._
import reference.inventory.oracle.R2Support
import reference.inventory.root.InventoryApplication
import scala.concurrent.ExecutionContext

/** Freeze after first retry settlement, then prove original dueAt and final exhaustion in fresh JVMs. */
object GeneratedDelayOracle {
  import R2Support._
  private val request = ReservationRequest(RequestId("always-reject"), Warehouse("a"), Warehouse("b"), Sku("sku"), Quantity(2))
  private val authorization = new RecoveryAuthorization { def authorize(id: SagaIdentity, token: String): Either[String, String] = Right("explicit-test") }
  def main(args: Array[String]): Unit = {
    require(args.length == 2); val Array(mode, directory) = args; val dir = Paths.get(directory)
    val sys = system(dir, "generated-delay-" + mode)
    implicit val active: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
    try {
      val pid = "generated-delay/workflow|job|job"
      if (mode == "fault") SerializedValidationJournal.forceMarkers.put(pid, label => if (label.endsWith(" Settled")) {
        val settled = events(dir, pid).find(eventName(_) == "Settled").get
        val record = field(settled, "records").asInstanceOf[Vector[Any]].head
        val dueAt = field(record, "dueAt").asInstanceOf[Long]
        forced(dir.resolve("due-at.record"), dueAt.toString.getBytes("UTF-8"))
        Console.out.println("EXPECTED_GENERATED_DELAY code=79"); Console.out.flush(); Runtime.getRuntime.halt(79)
      })
      val app = InventoryApplication.fromExternal(sys, "generated-delay", dir.resolve("external"), Warehouse("a"), Warehouse("b"), authorization)
      val job = app.workflow.job("job")
      if (mode == "fault") {
        ask(job, BatchProtocol.Offer(0, "always-reject", ByteString(BinaryCodecs.request.encode(request).toArray), "reserve", "same", _))
        ask(job, BatchProtocol.CloseInput(_)); Thread.sleep(20000); throw new AssertionError("DELAY_FAULT_NOT_REACHED")
      }
      val dueAt = new String(Files.readAllBytes(dir.resolve("due-at.record")), "UTF-8").toLong
      if (mode == "recover") {
        assert(System.currentTimeMillis() < dueAt, "missed original retry delay observation window")
        val before = snapshots(dir.resolve("external"))
        while (System.currentTimeMillis() + 75 < dueAt) {
          assert(manifests(dir, pid).size == 1, "retry started before persisted dueAt")
          assert(snapshots(dir.resolve("external")) == before, "early repeated external effect")
          Thread.sleep(40)
        }
        val end = eventually(view(job))(_.phase == "Drained")
        assert(end.accepted == 1 && end.failed == 1 && end.succeeded == 0 && end.active == 0)
      } else require(mode == "read")
      val end = view(job)
      val ms = manifests(dir, pid)
      assert(end.phase == "Drained" && end.failed == 1 && end.succeeded == 0 && end.active == 0)
      assert(end.items.head.executions("reserve") == 2)
      assert(end.items.head.reason.contains("finite item retry budget exhausted"))
      assert(ms.size == 2 && ms(1).sealedAt >= dueAt && ms(1).items.head.execution == 1 && ms(1).items.head.lineage.size == 1)
      assert(paths(dir.resolve("external/managed-check")).count(_.toString.endsWith(".receipt")) == 2)
      Console.out.println("GENERATED_DELAY_PASS " + mode + " original-dueAt budget terminal-failed"); Console.out.flush()
    } finally { sys.terminate(); await(sys.whenTerminated) }
  }
}
