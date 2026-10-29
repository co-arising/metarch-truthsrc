import { entry, key, packageFor, symbol } from '../scala-cqrs-domain/naming.mjs';
/** Test-only existing inventory inspection oracle. Journal rows, not observer mirrors, certify checkpoints. */
export function renderExecutionVerification({products,options},footprint) {
  const result=[];
  for(const p of products['execution-contract'].pipelines){
    if(p.id!=='allocation-inspection')continue;
    const d=products['reference-layout'].declarations.find(d=>d.ref.kind==='pipeline'&&d.ref.id===p.id),pkg=packageFor(d.ref.context,options),plan=pkg+'.application.'+symbol(p.id.replaceAll('-','_'))+'Execution';
    const text=`import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.testkit.PersistenceTestKitPlugin
import akka.persistence.testkit.scaladsl.PersistenceTestKit
import com.typesafe.config.ConfigFactory
import net.imadz.monarch.persistence.{PersistentMonarch, DurableRunObserver}
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._
import ${pkg}.domain.values._

final class GeneratedExecutionSpec extends AnyFunSuite {
  test("typed finite plan persists a confirmed prefix and resumes only its tail") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    implicit val ec: ExecutionContext = kit.system.executionContext
    val journal = PersistenceTestKit(kit.system)
    val inspectCalls = new java.util.concurrent.atomic.AtomicInteger(0)
    val verifyCalls = new java.util.concurrent.atomic.AtomicInteger(0)
    val gate = Promise[Unit]()
    val committed = kit.createTestProbe[String]()
    val observer = new DurableRunObserver[${plan}.State] {
      override def onCheckpointCommitted(cursor: String, metadata: Map[String, String], state: ${plan}.State): Unit = committed.ref ! cursor
    }
    val stages = new ${plan}.Stages {
      def inspect(request: ${plan}.inspectRequest): Future[${plan}.inspectResult] = { inspectCalls.incrementAndGet(); assert(request.warehouse == WarehouseId("warehouse-A")); Future.successful(${plan}.inspect_Inspected(request.allocation)) }
      def verify(request: ${plan}.verifyRequest): Future[${plan}.verifyResult] = { verifyCalls.incrementAndGet(); gate.future.map(_ => ${plan}.verify_Verified(request.allocation)) }
    }
    try {
      val initial = ${plan}.State(${plan}.Inputs(WarehouseId("warehouse-A"), AllocationId("allocation-last")))
      assert(${plan}.codec.decode(${plan}.codec.encode(initial)) == initial)
      intercept[IllegalArgumentException] { ${plan}.codec.decode(Array.emptyByteArray) }
      intercept[IllegalArgumentException] { ${plan}.outputs(initial) }
      var actor = kit.spawn(${plan}.behavior("owned-inspection", stages, observer))
      val reply = kit.createTestProbe[PersistentMonarch.RunReply]()
      actor ! PersistentMonarch.StartRun("owned-inspection-run", initial, reply.ref)
      reply.expectMessage(PersistentMonarch.Accepted("owned-inspection-run"))
      committed.expectMessage("inspect#0")
      reply.awaitAssert { assert(verifyCalls.get() == 1) }
      val prefix = journal.persistedInStorage("owned-inspection")
      assert(prefix.count(_.isInstanceOf[PersistentMonarch.StageDone]) == 1)
      kit.stop(actor)
      actor = kit.spawn(${plan}.behavior("owned-inspection", stages, observer))
      reply.awaitAssert { assert(verifyCalls.get() == 2) }
      assert(inspectCalls.get() == 1)
      gate.success(())
      committed.expectMessage("verify#1")
      reply.awaitAssert {
        val rows = journal.persistedInStorage("owned-inspection")
        assert(rows.count(_.isInstanceOf[PersistentMonarch.RunCompleted]) == 1)
        val checkpoints = rows.collect { case s: PersistentMonarch.StageDone => s }
        assert(checkpoints.map(_.cursor) == Seq("inspect#0", "verify#1"))
        val recovered = ${plan}.codec.decode(checkpoints.last.snapshot)
        assert(recovered.verify_allocation.contains(AllocationId("allocation-last")))
        assert(${plan}.outputs(recovered).allocation == AllocationId("allocation-last"))
      }
      actor ! PersistentMonarch.StartRun("owned-inspection-run", initial, reply.ref)
      reply.expectMessageType[PersistentMonarch.Rejected]
      assert(inspectCalls.get() == 1 && verifyCalls.get() == 2)
      val failedStages = new ${plan}.Stages {
        def inspect(request: ${plan}.inspectRequest): Future[${plan}.inspectResult] = Future.successful(${plan}.inspect_Unavailable)
        def verify(request: ${plan}.verifyRequest): Future[${plan}.verifyResult] = Future.failed(new IllegalStateException("must not invoke tail after failure"))
      }
      val failed = kit.spawn(${plan}.behavior("owned-inspection-failed", failedStages, observer))
      failed ! PersistentMonarch.StartRun("failed-run", initial, reply.ref)
      reply.expectMessage(PersistentMonarch.Accepted("failed-run"))
      reply.awaitAssert { assert(journal.persistedInStorage("owned-inspection-failed").exists { case e: PersistentMonarch.RunFailedEvt => e.reason.contains("infrastructure-failure:Unavailable:manual-recovery"); case _ => false }) }
      assert(!journal.persistedInStorage("owned-inspection-failed").exists(_.isInstanceOf[PersistentMonarch.StageDone]))
    } finally kit.shutdownTestKit()
  }
}
`;
    result.push(entry('src/test/scala/GeneratedExecutionSpec.scala',text,'generated-test',[d.source],footprint));
  }
  return result;
}
