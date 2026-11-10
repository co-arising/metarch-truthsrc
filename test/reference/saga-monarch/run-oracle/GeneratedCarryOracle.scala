package reference.inventory.runoracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.AskPattern._
import akka.util.{ByteString, Timeout}
import net.imadz.monarch.persistence.batch._
import net.imadz.monarch.persistence.resource.{ResourceProtocol => Resource}
import org.scalatest.funsuite.AnyFunSuite
import reference.inventory.glue._
import reference.inventory.kernel._
import reference.inventory.oracle.R2Support
import reference.inventory.root.InventoryApplication
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._

class GeneratedCarryOracle extends AnyFunSuite {
  import R2Support._
  private val auth = new RecoveryAuthorization { def authorize(id: SagaIdentity, token: String): Either[String, String] = Right("test") }
  private def request(id: String) = ReservationRequest(RequestId(id), Warehouse("a"), Warehouse("b"), Sku("sku"), Quantity(2))
  test("GENERATED-CARRY: two original holders travel together through retained query-only area and final release") {
    fixture("carry") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      implicit val timeout: Timeout = Timeout(3.seconds)
      val app = InventoryApplication.fromExternal(sys, "carry", dir.resolve("external"), Warehouse("a"), Warehouse("b"), auth)
      val job = app.workflow.job("job")
      (0 until 2).foreach { n =>
        assert(ask(job, BatchProtocol.Offer(n, "item-" + n, ByteString(BinaryCodecs.request.encode(request("request-" + n)).toArray), "reserve", "same", _)).isInstanceOf[BatchProtocol.Accepted])
      }
      ask(job, BatchProtocol.CloseInput(_))
      val end = eventually(view(job))(_.phase == "Drained")
      assert(end.succeeded == 2 && end.active == 0 && end.held == 0 && end.failed == 0)
      val ms = manifests(dir, "carry/workflow|job|job")
      assert(ms.size == 3 && ms.map(_.area) == Vector("reserve", "inspect", "publish-result"))
      assert(ms.forall(_.items.map(_.itemId) == Vector("item-0", "item-1")))
      assert(ms(1).items.forall(_.carried.nonEmpty) && ms(2).items.forall(_.carried.nonEmpty))
      assert(ms(1).items.flatMap(_.carried).toSet == ms(2).items.flatMap(_.carried).toSet)
      val claim = ms(2).items.head.carried.head
      assert(await(app.workflow.resourceDomain.ask[Resource.Reply](Resource.Query(claim.reservationId, _))).isInstanceOf[Resource.Released])
      val journal = paths(dir.resolve("journal"))
      val before = snapshots(dir.resolve("external"))
      val queryArea = app.program.connector("inspect")
      val queryRequest = app.program.operation(ms(1))
      assert(await(queryArea.query(queryRequest, None)).isInstanceOf[net.imadz.monarch.persistence.operation.OperationProtocol.Confirmed])
      assert(snapshots(dir.resolve("external")) == before, "query-only area created effects")
    }
  }
  test("GENERATED-HARD-MIN: incompatible singleton tails do not combine or bypass minimum on EOF") {
    fixture("hard-min") { (dir, sys) =>
      implicit val system: ActorSystem[_] = sys; implicit val ec: ExecutionContext = sys.executionContext
      val app = InventoryApplication.fromExternal(sys, "hard-min", dir.resolve("external"), Warehouse("a"), Warehouse("b"), auth)
      val job = app.workflow.job("job")
      Vector("red", "blue").zipWithIndex.foreach { case (key, n) =>
        ask(job, BatchProtocol.Offer(n, "item-" + n, ByteString(BinaryCodecs.request.encode(request("request-" + n)).toArray), "reserve", key, _))
      }
      ask(job, BatchProtocol.CloseInput(_))
      Thread.sleep(250)
      val blocked = eventually(view(job))(_.phase == "ClosingBlocked")
      assert(blocked.active == 2 && blocked.succeeded == 0)
      assert(manifests(dir, "hard-min/workflow|job|job").isEmpty)
      assert(paths(dir.resolve("external")).isEmpty, "hard minimum started business leaves")
    }
  }
}
