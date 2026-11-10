package reference.inventory.runoracle

import akka.actor.typed.ActorSystem
import akka.util.ByteString
import java.nio.file.{Files, Path}
import org.scalatest.funsuite.AnyFunSuite
import reference.inventory.ext.ManagedCheck
import reference.inventory.glue.{InventorySaga, ManagedCheckRun}
import reference.inventory.kernel._
import reference.inventory.kernel.ManagedCheckRunProtocol.{Check, Input}
import reference.inventory.oracle.R2Support
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.Try

/** Independent expectations for generated typed Run semantics, not a renderer-made golden. */
class TypedRunOracle extends AnyFunSuite {
  import R2Support._
  private def request(id: String) = ReservationRequest(RequestId(id), Warehouse("a"), Warehouse("b"), Sku("sku"), Quantity(3))
  private def original(id: String): Input = {
    val value = request(id)
    Input(value, InventorySaga.expected(ItemIdentity("typed-job", 0L, id), value).saga.transactionId)
  }
  private def runFixture(label: String)(body: (Path, ActorSystem[Nothing], ManagedCheckRun.Host) => Unit): Unit = fixture(label) { (dir, system) =>
    implicit val ec: ExecutionContext = system.executionContext
    val leaf = new ManagedCheck(dir.resolve("external"))
    val host = new ManagedCheckRun.Host(system, label, ManagedCheckRun.Leaves(leaf), 8, 1.second)
    body(dir, system, host)
  }
  private def terminal(host: ManagedCheckRun.Host, id: String, input: Input): ManagedCheckRun.Completion =
    eventually(await(host.query(id, input)))(_.exists(_.nonEmpty)).toOption.flatten.get
  private def receipts(dir: Path): Vector[Path] = paths(dir.resolve("external/managed-check")).filter(_.toString.endsWith(".receipt"))

  test("TYPED-COLD-QUERY: an absent host query creates no Run journal or external execution") {
    runFixture("cold-query") { (dir, _, host) =>
      val before = snapshots(dir)
      assert(await(host.query("unknown", original("cold"))).isLeft)
      Thread.sleep(100)
      assert(snapshots(dir) == before, "cold query started recovery/execution")
    }
  }
  test("TYPED-MANAGED: explicit reads produce typed writes and repeated identity never repeats effects") {
    runFixture("managed-success") { (dir, _, host) =>
      val input = original("success")
      await(host.ensure("run-success", input))
      val done = terminal(host, "run-success", input).asInstanceOf[ManagedCheckRun.Completed]
      assert(done.output.result == ReservationResult(input.transactionId, input.request))
      assert(done.state.input == input && done.state.runId == "run-success")
      val before = receipts(dir).map(p => p -> BinaryCodecs.digest(Files.readAllBytes(p).toVector))
      assert(before.size == 1)
      await(host.ensure("run-success", input)); terminal(host, "run-success", input)
      assert(receipts(dir).map(p => p -> BinaryCodecs.digest(Files.readAllBytes(p).toVector)) == before)
      assert(Try(await(host.ensure("run-success", input.copy(request = request("other"))))).isFailure)
      assert(receipts(dir).size == 1)
    }
  }
  test("TYPED-STOP: known business rejection completes as stopped with no fabricated output") {
    runFixture("managed-rejected") { (dir, _, host) =>
      val input = original("always-reject")
      await(host.ensure("run-rejected", input))
      val stopped = terminal(host, "run-rejected", input).asInstanceOf[ManagedCheckRun.Stopped]
      assert(stopped.code == "Rejected" && stopped.stepId == "execute")
      assert(stopped.state.input == input && stopped.state.writeExecuteResult.isEmpty)
      assert(receipts(dir).size == 1)
    }
  }
  test("TYPED-IDENTITY: new Run after confirmed no-effects rejection has a new operation and effect identity") {
    val input = original("retry")
    val a = ManagedCheckRun.operation(ManagedCheckRun.initial("first", input))
    val b = ManagedCheckRun.operation(ManagedCheckRun.initial("second", input))
    assert(a.operationKey != b.operationKey && a.effectKey != b.effectKey)
    assert(a == ManagedCheckRun.operation(ManagedCheckRun.initial("first", input)))
    assert(BinaryCodecs.ManagedCheckRun.request.decode(a.payload.toVector).get.input == input)
  }
  test("TYPED-CODEC: state and request codecs reject altered versions and trailing bytes") {
    val state = ManagedCheckRun.initial("codec", original("codec"))
    val bytes = BinaryCodecs.ManagedCheckRun.state.encode(state)
    assert(BinaryCodecs.ManagedCheckRun.state.decode(bytes).get == state)
    assert(BinaryCodecs.ManagedCheckRun.state.decode(bytes :+ 0.toByte).isFailure)
    val needle = "managed-codec-v1".getBytes("UTF-8").toVector
    val index = bytes.sliding(needle.size).indexWhere(_ == needle)
    assert(index >= 0)
    assert(BinaryCodecs.ManagedCheckRun.state.decode(bytes.updated(index, 'x'.toByte)).isFailure)
  }
  test("TYPED-EVIDENCE: caller-forged terminal bytes and operation pins cannot bypass generated validation") {
    fixture("evidence") { (_, system) =>
      implicit val ec: ExecutionContext = system.executionContext
      val leaf = new Check.Leaf {
        def submit(r: Check.Request): Future[Check.Observation] = Future.successful(Check.Observation.Confirmed(
          Check.Evidence(r, Check.Outcome.Done(Check.Values(ReservationResult(r.args.transactionId, r.args.request))), Vector(1.toByte), Vector(2.toByte))))
        def query(r: Check.Request): Future[Check.Observation] = Future.successful(Check.Observation.NotFound)
        def validateEvidence(r: Check.Request, e: Check.Evidence): Either[String, Unit] = Right(())
      }
      val adapter = new ManagedCheckRun.Adapter(leaf)
      val r = ManagedCheckRun.operation(ManagedCheckRun.initial("evidence", original("evidence")))
      assert(Try(await(adapter.submit(r))).isFailure, "forged leaf bytes accepted")
      assert(Try(await(adapter.submit(r.copy(connectorVersion = "wrong")))).isFailure)
      assert(await(adapter.query(r, None)).isInstanceOf[net.imadz.monarch.persistence.operation.OperationProtocol.Unknown])
    }
  }
}
