/** Independent child oracle uses the actual PersistenceTestKit journal, not a progress mirror. */
export function childOracle(h,pkg) {
 const stem=h.id.replaceAll('-','_'),host=pkg+'.application.'+stem+'Host',parent=pkg+'.application.allocation_workflowExecution',plan=pkg+'.application.allocation_childExecution',childHost=pkg+'.application.allocation_workflow_await_inspectionChildHost';
 return `      val journal = akka.persistence.testkit.scaladsl.PersistenceTestKit(kit.system)
      val initial = ${parent}.State(${parent}.Inputs(${pkg}.domain.values.ReservationRequestId("request-child"), ${pkg}.domain.values.ReservationRequestId("occurrence-child"), ${pkg}.domain.values.WarehouseId("warehouse-A"), ${pkg}.domain.values.SkuId("sku-A"), 3L, ${pkg}.domain.values.AllocationId("allocation-last"), ${pkg}.domain.values.WarehouseId("warehouse-B")))
      assert(${parent}.codec.decode(${parent}.codec.encode(initial)) == initial)
      val childInitial = ${childHost}.initial(initial)
      assert(${plan}.codec.decode(${plan}.codec.encode(childInitial)) == childInitial)
      val inspectCalls = new java.util.concurrent.atomic.AtomicInteger(0)
      val verifyCalls = new java.util.concurrent.atomic.AtomicInteger(0)
      val childGate = scala.concurrent.Promise[Unit]()
      val childCommitted = kit.createTestProbe[String]()
      val childObserver = new net.imadz.monarch.persistence.DurableRunObserver[${plan}.State] {
        override def onCheckpointCommitted(cursor: String, metadata: Map[String, String], state: ${plan}.State): Unit = childCommitted.ref ! cursor
      }
      val stages = new ${plan}.Stages {
        def inspect(request: ${plan}.inspectRequest): Future[${plan}.inspectResult] = { inspectCalls.incrementAndGet(); Future.successful(${plan}.inspect_Confirmed(request.allocation)) }
        def verify(request: ${plan}.verifyRequest): Future[${plan}.verifyResult] = { verifyCalls.incrementAndGet(); childGate.future.map(_ => ${plan}.verify_Confirmed(request.allocation)) }
      }
      val reader = new ${pkg}.application.ChildJournal.Reader {
        def events(pid: String): Future[Vector[Any]] = Future.successful(journal.persistedInStorage(pid).toVector)
      }
      val childPid = ${childHost}.childPersistenceId(initial)
      var child = kit.spawn(${plan}.behavior(childPid, stages, childObserver))
      var awaited = kit.spawn(${childHost}("owned-child-host", child, reader))
      var invocation = kit.spawn(${host}("owned-before-child", coordinator, installedTechnical))
      def installed = ${parent}.install(new ${parent}.PureStages {}, invocation, awaited)
      val parentCommitted = kit.createTestProbe[String]()
      val observer = new net.imadz.monarch.persistence.DurableRunObserver[${parent}.State] {
        override def onCheckpointCommitted(cursor: String, metadata: Map[String, String], state: ${parent}.State): Unit = parentCommitted.ref ! cursor
      }
      var actor = kit.spawn(${parent}.behavior("owned-child-parent", installed, observer))
      val reply = kit.createTestProbe[net.imadz.monarch.persistence.PersistentMonarch.RunReply]()
      actor ! net.imadz.monarch.persistence.PersistentMonarch.StartRun("owned-child-parent-run", initial, reply.ref)
      reply.expectMessageType[net.imadz.monarch.persistence.PersistentMonarch.Accepted]
      parentCommitted.expectMessage("allocate#0")
      childCommitted.expectMessage("inspect#0")
      reply.awaitAssert { assert(verifyCalls.get() == 1) }
      val actualPrefix = journal.persistedInStorage(childPid)
      val effectCounts = executeCounts.toMap
      assert(effectCounts.values.sum == 6)
      assert(actualPrefix.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunStarted]) == 1)
      assert(actualPrefix.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]) == 1)
      assert(journal.persistedInStorage("owned-child-host").count(_.isInstanceOf[${childHost}.Intent]) == 1)
      assert(journal.persistedInStorage("owned-child-parent").count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]) == 1)
      kit.stop(actor)
      kit.stop(awaited)
      kit.stop(child)
      child = kit.spawn(${plan}.behavior(childPid, stages, childObserver))
      awaited = kit.spawn(${childHost}("owned-child-host", child, reader))
      actor = kit.spawn(${parent}.behavior("owned-child-parent", installed, observer))
      reply.awaitAssert { assert(verifyCalls.get() == 2) }
      assert(inspectCalls.get() == 1)
      childGate.success(())
      childCommitted.expectMessage("verify#1")
      parentCommitted.expectMessage("await-inspection#1")
      reply.awaitAssert {
        val rows = journal.persistedInStorage("owned-child-parent")
        assert(rows.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1)
        val checkpoints = rows.collect { case done: net.imadz.monarch.persistence.PersistentMonarch.StageDone => done }
        assert(checkpoints.map(_.cursor) == Seq("allocate#0", "await-inspection#1"))
        val output = ${parent}.outputs(${parent}.codec.decode(checkpoints.last.snapshot))
        assert(output.allocation == ${pkg}.domain.values.AllocationId("allocation-last"))
      }
      assert(executeCounts.toMap == effectCounts)
      assert(inspectCalls.get() == 1 && verifyCalls.get() == 2)
      val actual = journal.persistedInStorage(childPid).toVector
      val operation = ${childHost}.operationIdentity(initial)
      val bytes = com.google.protobuf.ByteString.copyFrom(${plan}.codec.encode(childInitial))
      val exactPlan = Vector("inspect#0", "verify#1")
      assert(${pkg}.application.ChildJournal.observe(actual, operation, bytes, exactPlan, ${plan}.codec).isInstanceOf[${pkg}.application.ChildJournal.Completed[_]])
      assert(${pkg}.application.ChildJournal.observe(actual, "different", bytes, exactPlan, ${plan}.codec).isInstanceOf[${pkg}.application.ChildJournal.Conflict])
      assert(${pkg}.application.ChildJournal.observe(actual.filterNot(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]), operation, bytes, exactPlan, ${plan}.codec).isInstanceOf[${pkg}.application.ChildJournal.Conflict])
      val hostReply = kit.createTestProbe[${childHost}.Reply]()
      awaited ! ${childHost}.Invoke(initial.copy(inputs = initial.inputs.copy(allocation = ${pkg}.domain.values.AllocationId("different-allocation"))), hostReply.ref)
      hostReply.expectMessageType[${childHost}.Conflict]
      kit.stop(actor)
      actor = kit.spawn(${parent}.behavior("owned-child-parent", installed, observer))
      actor ! net.imadz.monarch.persistence.PersistentMonarch.StartRun("owned-child-parent-run", initial, reply.ref)
      reply.expectMessageType[net.imadz.monarch.persistence.PersistentMonarch.Rejected]
      assert(executeCounts.toMap == effectCounts && inspectCalls.get() == 1 && verifyCalls.get() == 2)
    } finally kit.shutdownTestKit()
  }
`;
}
