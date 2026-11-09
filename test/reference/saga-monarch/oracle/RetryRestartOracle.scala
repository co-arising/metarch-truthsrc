package reference.inventory.oracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import java.nio.file.{Files, Paths}
import net.imadz.monarch.persistence.SerializedValidationJournal
import net.imadz.monarch.persistence.batch._
import net.imadz.monarch.persistence.workflow._
import scala.concurrent.ExecutionContext

object RetryRestartOracle {
  import R2Support._
  def main(args: Array[String]): Unit = {
    require(args.length == 2); val Array(mode, root) = args; val dir = Paths.get(root)
    val system = R2Support.system(dir, "retry-" + mode)
    implicit val sys: ActorSystem[_] = system; implicit val ec: ExecutionContext = system.executionContext
    try {
      val d = BatchDefinition("retry-clock", "1", Vector(area(maxExecutions = 2)), settings)
      val p = new PolicyProgram(d, dir.resolve("external"), m => released(m, _ => ItemDisposition.Retry(6000)))
      val pid = "retry|job|job"
      if (mode == "fault") {
        SerializedValidationJournal.forceMarkers.put(pid, label => if (label.endsWith(" Settled")) {
          val record = field(events(dir, pid).find(eventName(_) == "Settled").get, "records").asInstanceOf[Vector[Any]].head
          val dueAt = field(record, "dueAt").asInstanceOf[Long]
          forced(dir.resolve("retry-clock.record"), dueAt.toString.getBytes("UTF-8"))
          Console.out.println("EXPECTED_RETRY_FORCE_BEFORE_ACK code=77"); Console.out.flush(); Runtime.getRuntime.halt(77)
        })
      }
      val job = new WorkflowHost(system, "retry", p).job("job")
      if (mode == "fault") {
        offer(job, 0); ask(job, BatchProtocol.CloseInput(_)); Thread.sleep(15000); throw new AssertionError("RETRY_FAULT_NOT_REACHED")
      }
      val dueAt = new String(Files.readAllBytes(dir.resolve("retry-clock.record")), "UTF-8").toLong
      if (mode == "recover") {
        val v = view(job); assert(v.items.head.executions == Map("work" -> 1) && v.accepted == 1 && v.inputClosed)
        assert(System.currentTimeMillis() < dueAt, "restart missed nonzero delay observation window")
        val before = snapshots(dir.resolve("external"))
        while (System.currentTimeMillis() + 60 < dueAt) { assert(manifests(dir, pid).size == 1, "retry executed before durable dueAt"); Thread.sleep(40) }
        assert(snapshots(dir.resolve("external")) == before, "delay caused a repeated business effect")
        val blocked = eventually(view(job))(_.batches.exists(b => b.phase == "Blocked" && b.reason.exists(_.contains("budget"))))
        assert(blocked.active == 1 && blocked.succeeded == 0 && blocked.failed == 0)
      } else require(mode == "read")
      val end = view(job); val ms = manifests(dir, pid)
      assert(end.phase == "ClosingBlocked" && end.active == 1 && end.batches.size == 1, "exhausted retry falsely drained")
      assert(ms.size == 2 && ms(1).sealedAt >= dueAt && ms(1).items.head.execution == 1 && ms(1).items.head.lineage.size == 1,
        "durable delay or execution budget reset on restart")
      assert(events(dir, pid).count(eventName(_) == "Settled") == 1, "invalid exhausted attempt settled")
      assert(paths(dir.resolve("external")).count(_.toString.endsWith(".receipt")) == 2, "successful first attempt was resubmitted")
      Console.out.println("RETRY_RESTART_PASS " + mode + " durable-dueAt original-item execution-budget-retained"); Console.out.flush()
    } finally { system.terminate(); await(system.whenTerminated) }
  }
}
