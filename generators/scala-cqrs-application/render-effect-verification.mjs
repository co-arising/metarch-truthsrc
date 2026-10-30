import { entry, packageFor, pathFor } from '../scala-cqrs-domain/naming.mjs';

/** Independent inventory oracle: real aggregate journal, effect intent and parent checkpoints. */
export function renderEffectVerification({ products, options }, footprint) {
  return products['effect-host-contract'].hosts.filter(h => h.pipeline.ref.id === 'allocation-inspection' && h.stepId === 'inspect').map(h => {
    const pkg = packageFor(h.pipeline.ref.context, options), host = h.id.replaceAll('-', '_') + 'EffectHost', plan = h.pipeline.ref.id.replaceAll('-', '_') + 'Execution';
    const [execute, query, reconcile] = h.technicalPorts.map(p => p.implementation), quote = JSON.stringify;
    const content = `import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.scaladsl.AskPattern._
import akka.persistence.testkit.{PersistenceTestKitPlugin, PersistenceTestKitSnapshotPlugin}
import akka.persistence.testkit.scaladsl.PersistenceTestKit
import akka.util.Timeout
import com.typesafe.config.ConfigFactory
import ${pkg}.application._
import ${pkg}.domain.values._
import ${pkg}.domain._
import net.imadz.monarch.persistence.{PersistentMonarch, DurableRunObserver}
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.{Await, ExecutionContext, Future, Promise}
import scala.concurrent.duration._

class GeneratedEffectHostSpec extends AnyFunSuite {
  test("durable external intent, true actor effects, same identity query and authorized retry") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitSnapshotPlugin.config).withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    implicit val ec: ExecutionContext = kit.system.executionContext
    implicit val scheduler: akka.actor.typed.Scheduler = kit.system.scheduler
    implicit val timeout: Timeout = Timeout(5.seconds)
    val storage = PersistenceTestKit(kit.system)
    val calls = new java.util.concurrent.atomic.AtomicInteger()
    val queries = new java.util.concurrent.atomic.AtomicInteger()
    val auths = new java.util.concurrent.atomic.AtomicInteger()
    val actual = kit.spawn(AllocationOrderAggregate("effect-real-allocation", AllocationOrderState.empty, new AllocationOrderComputations {}, new AllocationOrderAggregate.ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = false }))
    val receipts = scala.collection.concurrent.TrieMap.empty[String, AllocationEffectObservation]
    @volatile var mode = "normal"
    val gate = Promise[AllocationEffectObservation]()
    def effect(input: AllocationEffectOperation): Future[AllocationEffectObservation] = {
      calls.incrementAndGet()
      actual.ask[AllocationOrderAggregate.Reply](reply => AllocationOrderAggregate.Execute(AllocationOrderProtocol.PrepareAllocation(TxId(input.operation), input.request.allocation), reply)).map {
        case AllocationOrderAggregate.Accepted(events) =>
          assert(events.collect { case e: AllocationOrderProtocol.AllocationPrepared => e.txid } == Vector(TxId(input.operation)))
          val value = AllocationEffectObservation(input.operation, input.request, "confirmed", "actual-event", Some(AllocationEffectResult(input.request.allocation)))
          receipts.put(input.operation, value); value
        case other => throw new IllegalStateException(other.toString)
      }
    }
    def installed() = ${host}.install(${host}.Bindings(
      ${host}.Implementation[AllocationEffectOperation, AllocationEffectObservation](${quote(execute.id)}, ${quote(execute.version)}, input => mode match {
        case "main" => assert(storage.persistedInStorage("effect-host-main").exists(_.isInstanceOf[${host}.Intent])); effect(input)
        case "lost" => effect(input).flatMap(_ => Future.failed(new IllegalStateException("lost reply after event")))
        case "absent" => Future.successful(AllocationEffectObservation(input.operation, input.request, "unknown", "", None))
        case "wrong" => Future.successful(AllocationEffectObservation("forged", input.request, "confirmed", "fake", Some(AllocationEffectResult(input.request.allocation))))
        case "wait" => calls.incrementAndGet(); gate.future
        case _ => effect(input)
      }),
      ${host}.Implementation[AllocationEffectOperation, Option[AllocationEffectObservation]](${quote(query.id)}, ${quote(query.version)}, input => {
        queries.incrementAndGet()
        Future.successful(if (mode == "absent") Some(AllocationEffectObservation(input.operation, input.request, "absent", "authoritative-no-effect", None)) else receipts.get(input.operation))
      }),
      ${host}.Implementation[AllocationEffectReconcile, Boolean](${quote(reconcile.id)}, ${quote(reconcile.version)}, input => { auths.incrementAndGet(); Future.successful(input.authorization == "test-owned-authority" && (input.decision != "retry" || input.evidence.exists(_.status == "absent"))) })
    ))
    def original(id: String, warehouse: String = "source-warehouse") = ${plan}.State(${plan}.Inputs(WarehouseId(warehouse), AllocationId(id)))
    val reply = kit.createTestProbe[${host}.Reply]()
    try {
      mode = "main"
      val input = original("effect-allocation")
      assert(${plan}.codec.decode(${plan}.codec.encode(input)) == input)
      val serializer = new ${host}Serializer
      val intent = ${host}.Intent(com.google.protobuf.ByteString.copyFrom(${plan}.codec.encode(input)), ${host}.operationIdentity(input))
      assert(serializer.fromBinary(serializer.toBinary(intent), serializer.manifest(intent)) == intent)
      val first = kit.spawn(${host}("effect-host-main", installed()))
      first ! ${host}.Invoke(input, reply.ref); reply.expectMessage(${host}.Completed(${plan}.inspect_Inspected(AllocationId("effect-allocation"))))
      first ! ${host}.Invoke(input, reply.ref); reply.expectMessage(${host}.Completed(${plan}.inspect_Inspected(AllocationId("effect-allocation"))))
      assert(calls.get() == 1)
      first ! ${host}.Invoke(original("effect-allocation", "different-source"), reply.ref); assert(reply.receiveMessage().isInstanceOf[${host}.Conflict])
      kit.stop(first)
      val replacement = kit.spawn(${host}("effect-host-main", installed()))
      replacement ! ${host}.Invoke(input, reply.ref); reply.expectMessage(${host}.Completed(${plan}.inspect_Inspected(AllocationId("effect-allocation"))))
      assert(calls.get() == 1)

      mode = "lost"
      val lost = kit.spawn(${host}("effect-host-lost", installed()))
      lost ! ${host}.Invoke(original("lost-allocation"), reply.ref); reply.expectMessage(${host}.Completed(${plan}.inspect_Inspected(AllocationId("lost-allocation"))))
      assert(calls.get() == 2 && queries.get() > 0)

      mode = "absent"
      val retryInput = original("retry-allocation")
      val retry = kit.spawn(${host}("effect-host-absent", installed()))
      retry ! ${host}.Invoke(retryInput, reply.ref); assert(reply.receiveMessage().isInstanceOf[${host}.Pending])
      retry ! ${host}.Reconcile(retryInput, "retry", "wrong-authority", reply.ref); assert(reply.receiveMessage().isInstanceOf[${host}.Pending])
      assert(calls.get() == 2)
      mode = "normal"
      retry ! ${host}.Reconcile(retryInput, "retry", "test-owned-authority", reply.ref)
      reply.expectMessage(${host}.Completed(${plan}.inspect_Inspected(AllocationId("retry-allocation"))))
      assert(calls.get() == 3 && storage.persistedInStorage("effect-host-absent").exists(_.isInstanceOf[${host}.RetryAuthorized]))

      mode = "wrong"
      val wrongInput = original("wrong-allocation")
      val wrong = kit.spawn(${host}("effect-host-wrong", installed()))
      wrong ! ${host}.Invoke(wrongInput, reply.ref); assert(reply.receiveMessage().isInstanceOf[${host}.Pending])
      wrong ! ${host}.Reconcile(wrongInput, "retry", "test-owned-authority", reply.ref); assert(reply.receiveMessage().isInstanceOf[${host}.Pending])
      assert(calls.get() == 3)

      mode = "wait"
      val staleInput = original("stale-allocation")
      val old = kit.spawn(${host}("effect-host-generation", installed()))
      old ! ${host}.Invoke(staleInput, reply.ref); reply.awaitAssert { assert(calls.get() == 4) }
      kit.stop(old); mode = "normal"
      val current = kit.spawn(${host}("effect-host-generation", installed()))
      current ! ${host}.Invoke(staleInput, reply.ref); assert(reply.receiveMessage().isInstanceOf[${host}.Pending])
      gate.success(AllocationEffectObservation(${host}.operationIdentity(staleInput), ${host}.request(staleInput), "confirmed", "stale-callback", Some(AllocationEffectResult(staleInput.inputs.allocation))))
      current ! ${host}.Invoke(staleInput, reply.ref); assert(reply.receiveMessage().isInstanceOf[${host}.Pending])
      assert(storage.persistedInStorage("effect-host-generation").collect { case ${host}.ObservationStored(bytes) => bytes }.forall(bytes => !bytes.toStringUtf8.contains("stale-callback")))

      val external = kit.spawn(${host}("effect-host-parent", installed()))
      val pure = new ${plan}.PureStages { def verify(request: ${plan}.verifyRequest): Future[${plan}.verifyResult] = Future.successful(${plan}.verify_Verified(request.allocation)) }
      val checkpoint = kit.createTestProbe[String]()
      val observer = new DurableRunObserver[${plan}.State] { override def onCheckpointCommitted(cursor: String, metadata: Map[String, String], state: ${plan}.State): Unit = checkpoint.ref ! cursor }
      val parent = kit.spawn(${plan}.behavior("effect-parent-journal", ${plan}.install(pure, external), observer))
      val accepted = kit.createTestProbe[PersistentMonarch.RunReply]()
      parent ! PersistentMonarch.StartRun[${plan}.State]("effect-parent-run", original("parent-allocation"), accepted.ref)
      accepted.expectMessage(PersistentMonarch.Accepted("effect-parent-run"))
      checkpoint.expectMessage("inspect#0"); checkpoint.expectMessage("verify#1")
      reply.awaitAssert {
        val events = storage.persistedInStorage("effect-parent-journal")
        assert(events.collect { case e: PersistentMonarch.StageDone => e.cursor } == Seq("inspect#0", "verify#1"))
        assert(events.count(_.isInstanceOf[PersistentMonarch.RunCompleted]) == 1)
        assert(${plan}.outputs(${plan}.codec.decode(events.collect { case e: PersistentMonarch.StageDone => e.snapshot }.last)).allocation == AllocationId("parent-allocation"))
      }
      val state = Await.result(actual.ask[AllocationOrderState](AllocationOrderAggregate.GetState), 5.seconds)
      assert(state.status == "prepared")
      val trueEvents = storage.persistedInStorage("effect-real-allocation").collect { case p: ${pkg}.infrastructure.proto.AllocationOrderAllocationPreparedPB => ${pkg}.infrastructure.serialization.DomainConverters.decodeAllocationOrderAllocationPreparedPB(p) }
      assert(trueEvents.size == 4 && trueEvents.map(_.txid).distinct.size == 4)
      assert(auths.get() == 2)
      intercept[IllegalArgumentException](${host}.install(null))
    } finally kit.shutdownTestKit()
  }
}
`;
    return entry('src/test/scala/GeneratedEffectHostSpec.scala', content, 'generated-test', [h.source, ...h.provenance], footprint,
      [pathFor(pkg, 'application/' + host + '.scala'), pathFor(pkg, 'application/' + plan + '.scala')]);
  });
}
