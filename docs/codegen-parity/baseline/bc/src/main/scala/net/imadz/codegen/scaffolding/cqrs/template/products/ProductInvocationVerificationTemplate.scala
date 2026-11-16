package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.model.products.ProductApplicationHost
import net.imadz.codegen.structure.NamingConventions

/** Independent inventory runtime oracle; observers notify, persisted journal rows certify the result. */
object ProductInvocationVerificationTemplate {
  def oracle(row: ProductApplicationHost, pkg: String, model: net.imadz.codegen.scaffolding.cqrs.model.products.ProductApplicationModel, effect: Option[net.imadz.meta.products.EffectHost] = None): String = {
    val pipeline = model.pipelines.find(_.id == row.contract.entry.startOwner.ref.get.id).get
    val literals = Map("requestId" -> s"$pkg.domain.values.ReservationRequestId(\"request-A\")", "occurrence" -> s"$pkg.domain.values.ReservationRequestId(\"occurrence-A\")",
      "warehouse" -> s"$pkg.domain.values.WarehouseId(\"warehouse-A\")", "sku" -> s"$pkg.domain.values.SkuId(\"sku-A\")", "quantity" -> "3L",
      "allocation" -> s"$pkg.domain.values.AllocationId(\"allocation-last\")", "destination" -> s"$pkg.domain.values.WarehouseId(\"warehouse-B\")")
    val inputs = pipeline.inputs.map { input => literals.getOrElse(input.id, {
      val pin = pipeline.binding.types.find(_._1 == input.valueType).get
      val types = model.hosts.flatMap(_.runtime.args.types).filter(_.id == input.valueType)
      require(types.nonEmpty && types.forall(t => t.shape.isInstanceOf[net.imadz.meta.execution.SagaTypeShape.Text] && t.canonicalType == "String" && t.implementation.toString == pin._2), "unsupported independent oracle input " + input.id)
      ujson.write(input.id + "-original")
    }) }.mkString(", ")
    val stem = NamingConventions.strictSymbol(row.contract.id)
    val host = pkg + ".application." + stem + "Host"
    val definition = pkg + ".application." + stem + "Definition"
    val plan = pkg + ".application.allocation_workflowExecution"
    val content = s"""      val journal = akka.persistence.testkit.scaladsl.PersistenceTestKit(kit.system)
      val initial = $plan.State($plan.Inputs($inputs))
      assert($plan.codec.decode($plan.codec.encode(initial)) == initial)
      assert($host.operationIdentity(initial) != $host.operationIdentity(initial.copy(inputs = initial.inputs.copy(occurrence = $pkg.domain.values.ReservationRequestId("occurrence-B")))))
      intercept[IllegalArgumentException] { $plan.outputs(initial) }
      val abandonedDelivery = scala.concurrent.Promise[Unit]()
      val deliveryGate = scala.concurrent.Promise[Unit]()
      resultDeliveryGate.set(abandonedDelivery.future)
      var hostActor = kit.spawn($host("owned-workflow-host", coordinator, installedTechnical))
      def installed = $plan.install(new $plan.PureStages {}, hostActor)
      val committed = kit.createTestProbe[String]()
      val observer = new net.imadz.monarch.persistence.DurableRunObserver[$plan.State] {
        override def onCheckpointCommitted(cursor: String, metadata: Map[String, String], state: $plan.State): Unit = committed.ref ! cursor
      }
      var parent = kit.spawn($plan.behavior("owned-workflow-parent", installed, observer))
      val reply = kit.createTestProbe[net.imadz.monarch.persistence.PersistentMonarch.RunReply]()
      parent ! net.imadz.monarch.persistence.PersistentMonarch.StartRun("owned-workflow-run", initial, reply.ref)
      reply.expectMessage(net.imadz.monarch.persistence.PersistentMonarch.Accepted("owned-workflow-run"))
      reply.awaitAssert { assert(journal.persistedInStorage("owned-workflow-host").exists { case $host.ResultIntent("succeeded") => true; case _ => false }) }
      val identity = journal.persistedInStorage("owned-workflow-host").collectFirst { case $host.IdentityObserved(i) => i }.get
      assert(journal.persistedInStorage("owned-workflow-parent").count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunStarted]) == 1)
      assert(!journal.persistedInStorage("owned-workflow-parent").exists(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]))
      val effects = executeCounts.toMap
      assert(effects.values.sum == 6)
      kit.stop(parent)
      kit.stop(hostActor)
      resultDeliveryGate.set(deliveryGate.future)
      hostActor = kit.spawn($host("owned-workflow-host", coordinator, installedTechnical))
      parent = kit.spawn($plan.behavior("owned-workflow-parent", installed, observer))
      loseDeliveryAck.set(true)
      deliveryGate.success(())
      committed.expectMessage("allocate#0")
      reply.awaitAssert {
        val rows = journal.persistedInStorage("owned-workflow-parent")
        assert(rows.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1)
        val checkpoints = rows.collect { case s: net.imadz.monarch.persistence.PersistentMonarch.StageDone => s }
        assert(checkpoints.size == 1)
        assert($plan.outputs($plan.codec.decode(checkpoints.head.snapshot)).txid.value == identity.transactionId)
      }
      assert(executeCounts.toMap == effects)
      assert(deliveryCounts("succeeded") == 2)
      val hostEvents = journal.persistedInStorage("owned-workflow-host")
      assert(hostEvents.count(_.isInstanceOf[$host.Associated]) == 1)
      assert(hostEvents.count(_.isInstanceOf[$host.IdentityObserved]) == 1)
      assert(hostEvents.count(_.isInstanceOf[$host.DeliveryAcknowledged]) == 1)
      val allocation = kit.createTestProbe[$pkg.domain.AllocationOrderState]()
      actor_allocation ! $pkg.domain.AllocationOrderAggregate.GetState(allocation.ref)
      assert(allocation.receiveMessage().result == "ReservationSucceeded")
      val hostReply = kit.createTestProbe[$host.Reply]()
      hostActor ! $host.Invoke(initial.copy(inputs = initial.inputs.copy(sku = $pkg.domain.values.SkuId("conflicting-sku"))), hostReply.ref)
      hostReply.expectMessageType[$host.Conflict]
      assert(executeCounts.toMap == effects)
      kit.stop(parent)
      parent = kit.spawn($plan.behavior("owned-workflow-parent", installed, observer))
      parent ! net.imadz.monarch.persistence.PersistentMonarch.StartRun("owned-workflow-run", initial, reply.ref)
      reply.expectMessageType[net.imadz.monarch.persistence.PersistentMonarch.Rejected]
      assert(executeCounts.toMap == effects)
      resultDeliveryGate.set(Future.successful(()))
      for ((mode, code) <- Vector(("zero", "Rejected"), ("compensated", "Compensated"), ("recovery-required", "RecoveryRequired"), ("outcome-unknown", "Unknown"))) {
        fault.set(if (mode == "zero") "" else mode)
        val input = initial.copy(inputs = initial.inputs.copy(requestId = $pkg.domain.values.ReservationRequestId("request-" + mode), quantity = if (mode == "zero") 0L else 3L))
        val childCoordinator = kit.spawn($definition.coordinator("workflow-coordinator-" + mode, ports, authorizer))
        val childHost = kit.spawn($host("workflow-host-" + mode, childCoordinator, installedTechnical))
        val stages = $plan.install(new $plan.PureStages {}, childHost)
        val childParent = kit.spawn($plan.behavior("workflow-parent-" + mode, stages, observer))
        childParent ! net.imadz.monarch.persistence.PersistentMonarch.StartRun("workflow-" + mode, input, reply.ref)
        reply.expectMessageType[net.imadz.monarch.persistence.PersistentMonarch.Accepted]
        if (mode == "zero" || mode == "compensated") {
          reply.awaitAssert { assert(journal.persistedInStorage("workflow-parent-" + mode).exists { case e: net.imadz.monarch.persistence.PersistentMonarch.RunFailedEvt => e.reason.contains(code); case _ => false }) }
          assert(!journal.persistedInStorage("workflow-parent-" + mode).exists(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]))
        } else {
          val status = kit.createTestProbe[StrictSagaCoordinator.Reply]()
          var retained: StrictState = null
          status.awaitAssert { childCoordinator ! StrictSagaCoordinator.GetStatus(status.ref); retained = status.expectMessageType[StrictSagaCoordinator.Status].state; assert(retained.status == StrictStatus.RecoveryRequired) }
          assert(!journal.persistedInStorage("workflow-parent-" + mode).exists(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunFailedEvt]))
          assert(!journal.persistedInStorage("workflow-parent-" + mode).exists(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]))
          childCoordinator ! StrictSagaCoordinator.Reconcile(retained.identity.get, "denied", 32, status.ref)
          status.expectMessageType[StrictSagaCoordinator.Denied]
          childCoordinator ! StrictSagaCoordinator.Reconcile(retained.identity.get, "owned-test-reconcile", 32, status.ref)
          status.expectMessageType[StrictSagaCoordinator.Status]
          status.awaitAssert { childCoordinator ! StrictSagaCoordinator.GetStatus(status.ref); val recovered = status.expectMessageType[StrictSagaCoordinator.Status].state; assert(recovered.status == StrictStatus.Succeeded && recovered.identity == retained.identity) }
          reply.awaitAssert { assert(journal.persistedInStorage("workflow-parent-" + mode).count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1) }
          assert(!journal.persistedInStorage("workflow-parent-" + mode).exists(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunFailedEvt]))
        }
      }
    } finally kit.shutdownTestKit()
  }
"""
    effect.fold(content) { h =>
      val effectHost = NamingConventions.strictSymbol(h.id) + "EffectHost"
      val operation = h.operationType.asInstanceOf[net.imadz.meta.products.NominalType.Named].ref.id
      val observation = h.observationType.asInstanceOf[net.imadz.meta.products.NominalType.Named].ref.id
      val reconcile = h.reconcileType.asInstanceOf[net.imadz.meta.products.NominalType.Named].ref.id
      val result = h.resultType.asInstanceOf[net.imadz.meta.products.NominalType.Named].ref.id
      val execute = h.technicalPorts.find(_.role == "execute").get.implementation
      val query = h.technicalPorts.find(_.role == "query").get.implementation
      val authorize = h.technicalPorts.find(_.role == "reconcile").get.implementation
      def q(v: String): String = ujson.write(v)
      val setup = s"""      val auditEffects = new java.util.concurrent.atomic.AtomicInteger()
      val auditReceipts = scala.collection.concurrent.TrieMap.empty[String, $observation]
      val auditBindings = $effectHost.install($effectHost.Bindings(
        $effectHost.Implementation[$operation, $observation](${q(execute.id)}, ${q(execute.version)}, input => {
          auditEffects.incrementAndGet()
          actor_allocation.ask[$pkg.domain.AllocationOrderAggregate.Reply](reply => $pkg.domain.AllocationOrderAggregate.Execute($pkg.domain.AllocationOrderProtocol.CommitAllocation(input.request.txid, input.request.allocation), reply)).map {
            case $pkg.domain.AllocationOrderAggregate.Accepted(events) =>
              assert(events.collect { case e: $pkg.domain.AllocationOrderProtocol.AllocationCommitted => e.txid } == Vector(input.request.txid))
              val confirmed = $observation(input.operation, input.request, "confirmed", "actual-allocation-committed", Some($result(input.request.allocation)))
              auditReceipts.put(input.operation, confirmed); confirmed
            case other => throw new IllegalStateException(other.toString)
          }
        }),
        $effectHost.Implementation[$operation, Option[$observation]](${q(query.id)}, ${q(query.version)}, input => Future.successful(auditReceipts.get(input.operation))),
        $effectHost.Implementation[$reconcile, Boolean](${q(authorize.id)}, ${q(authorize.version)}, _ => Future.successful(false))
      ))
      val auditHost = kit.spawn($effectHost("owned-workflow-effect", auditBindings))
"""
      val oldInstall = s"def installed = $plan.install(new $plan.PureStages {}, hostActor)"
      val newInstall = s"def installed = $plan.install(new $plan.PureStages {}, hostActor, auditHost)"
      require(content.contains(oldInstall), "exact legacy invocation oracle install required")
      content.replace("      val journal =", setup + "      val journal =")
        .replace(oldInstall, newInstall)
        .replace("committed.expectMessage(\"allocate#0\")", "committed.expectMessage(\"allocate#0\"); committed.expectMessage(\"audit#1\"); assert(auditEffects.get() == 1)")
        .replace("assert(checkpoints.size == 1)", "assert(checkpoints.size == 2 && checkpoints.map(_.cursor) == Seq(\"allocate#0\", \"audit#1\"))")
        .replace(s"$plan.outputs($plan.codec.decode(checkpoints.head.snapshot))", s"$plan.outputs($plan.codec.decode(checkpoints.last.snapshot))")
        .replace(s"val stages = $plan.install(new $plan.PureStages {}, childHost)",
          if (model.selectedArtifacts.exists(_.deployment.service.nonEmpty))
            s"val modeAudit = kit.spawn($effectHost(\"workflow-effect-\" + mode, auditBindings))\n          val stages = $plan.install(new $plan.PureStages {}, childHost, modeAudit)"
          else s"val stages = $plan.install(new $plan.PureStages {}, childHost, auditHost)")
    }
  }
}
