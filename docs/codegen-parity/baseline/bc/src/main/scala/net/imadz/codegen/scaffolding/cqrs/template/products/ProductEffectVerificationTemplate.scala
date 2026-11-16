package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions

object ProductEffectVerificationTemplate {
  def generate(model: ProductApplicationModel): Vector[ProductSourceModel] = model.effectHosts.filter(h => h.pipeline.ref.id == "allocation-inspection" && h.stepId == "inspect").map { h =>
    val pkg = model.domain.packages(h.pipeline.ref.context)
    val host = NamingConventions.strictSymbol(h.id) + "EffectHost"
    val plan = NamingConventions.strictSymbol(h.pipeline.ref.id) + "Execution"
    val execute = h.technicalPorts.find(_.role == "execute").get.implementation
    val query = h.technicalPorts.find(_.role == "query").get.implementation
    val reconcile = h.technicalPorts.find(_.role == "reconcile").get.implementation
    val request = h.requestType.asInstanceOf[net.imadz.meta.products.NominalType.Named].ref.id
    val result = h.resultType.asInstanceOf[net.imadz.meta.products.NominalType.Named].ref.id
    val operation = h.operationType.asInstanceOf[net.imadz.meta.products.NominalType.Named].ref.id
    val observation = h.observationType.asInstanceOf[net.imadz.meta.products.NominalType.Named].ref.id
    val reconcileType = h.reconcileType.asInstanceOf[net.imadz.meta.products.NominalType.Named].ref.id
    def q(v: String): String = ujson.write(v)
    val text = s"""import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.scaladsl.AskPattern._
import akka.persistence.testkit.{PersistenceTestKitPlugin, PersistenceTestKitSnapshotPlugin}
import akka.persistence.testkit.scaladsl.PersistenceTestKit
import akka.util.Timeout
import com.typesafe.config.ConfigFactory
import $pkg.application._
import $pkg.domain.values._
import $pkg.domain.{AllocationOrderState, AllocationOrderProtocol}
import net.imadz.monarch.persistence.{PersistentMonarch, DurableRunObserver}
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.{Await, ExecutionContext, Future, Promise}
import scala.concurrent.duration._

class GeneratedEffectHostSpec extends AnyFunSuite {
  test("durable effect intent, real actor evidence, authorized same-operation recovery and parent checkpoints") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitSnapshotPlugin.config).withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    implicit val ec: ExecutionContext = kit.system.executionContext
    implicit val scheduler: akka.actor.typed.Scheduler = kit.system.scheduler
    implicit val timeout: Timeout = Timeout(5.seconds)
    val storage = PersistenceTestKit(kit.system)
    val effects = new java.util.concurrent.atomic.AtomicInteger()
    val queries = new java.util.concurrent.atomic.AtomicInteger()
    val authorizations = new java.util.concurrent.atomic.AtomicInteger()
    val allocation = kit.spawn($pkg.domain.AllocationOrderAggregate("effect-real-allocation", AllocationOrderState.empty, new $pkg.domain.AllocationOrderComputations {}, new $pkg.domain.AllocationOrderAggregate.ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = false }))
    val receipts = scala.collection.concurrent.TrieMap.empty[String, $observation]
    @volatile var mode = "normal"
    val executeGate = Promise[$observation]()
    def confirmed(input: $operation): Future[$observation] = {
      effects.incrementAndGet()
      allocation.ask[$pkg.domain.AllocationOrderAggregate.Reply](reply => $pkg.domain.AllocationOrderAggregate.Execute(AllocationOrderProtocol.PrepareAllocation(TxId(input.operation), input.request.allocation), reply)).map {
        case $pkg.domain.AllocationOrderAggregate.Accepted(events) =>
          assert(events.collect { case e: AllocationOrderProtocol.AllocationPrepared => e.txid } == Vector(TxId(input.operation)))
          val value = $observation(input.operation, input.request, "confirmed", "actual-allocation-event", Some($result(input.request.allocation)))
          receipts.put(input.operation, value); value
        case other => throw new IllegalStateException("actual allocation rejected: " + other)
      }
    }
    def installed(): $host.Installed = $host.install($host.Bindings(
      $host.Implementation[ $operation, $observation ](${q(execute.id)}, ${q(execute.version)}, input => {
        val before = storage.persistedInStorage("effect-host-main")
        if (mode == "main") assert(before.exists(_.isInstanceOf[$host.Intent]), "durable intent precedes external actor call")
        mode match {
          case "lost" => confirmed(input).flatMap(_ => Future.failed(new IllegalStateException("reply lost after effect")))
          case "absent" => Future.successful($observation(input.operation, input.request, "unknown", "", None))
          case "wait" => effects.incrementAndGet(); executeGate.future
          case "wrong" => Future.successful($observation("wrong-operation", input.request, "confirmed", "fake", Some($result(input.request.allocation))))
          case _ => confirmed(input)
        }
      }),
      $host.Implementation[ $operation, Option[$observation] ](${q(query.id)}, ${q(query.version)}, input => {
        queries.incrementAndGet()
        if (mode == "absent") Future.successful(Some($observation(input.operation, input.request, "absent", "authoritative-no-effect", None)))
        else Future.successful(receipts.get(input.operation))
      }),
      $host.Implementation[ $reconcileType, Boolean ](${q(reconcile.id)}, ${q(reconcile.version)}, input => {
        authorizations.incrementAndGet()
        Future.successful(input.authorization == "test-owned-authority" && (input.decision != "retry" || input.evidence.exists(_.status == "absent")))
      })
    ))
    def original(allocation: String, warehouse: String = "source-warehouse") = $plan.State($plan.Inputs(WarehouseId(warehouse), AllocationId(allocation)))
    val reply = kit.createTestProbe[$host.Reply]()
    try {
      mode = "main"
      val firstInput = original("effect-allocation")
      assert($plan.codec.decode($plan.codec.encode(firstInput)) == firstInput)
      val serializer = new $pkg.application.${host}Serializer
      val expectedIntent = $host.Intent(com.google.protobuf.ByteString.copyFrom($plan.codec.encode(firstInput)), $host.operationIdentity(firstInput))
      assert(serializer.fromBinary(serializer.toBinary(expectedIntent), serializer.manifest(expectedIntent)) == expectedIntent)
      val first = kit.spawn($host("effect-host-main", installed()))
      first ! $host.Invoke(firstInput, reply.ref)
      reply.awaitAssert { assert(storage.persistedInStorage("effect-host-main").exists(_.isInstanceOf[$host.Intent]), "durable intent missing before external execution") }
      reply.expectMessage($host.Completed($plan.inspect_Inspected(AllocationId("effect-allocation"))))
      assert(effects.get() == 1)
      reply.awaitAssert { assert(storage.persistedInStorage("effect-host-main").exists(_.isInstanceOf[$host.ObservationStored])) }
      first ! $host.Invoke(firstInput, reply.ref); reply.expectMessage($host.Completed($plan.inspect_Inspected(AllocationId("effect-allocation"))))
      assert(effects.get() == 1)
      first ! $host.Invoke(original("effect-allocation", "different-source"), reply.ref); assert(reply.receiveMessage().isInstanceOf[$host.Conflict])
      kit.stop(first)
      val recovered = kit.spawn($host("effect-host-main", installed()))
      recovered ! $host.Invoke(firstInput, reply.ref); reply.expectMessage($host.Completed($plan.inspect_Inspected(AllocationId("effect-allocation"))))
      assert(effects.get() == 1)

      mode = "lost"
      val lost = kit.spawn($host("effect-host-lost", installed()))
      lost ! $host.Invoke(original("lost-allocation"), reply.ref)
      reply.expectMessage($host.Completed($plan.inspect_Inspected(AllocationId("lost-allocation"))))
      assert(effects.get() == 2 && queries.get() >= 1)

      mode = "absent"
      val absentInput = original("retry-allocation")
      val absent = kit.spawn($host("effect-host-absent", installed()))
      absent ! $host.Invoke(absentInput, reply.ref); assert(reply.receiveMessage().isInstanceOf[$host.Pending])
      assert(effects.get() == 2)
      absent ! $host.Reconcile(absentInput, "retry", "wrong-authority", reply.ref); assert(reply.receiveMessage().isInstanceOf[$host.Pending])
      assert(effects.get() == 2)
      val oldOperation = $host.operationIdentity(absentInput)
      mode = "normal"
      absent ! $host.Reconcile(absentInput, "retry", "test-owned-authority", reply.ref)
      reply.expectMessage($host.Completed($plan.inspect_Inspected(AllocationId("retry-allocation"))))
      assert(effects.get() == 3)
      assert($host.operationIdentity(absentInput) == oldOperation)
      assert(storage.persistedInStorage("effect-host-absent").exists(_.isInstanceOf[$host.RetryAuthorized]))

      mode = "wrong"
      val wrong = kit.spawn($host("effect-host-wrong", installed()))
      wrong ! $host.Invoke(original("wrong-allocation"), reply.ref); assert(reply.receiveMessage().isInstanceOf[$host.Pending])
      assert(effects.get() == 3)
      wrong ! $host.Reconcile(original("wrong-allocation"), "retry", "test-owned-authority", reply.ref); assert(reply.receiveMessage().isInstanceOf[$host.Pending])
      assert(effects.get() == 3)

      mode = "wait"
      val old = kit.spawn($host("effect-host-generation", installed()))
      val generationInput = original("generation-allocation")
      old ! $host.Invoke(generationInput, reply.ref)
      reply.awaitAssert { assert(effects.get() == 4) }
      kit.stop(old)
      mode = "normal"
      val replacement = kit.spawn($host("effect-host-generation", installed()))
      replacement ! $host.Invoke(generationInput, reply.ref); assert(reply.receiveMessage().isInstanceOf[$host.Pending])
      executeGate.success($observation($host.operationIdentity(generationInput), $host.request(generationInput), "confirmed", "old-callback", Some($result(generationInput.inputs.allocation))))
      replacement ! $host.Invoke(generationInput, reply.ref); assert(reply.receiveMessage().isInstanceOf[$host.Pending])
      assert(!storage.persistedInStorage("effect-host-generation").collect { case $host.ObservationStored(bytes) => bytes }.exists(_.toStringUtf8.contains("old-callback")))

      val parentInput = original("parent-allocation")
      val child = kit.spawn($host("effect-host-parent", installed()))
      val pure = new $plan.PureStages { def verify(request: $plan.verifyRequest): Future[$plan.verifyResult] = Future.successful($plan.verify_Verified(request.allocation)) }
      val committed = kit.createTestProbe[String]()
      val observer = new DurableRunObserver[$plan.State] {
        override def onCheckpointCommitted(cursor: String, metadata: Map[String, String], state: $plan.State): Unit = committed.ref ! cursor
      }
      val parent = kit.spawn($plan.behavior("effect-parent-journal", $plan.install(pure, child), observer))
      val accepted = kit.createTestProbe[PersistentMonarch.RunReply]()
      parent ! PersistentMonarch.StartRun[$plan.State]("effect-parent-run", parentInput, accepted.ref)
      accepted.expectMessage(PersistentMonarch.Accepted("effect-parent-run"))
      committed.expectMessage("inspect#0"); committed.expectMessage("verify#1")
      reply.awaitAssert {
        val events = storage.persistedInStorage("effect-parent-journal")
        assert(events.collect { case s: PersistentMonarch.StageDone => s.cursor } == Seq("inspect#0", "verify#1"))
        assert(events.count(_.isInstanceOf[PersistentMonarch.RunCompleted]) == 1)
        assert($plan.outputs($plan.codec.decode(events.collect { case s: PersistentMonarch.StageDone => s.snapshot }.last)).allocation == AllocationId("parent-allocation"))
      }
      val allocationState = Await.result(allocation.ask[AllocationOrderState]($pkg.domain.AllocationOrderAggregate.GetState), 5.seconds)
      assert(allocationState.status == "prepared")
      val actualEvents = storage.persistedInStorage("effect-real-allocation").collect { case e: $pkg.infrastructure.proto.AllocationOrderAllocationPreparedPB => $pkg.infrastructure.serialization.DomainConverters.decodeAllocationOrderAllocationPreparedPB(e) }
      assert(actualEvents.size == 4 && actualEvents.map(_.txid).distinct.size == 4, "four real confirmed effect identities, not an observer mirror")
      assert(authorizations.get() == 2)
      val good = installed()
      intercept[IllegalArgumentException]($host.install(null))
      assert(good != null)
    } finally kit.shutdownTestKit()
  }
}
"""
    ProductSourceModel("src/test/scala/GeneratedEffectHostSpec.scala", text, "generated-test", Vector(h.source) ++ h.provenance, model.footprint)
  }
}
