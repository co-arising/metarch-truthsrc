package reference.inventory.runoracle

import akka.actor.typed.ActorSystem
import akka.util.ByteString
import java.io.{ByteArrayInputStream, DataInputStream}
import java.nio.file.{Files, Path}
import net.imadz.monarch.persistence.batch._
import org.scalatest.funsuite.AnyFunSuite
import reference.inventory.glue._
import reference.inventory.kernel._
import reference.inventory.oracle.R2Support
import reference.inventory.root.InventoryApplication
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._

/** Exercises the generated inner Run and outer R2 policy, not PolicyProgram. */
class GeneratedRetryOracle extends AnyFunSuite {
  import R2Support._
  private val authorization = new RecoveryAuthorization {
    def authorize(id: SagaIdentity, token: String): Either[String, String] =
      if (token == "operator") Right("operator") else Left("denied")
  }
  private def request(id: String) = ReservationRequest(RequestId(id), Warehouse("a"), Warehouse("b"), Sku("sku"), Quantity(2))
  private def records(dir: Path): Vector[(ManagedCheckRunProtocol.State, ManagedCheckRunProtocol.Check.TerminalOutcome)] =
    paths(dir.resolve("external/managed-check")).filter(_.toString.endsWith(".receipt")).map { file =>
      val input = new DataInputStream(new ByteArrayInputStream(Files.readAllBytes(file)))
      def bytes(): Vector[Byte] = { val size = input.readInt(); require(size > 0 && size <= input.available()); val b = new Array[Byte](size); input.readFully(b); b.toVector }
      val state = BinaryCodecs.ManagedCheckRun.request.decode(bytes()).get
      val result = BinaryCodecs.ManagedCheckRun.outcome.decode(bytes()).get
      require(input.available() == 0); state -> result
    }
  test("GENERATED-SUBSET-RETRY: only a confirmed no-effects item reexecutes with original payload and new identity") {
    fixture("generated-subset") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val app = InventoryApplication.fromExternal(sys, "generated-subset", dir.resolve("external"), Warehouse("a"), Warehouse("b"), authorization)
      val job = app.workflow.job("job")
      Vector("success", "retry").zipWithIndex.foreach { case (id, sequence) =>
        assert(ask(job, BatchProtocol.Offer(sequence, id, ByteString.fromArray(BinaryCodecs.request.encode(request(id)).toArray), "reserve", "same", _)).isInstanceOf[BatchProtocol.Accepted])
      }
      ask(job, BatchProtocol.CloseInput(_))
      val end = eventually(view(job))(_.phase == "Drained")
      assert(end.accepted == 2 && end.succeeded == 2 && end.failed == 0 && end.held == 0 && end.active == 0)
      val saved = records(dir)
      assert(saved.count(_._1.input.request.requestId.value == "success") == 1, "successful item executed twice")
      val retry = saved.filter(_._1.input.request.requestId.value == "retry")
      assert(retry.size == 2 && retry.map(_._1.runId).distinct.size == 2)
      assert(retry.map(_._1.input).distinct.size == 1)
      assert(retry.count(_._2.isInstanceOf[ManagedCheckRunProtocol.Check.BusinessRejection]) == 1)
      assert(retry.count(_._2.isInstanceOf[ManagedCheckRunProtocol.Check.Continuing]) == 1)
      val sealedBatches = manifests(dir, "generated-subset/workflow|job|job")
      assert(sealedBatches.exists(_.items.map(_.itemId).toSet == Set("success", "retry")), "subset assertion needs an original mixed manifest")
      assert(sealedBatches.count(_.items.map(_.itemId) == Vector("retry")) == 1)
      val first = sealedBatches.find(_.items.exists(_.itemId == "success")).get
      val next = sealedBatches.find(_.items.map(_.itemId) == Vector("retry")).get
      assert(next.sealedAt >= first.sealedAt + 6000L, "retry ignored authored delay")
      end.items.foreach { item =>
        val result = BinaryCodecs.result.decode(item.result.toArray.toVector).get
        assert(result.isInstanceOf[SagaResult.Succeeded])
        assert(result.payload.originalRequest == request(item.itemId))
      }
    }
  }
  test("GENERATED-RETRY-BUDGET: a repeated no-effects rejection exhausts the finite budget without being success") {
    fixture("generated-budget") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val app = InventoryApplication.fromExternal(sys, "generated-budget", dir.resolve("external"), Warehouse("a"), Warehouse("b"), authorization)
      val job = app.workflow.job("job")
      ask(job, BatchProtocol.Offer(0, "always-reject", ByteString.fromArray(BinaryCodecs.request.encode(request("always-reject")).toArray), "reserve", "same", _))
      ask(job, BatchProtocol.CloseInput(_))
      val end = eventually(view(job))(_.phase == "Drained")
      assert(end.accepted == 1 && end.succeeded == 0 && end.failed == 1 && end.active == 0)
      assert(records(dir).size == 2)
      assert(end.items.head.executions("reserve") == 2)
    }
  }
}
