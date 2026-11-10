package reference.inventory.runoracle

import akka.actor.typed.ActorSystem
import org.scalatest.funsuite.AnyFunSuite
import reference.inventory.glue.PureReviewRun
import reference.inventory.kernel._
import reference.inventory.kernel.PureReviewRunProtocol.{Input, Review, Summarize}
import reference.inventory.oracle.R2Support
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._

/** Independent ordered dataflow checks through the generated Run and fixed R2 actor. */
class PureRunOracle extends AnyFunSuite {
  import R2Support._
  private val original = ReservationRequest(RequestId("pure"), Warehouse("a"), Warehouse("b"), Sku("sku"), Quantity(2))
  private val input = Input(original, TransactionId("pure-transaction"))
  private def completed(host: PureReviewRun.Host, id: String) =
    eventually(await(host.query(id, input)))(_.exists(_.nonEmpty)).toOption.flatten.get
  test("PURE-DATAFLOW: later reads consume earlier committed writes and outputs reflect authored references") {
    fixture("pure-flow") { (_, system) =>
      implicit val ec: ExecutionContext = system.executionContext
      val reviewCalls = new java.util.concurrent.atomic.AtomicInteger
      val summarizeCalls = new java.util.concurrent.atomic.AtomicInteger
      val review = new Review.Leaf {
        def apply(args: Review.Args): Future[Review.Outcome] = {
          reviewCalls.incrementAndGet(); assert(args.request == original)
          Future.successful(Review.Outcome.Done(Review.Values(args.request.copy(quantity = Quantity(7)))))
        }
      }
      val summarize = new Summarize.Leaf {
        def apply(args: Summarize.Args): Future[Summarize.Outcome] = {
          summarizeCalls.incrementAndGet(); assert(args.request.quantity == Quantity(7)); assert(args.transactionId == input.transactionId)
          Future.successful(Summarize.Outcome.Done(Summarize.Values(ReservationResult(args.transactionId, args.request))))
        }
      }
      val host = new PureReviewRun.Host(system, "pure-flow", PureReviewRun.Leaves(review, summarize))
      await(host.ensure("one", input))
      val result = completed(host, "one").asInstanceOf[PureReviewRun.Completed]
      assert(result.output.result.originalRequest.quantity == Quantity(7))
      assert(result.state.input == input && result.state.writeReviewChecked.get.quantity == Quantity(7))
      assert(result.state.writeSummarizeResult.contains(result.output.result))
      await(host.ensure("one", input)); completed(host, "one")
      assert(reviewCalls.get == 1 && summarizeCalls.get == 1)
    }
  }
  test("PURE-STOP: rejection stops business calls and preserves only its confirmed prefix") {
    fixture("pure-stop") { (_, system) =>
      implicit val ec: ExecutionContext = system.executionContext
      val calls = new java.util.concurrent.atomic.AtomicInteger
      val review = new Review.Leaf { def apply(args: Review.Args): Future[Review.Outcome] = Future.successful(Review.Outcome.Rejected("denied")) }
      val summarize = new Summarize.Leaf {
        def apply(args: Summarize.Args): Future[Summarize.Outcome] = {
          calls.incrementAndGet(); Future.failed(new AssertionError("business continued after stop"))
        }
      }
      val host = new PureReviewRun.Host(system, "pure-stop", PureReviewRun.Leaves(review, summarize))
      await(host.ensure("stopped", input))
      val result = completed(host, "stopped").asInstanceOf[PureReviewRun.Stopped]
      assert(result.stepId == "review" && result.code == "Rejected" && result.reason == "denied")
      assert(result.state.writeReviewChecked.isEmpty && result.state.writeSummarizeResult.isEmpty && calls.get == 0)
    }
  }
  test("PURE-FAILURE: infrastructure failure never creates successful outputs") {
    fixture("pure-failure") { (_, system) =>
      implicit val ec: ExecutionContext = system.executionContext
      val review = new Review.Leaf { def apply(args: Review.Args): Future[Review.Outcome] = Future.successful(Review.Outcome.Failed("unavailable")) }
      val summarize = new Summarize.Leaf { def apply(args: Summarize.Args): Future[Summarize.Outcome] = Future.failed(new AssertionError("called after failure")) }
      val host = new PureReviewRun.Host(system, "pure-failure", PureReviewRun.Leaves(review, summarize))
      await(host.ensure("failed", input))
      assert(eventually(await(host.query("failed", input)))(_.isLeft).isLeft)
    }
  }
  test("PURE-STATE: codec rejects a future write without its earlier committed dependency") {
    val state = PureReviewRun.initial("state", input)
    val invalid = state.copy(writeSummarizeResult = Some(ReservationResult(input.transactionId, original)))
    assert(scala.util.Try(BinaryCodecs.PureReviewRun.state.encode(invalid)).isFailure)
    val bytes = BinaryCodecs.PureReviewRun.state.encode(state)
    assert(BinaryCodecs.PureReviewRun.state.decode(bytes).get == state)
  }
}
