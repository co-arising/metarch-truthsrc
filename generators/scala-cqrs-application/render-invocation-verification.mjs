/** Explicit independent inventory oracle; all effects call generated actors and journal rows certify durability. */
export function invocationOracle(h,pkg) {
 const stem=h.id.replaceAll('-','_'),host=pkg+'.application.'+stem+'Host',definition=pkg+'.application.'+stem+'Definition',plan=pkg+'.application.allocation_workflowExecution';
 return `      val journal = akka.persistence.testkit.scaladsl.PersistenceTestKit(kit.system)
      val original = ${plan}.State(${plan}.Inputs(${pkg}.domain.values.ReservationRequestId("request-A"), ${pkg}.domain.values.ReservationRequestId("occurrence-A"), ${pkg}.domain.values.WarehouseId("warehouse-A"), ${pkg}.domain.values.SkuId("sku-A"), 3L, ${pkg}.domain.values.AllocationId("allocation-last"), ${pkg}.domain.values.WarehouseId("warehouse-B")))
      assert(${plan}.codec.decode(${plan}.codec.encode(original)) == original)
      assert(${host}.operationIdentity(original) != ${host}.operationIdentity(original.copy(inputs = original.inputs.copy(occurrence = ${pkg}.domain.values.ReservationRequestId("occurrence-B")))))
      intercept[IllegalArgumentException] { ${plan}.outputs(original) }
      val abandonedDelivery = scala.concurrent.Promise[Unit]()
      val deliveryGate = scala.concurrent.Promise[Unit]()
      resultDeliveryGate.set(abandonedDelivery.future)
      var hostActor = kit.spawn(${host}("owned-workflow-host", coordinator, installedTechnical))
      def installed = ${plan}.install(new ${plan}.PureStages {}, hostActor)
      val completed = kit.createTestProbe[String]()
      val observer = new net.imadz.monarch.persistence.DurableRunObserver[${plan}.State] {
        override def onCheckpointCommitted(cursor: String, metadata: Map[String, String], state: ${plan}.State): Unit = completed.ref ! cursor
      }
      var parent = kit.spawn(${plan}.behavior("owned-workflow-parent", installed, observer))
      val runReply = kit.createTestProbe[net.imadz.monarch.persistence.PersistentMonarch.RunReply]()
      parent ! net.imadz.monarch.persistence.PersistentMonarch.StartRun("owned-workflow-run", original, runReply.ref)
      runReply.expectMessage(net.imadz.monarch.persistence.PersistentMonarch.Accepted("owned-workflow-run"))
      runReply.awaitAssert { assert(journal.persistedInStorage("owned-workflow-host").exists { case ${host}.ResultIntent("succeeded") => true; case _ => false }) }
      val identity = journal.persistedInStorage("owned-workflow-host").collectFirst { case ${host}.IdentityObserved(i) => i }.get
      assert(journal.persistedInStorage("owned-workflow-parent").count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunStarted]) == 1)
      assert(!journal.persistedInStorage("owned-workflow-parent").exists(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]))
      val effects = executeCounts.toMap
      assert(effects.values.sum == 6)
      kit.stop(parent)
      kit.stop(hostActor)
      resultDeliveryGate.set(deliveryGate.future)
      hostActor = kit.spawn(${host}("owned-workflow-host", coordinator, installedTechnical))
      parent = kit.spawn(${plan}.behavior("owned-workflow-parent", installed, observer))
      runReply.awaitAssert { assert(journal.persistedInStorage("owned-workflow-host").count(_.isInstanceOf[${host}.Associated]) == 1) }
      loseDeliveryAck.set(true)
      deliveryGate.success(())
      completed.expectMessage("allocate#0")
      runReply.awaitAssert {
        val rows = journal.persistedInStorage("owned-workflow-parent")
        assert(rows.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1)
        val checkpoints = rows.collect { case s: net.imadz.monarch.persistence.PersistentMonarch.StageDone => s }
        assert(checkpoints.size == 1)
        assert(${plan}.outputs(${plan}.codec.decode(checkpoints.head.snapshot)).txid.value == identity.transactionId)
      }
      assert(executeCounts.toMap == effects)
      assert(deliveryCounts("succeeded") == 2)
      assert(journal.persistedInStorage("owned-workflow-host").count(_.isInstanceOf[${host}.IdentityObserved]) == 1)
      val allocation = kit.createTestProbe[${pkg}.domain.AllocationOrderState]()
      actor_allocation ! ${pkg}.domain.AllocationOrderAggregate.GetState(allocation.ref)
      assert(allocation.receiveMessage().result == "ReservationSucceeded")
      val hostReply = kit.createTestProbe[${host}.Reply]()
      hostActor ! ${host}.Invoke(original.copy(inputs = original.inputs.copy(sku = ${pkg}.domain.values.SkuId("conflicting-sku"))), hostReply.ref)
      hostReply.expectMessageType[${host}.Conflict]
      assert(executeCounts.toMap == effects)
      kit.stop(parent)
      parent = kit.spawn(${plan}.behavior("owned-workflow-parent", installed, observer))
      parent ! net.imadz.monarch.persistence.PersistentMonarch.StartRun("owned-workflow-run", original, runReply.ref)
      runReply.expectMessageType[net.imadz.monarch.persistence.PersistentMonarch.Rejected]
      assert(executeCounts.toMap == effects)
      resultDeliveryGate.set(Future.successful(()))
      for ((mode, code) <- Vector(("zero", "Rejected"), ("compensated", "Compensated"), ("recovery-required", "RecoveryRequired"), ("outcome-unknown", "Unknown"))) {
        fault.set(if (mode == "zero") "" else mode)
        val input = original.copy(inputs = original.inputs.copy(requestId = ${pkg}.domain.values.ReservationRequestId("request-" + mode), quantity = if (mode == "zero") 0L else 3L))
        val c = kit.spawn(${definition}.coordinator("workflow-coordinator-" + mode, ports, authorizer))
        val hostForMode = kit.spawn(${host}("workflow-host-" + mode, c, installedTechnical))
        val stages = ${plan}.install(new ${plan}.PureStages {}, hostForMode)
        val parentForMode = kit.spawn(${plan}.behavior("workflow-parent-" + mode, stages, observer))
        parentForMode ! net.imadz.monarch.persistence.PersistentMonarch.StartRun("workflow-" + mode, input, runReply.ref)
        runReply.expectMessageType[net.imadz.monarch.persistence.PersistentMonarch.Accepted]
        runReply.awaitAssert { assert(journal.persistedInStorage("workflow-parent-" + mode).exists { case e: net.imadz.monarch.persistence.PersistentMonarch.RunFailedEvt => e.reason.contains(code); case _ => false }) }
        assert(!journal.persistedInStorage("workflow-parent-" + mode).exists(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]))
      }
    } finally kit.shutdownTestKit()
  }
`;
}
