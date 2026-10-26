  // P19: exact money Prepare evidence. These tests never create successful Saga history.
  import net.imadz.infra.saga.strict.{ConfirmedReceipt, NotExecuted, OperationIdentity, OperationRequest, PhaseBinding, PhaseOutcome, PhasePort, StrictSagaDefinition, TransactionIdentity, Unknown}
  import scala.concurrent.Future
  private def p19Events(kit: ActorTestKit, entityId: String, txid: String): Vector[Any] =
    PersistenceTestKit(kit.system).persistedInStorage(PersistenceId(@AGGREGATE@.entityTypeKey.name, entityId).id)
      .filter {
        case e: @ENTITY@.ReserveFundsConfirmed => e.txid == txid
        case e: @ENTITY@.RecordIncomingCreditsConfirmed => e.txid == txid
        case e: @ENTITY@.DeductFundsConfirmed => e.txid == txid
        case e: @ENTITY@.CommitIncomingCreditsConfirmed => e.txid == txid
        case e: @ENTITY@.ReleaseReservedFundsConfirmed => e.txid == txid
        case e: @ENTITY@.CancelIncomingCreditConfirmed => e.txid == txid
        case _ => false
      }.toVector

  private def p19Identity(host: @MODULE@.Host, txid: String, resource: String, source: Boolean): OperationIdentity = {
    val digest = "sha256:" + "0" * 64
    OperationIdentity(TransactionIdentity(txid, @MODULE@.Name, @MODULE@.Version, digest,
      @MODULE@.DefinitionDigest, host.argsCodec.pin, digest),
      if (source) "source" else "target", resource, if (source) "reserve-source" else "reserve-target", Phase.Prepare)
  }

  private def p19Refusal(host: @MODULE@.Host, attempts: java.util.concurrent.atomic.AtomicInteger)
      (implicit ec: ExecutionContext): StrictSagaDefinition[@MODULE@.Args] = {
    val original = @MODULE@.definition(host)
    original.copy(participants = (args: @MODULE@.Args) => original.participants(args).map { participant =>
      if (participant.participantId != "target") participant else {
        val binding = host.reserve_targetPrepareBinding
        val port = new PhasePort[@MODULE@.Args, @MODULE@.Reserve_targetPrepareReceipt] {
          override def receiptCodec = binding.receiptCodec
          override def querySafety = binding.querySafety
          override def execute(request: OperationRequest[@MODULE@.Args]) = {
            attempts.incrementAndGet()
            // Explicit test-only admission refusal: no target command is dispatched.
            Future.successful(NotExecuted(request.identity, "P19_TEST_PRE_DISPATCH_REFUSAL", safeToRetry = true))
          }
          override def query(request: OperationRequest[@MODULE@.Args]) =
            binding.query(request.identity, @MODULE@.Reserve_targetPrepareInput(request.identity.transaction.transactionId, request.args.to, request.args.amount))
        }
        participant.copy(phases = participant.phases.updated(Phase.Prepare, PhaseBinding(port)))
      }
    })
  }

  test("B3 full saga: test-only pre-dispatch target refusal compensates the confirmed source") {
    val port = freePort()
    val kit = ActorTestKit("SafetySagaB3", clusterConfig(port, "\"akka://SafetySagaB3@127.0.0.1:" + port + "\""))
    try {
      val sharding = initSharding(kit)
      awaitMembers(kit, 1)
      seedFunds(kit, From, "seed-b3-from")
      seedFunds(kit, To, "seed-b3-to")
      implicit val ec: ExecutionContext = kit.system.executionContext
      val host = new FixtureHost(kit.system, sharding)
      val attempts = new java.util.concurrent.atomic.AtomicInteger()
      val before = stateOf(kit, entityRef(sharding, To))
      val coordinator = kit.spawn(StrictSagaCoordinator(PersistenceId.ofUniqueId("strict-saga/p19-b3"),
        p19Refusal(host, attempts), FixtureReconcileAuthorizer(ReconcileToken), host.settings))
      coordinator ! StrictSagaCoordinator.Start("op-b3", host.argsCodec.encode(@MODULE@.Args(From, To, Money("70", Currency))),
        kit.createTestProbe[StrictSagaCoordinator.Reply]().ref)
      val state = awaitTerminal(kit, coordinator)
      assert(state.status == StrictStatus.Aborted)
      assert(attempts.get == 1)
      assert(p19Events(kit, To, "op-b3").isEmpty)
      assert(stateOf(kit, entityRef(sharding, To)) == before)
      assert(balance(kit, entityRef(sharding, From)) == BigInt("100000"))
      assert(stateOf(kit, entityRef(sharding, From)).compensated("op-b3").minorUnits == "70")
      assertPublished(kit, sharding, state, "compensated")
    } finally kit.shutdownTestKit()
  }

  test("P19 exact Prepare: source and target repeat/query use durable money and refuse conflicting payloads") {
    val port = freePort()
    val kit = ActorTestKit("MoneyEvidenceP19", clusterConfig(port, "\"akka://MoneyEvidenceP19@127.0.0.1:" + port + "\""))
    try {
      val sharding = initSharding(kit)
      awaitMembers(kit, 1)
      implicit val ec: ExecutionContext = kit.system.executionContext
      val host = new FixtureHost(kit.system, sharding)
      for (source <- Vector(true, false)) {
        val id = if (source) "p19-source" else "p19-target"
        val txid = "p19-exact-" + source
        seedFunds(kit, id, "seed-" + id)
        val identity = p19Identity(host, txid, id, source)
        def execute(value: @MONEY@): PhaseOutcome[Any] = Await.result(
          if (source) host.reserve_sourcePrepareBinding.execute(identity, @MODULE@.Reserve_sourcePrepareInput(txid, id, value))
          else host.reserve_targetPrepareBinding.execute(identity, @MODULE@.Reserve_targetPrepareInput(txid, id, value)), 10.seconds)
        def query(value: @MONEY@): PhaseOutcome[Any] = Await.result(
          if (source) host.reserve_sourcePrepareBinding.query(identity, @MODULE@.Reserve_sourcePrepareInput(txid, id, value))
          else host.reserve_targetPrepareBinding.query(identity, @MODULE@.Reserve_targetPrepareInput(txid, id, value)), 10.seconds)
        val amount = Money("30", Currency)
        val first = execute(amount)
        assert(first.isInstanceOf[ConfirmedReceipt[_]])
        val stored = stateOf(kit, entityRef(sharding, id))
        val events = p19Events(kit, id, txid)
        assert(events.size == 1)
        assert(execute(amount) == first)
        assert(query(amount) == first)
        first match {
          case ConfirmedReceipt(_, receipt: @MODULE@.Reserve_sourcePrepareReceipt) =>
            assert(host.reserve_sourcePrepareBinding.receiptCodec.encode(receipt) ==
              host.reserve_sourcePrepareBinding.receiptCodec.encode(@MODULE@.Reserve_sourcePrepareReceipt(txid, stored.reservedAmount(txid))))
          case ConfirmedReceipt(_, receipt: @MODULE@.Reserve_targetPrepareReceipt) =>
            assert(host.reserve_targetPrepareBinding.receiptCodec.encode(receipt) ==
              host.reserve_targetPrepareBinding.receiptCodec.encode(@MODULE@.Reserve_targetPrepareReceipt(txid, stored.incomingCredits(txid))))
          case _ => fail("missing typed durable receipt")
        }
        for (conflict <- Vector(Money("31", Currency), Money("30", "USD"), Money("030", Currency))) {
          assert(query(conflict) match { case Unknown(_, reason) => reason.startsWith("MONEY_PREPARE_PAYLOAD_CONFLICT"); case _ => false })
          assert(execute(conflict) match { case Unknown(_, reason) => reason.startsWith("MONEY_PREPARE_PAYLOAD_CONFLICT"); case _ => false })
        }
        assert(p19Events(kit, id, txid) == events)
        assert(stateOf(kit, entityRef(sharding, id)) == stored)
      }
    } finally kit.shutdownTestKit()
  }

  test("P19 terminal facts: Prepare query after Commit or Compensate is unknown, not safe absence") {
    val port = freePort()
    val kit = ActorTestKit("MoneyTerminalP19", clusterConfig(port, "\"akka://MoneyTerminalP19@127.0.0.1:" + port + "\""))
    try {
      val sharding = initSharding(kit)
      awaitMembers(kit, 1)
      implicit val ec: ExecutionContext = kit.system.executionContext
      val host = new FixtureHost(kit.system, sharding)
      for (source <- Vector(true, false); commit <- Vector(true, false)) {
        val id = "p19-terminal-" + source + "-" + commit
        val txid = "tx-" + id
        seedFunds(kit, id, "seed-" + id)
        val identity = p19Identity(host, txid, id, source)
        val amount = Money("30", Currency)
        val prepared = if (source) host.reserve_sourcePrepareBinding.execute(identity, @MODULE@.Reserve_sourcePrepareInput(txid, id, amount))
          else host.reserve_targetPrepareBinding.execute(identity, @MODULE@.Reserve_targetPrepareInput(txid, id, amount))
        assert(Await.result(prepared, 10.seconds).isInstanceOf[ConfirmedReceipt[_]])
        val done = if (source && commit) host.reserve_sourceCommitBinding.execute(identity.copy(phase = Phase.Commit), @MODULE@.Reserve_sourceCommitInput(txid, id))
          else if (source) host.reserve_sourceCompensateBinding.execute(identity.copy(phase = Phase.Compensate), @MODULE@.Reserve_sourceCompensateInput(txid, id))
          else if (commit) host.reserve_targetCommitBinding.execute(identity.copy(phase = Phase.Commit), @MODULE@.Reserve_targetCommitInput(txid, id))
          else host.reserve_targetCompensateBinding.execute(identity.copy(phase = Phase.Compensate), @MODULE@.Reserve_targetCompensateInput(txid, id))
        assert(Await.result(done, 10.seconds).isInstanceOf[ConfirmedReceipt[_]])
        val events = p19Events(kit, id, txid)
        val queried = if (source) host.reserve_sourcePrepareBinding.query(identity, @MODULE@.Reserve_sourcePrepareInput(txid, id, amount))
          else host.reserve_targetPrepareBinding.query(identity, @MODULE@.Reserve_targetPrepareInput(txid, id, amount))
        assert(Await.result(queried, 10.seconds) match { case Unknown(_, reason) => reason.startsWith("MONEY_PREPARE_TERMINAL_FACT"); case _ => false })
        assert(p19Events(kit, id, txid) == events)
      }
    } finally kit.shutdownTestKit()
  }

  for (conflict <- Vector(false, true)) test("P19 prior target Prepare: equal resumes, conflict requires recovery; conflict=" + conflict) {
    val port = freePort()
    val name = "MoneyPriorP19" + conflict
    val kit = ActorTestKit(name, clusterConfig(port, "\"akka://" + name + "@127.0.0.1:" + port + "\""))
    try {
      val sharding = initSharding(kit)
      awaitMembers(kit, 1)
      seedFunds(kit, From, "seed-prior-from")
      seedFunds(kit, To, "seed-prior-to")
      implicit val ec: ExecutionContext = kit.system.executionContext
      val host = new FixtureHost(kit.system, sharding)
      val txid = "p19-prior"
      val amount = Money(if (conflict) "71" else "70", Currency)
      val prepared = Await.result(host.reserve_targetPrepareBinding.execute(p19Identity(host, txid, To, false),
        @MODULE@.Reserve_targetPrepareInput(txid, To, amount)), 10.seconds)
      assert(prepared.isInstanceOf[ConfirmedReceipt[_]])
      val before = p19Events(kit, To, txid)
      assert(before.size == 1)
      val coordinator = kit.spawn(@MODULE@.behavior(PersistenceId.ofUniqueId("strict-saga/p19-prior"), host,
        FixtureReconcileAuthorizer(ReconcileToken)))
      coordinator ! StrictSagaCoordinator.Start(txid, host.argsCodec.encode(@MODULE@.Args(From, To, Money("70", Currency))),
        kit.createTestProbe[StrictSagaCoordinator.Reply]().ref)
      val state = awaitTerminal(kit, coordinator)
      if (conflict) {
        assert(state.status == StrictStatus.RecoveryRequired)
        assert(state.evidence.values.exists { case Evidence.Uncertain(_, reason) => reason.startsWith("MONEY_PREPARE_PAYLOAD_CONFLICT"); case _ => false })
        assert(p19Events(kit, To, txid) == before)
        assert(stateOf(kit, entityRef(sharding, From)).reservedAmount(txid).minorUnits == "70")
        assert(!stateOf(kit, entityRef(sharding, From)).compensated.contains(txid))
        assert(stateOf(kit, entityRef(sharding, To)).incomingCredits(txid).minorUnits == "71")
      } else {
        assert(state.status == StrictStatus.Succeeded)
        assert(p19Events(kit, To, txid).count(_.isInstanceOf[@ENTITY@.RecordIncomingCreditsConfirmed]) == 1)
        assert(balance(kit, entityRef(sharding, From)) == BigInt("99930"))
        assert(balance(kit, entityRef(sharding, To)) == BigInt("100070"))
        assertPublished(kit, sharding, state, "succeeded")
      }
    } finally kit.shutdownTestKit()
  }

  for (conflict <- Vector(false, true)) test("P19 ACK loss: real durable Prepare is queried after actor recovery; conflict=" + conflict) {
    val port = freePort()
    val name = "MoneyAckP19" + conflict
    val kit = ActorTestKit(name, clusterConfig(port, "\"akka://" + name + "@127.0.0.1:" + port + "\""))
    val held = scala.concurrent.Promise[PhaseOutcome[@MODULE@.Reserve_sourcePrepareReceipt]]()
    try {
      val sharding = initSharding(kit)
      awaitMembers(kit, 1)
      seedFunds(kit, From, "seed-ack-from")
      seedFunds(kit, To, "seed-ack-to")
      implicit val ec: ExecutionContext = kit.system.executionContext
      val host = new FixtureHost(kit.system, sharding)
      val original = @MODULE@.definition(host)
      val durable = scala.concurrent.Promise[@MODULE@.Reserve_sourcePrepareReceipt]()
      val queried = scala.concurrent.Promise[PhaseOutcome[@MODULE@.Reserve_sourcePrepareReceipt]]()
      val executes = new java.util.concurrent.atomic.AtomicInteger()
      val binding = host.reserve_sourcePrepareBinding
      val wrapped = new PhasePort[@MODULE@.Args, @MODULE@.Reserve_sourcePrepareReceipt] {
        override def receiptCodec = binding.receiptCodec
        override def querySafety = binding.querySafety
        override def execute(request: OperationRequest[@MODULE@.Args]) = {
          executes.incrementAndGet()
          val sent = if (conflict) Money("21", Currency) else request.args.amount
          binding.execute(request.identity, @MODULE@.Reserve_sourcePrepareInput(request.identity.transaction.transactionId, request.args.from, sent)).flatMap {
            case ConfirmedReceipt(_, receipt) => durable.trySuccess(receipt); held.future
            case other => Future.successful(other)
          }
        }
        override def query(request: OperationRequest[@MODULE@.Args]) =
          binding.query(request.identity, @MODULE@.Reserve_sourcePrepareInput(request.identity.transaction.transactionId, request.args.from, request.args.amount))
            .map { outcome => queried.trySuccess(outcome); outcome }
      }
      val definition = original.copy(participants = (args: @MODULE@.Args) => original.participants(args).map(p =>
        if (p.participantId == "source") p.copy(phases = p.phases.updated(Phase.Prepare, PhaseBinding(wrapped))) else p))
      val pid = PersistenceId.ofUniqueId("strict-saga/p19-ack")
      def spawn() = kit.spawn(StrictSagaCoordinator(pid, definition, FixtureReconcileAuthorizer(ReconcileToken), host.settings))
      val first = spawn()
      val txid = "p19-ack"
      first ! StrictSagaCoordinator.Start(txid, host.argsCodec.encode(@MODULE@.Args(From, To, Money("20", Currency))),
        kit.createTestProbe[StrictSagaCoordinator.Reply]().ref)
      val receipt = Await.result(durable.future, 10.seconds)
      assert(receipt.amount.minorUnits == (if (conflict) "21" else "20"))
      val priorEvents = p19Events(kit, From, txid)
      assert(priorEvents.size == 1)
      assert(stateOf(kit, entityRef(sharding, From)).reservedAmount(txid) == receipt.amount)
      val interrupted = awaitTerminal(kit, first)
      assert(interrupted.status == StrictStatus.RecoveryRequired)
      assert(interrupted.evidence.values.exists(_.isInstanceOf[Evidence.Uncertain]))
      // ActorTestKit.stop waits for deathwatch termination; the same journal remains.
      kit.stop(first)
      val again = spawn()
      val probe = kit.createTestProbe[StrictSagaCoordinator.Reply]()
      again ! StrictSagaCoordinator.GetStatus(probe.ref)
      val recovered = probe.expectMessageType[StrictSagaCoordinator.Status].state
      assert(recovered.identity == interrupted.identity)
      assert(recovered.status == StrictStatus.RecoveryRequired)
      again ! StrictSagaCoordinator.Reconcile(recovered.identity.get, ReconcileToken, 32, probe.ref)
      val evidence = Await.result(queried.future, 10.seconds)
      if (conflict) {
        assert(evidence match { case Unknown(_, reason) => reason.startsWith("MONEY_PREPARE_PAYLOAD_CONFLICT"); case _ => false })
        assert(awaitTerminal(kit, again).status == StrictStatus.RecoveryRequired)
        assert(p19Events(kit, From, txid) == priorEvents)
        assert(p19Events(kit, To, txid).isEmpty)
        assert(balance(kit, entityRef(sharding, From)) == BigInt("99979"))
        assert(balance(kit, entityRef(sharding, To)) == BigInt("100000"))
      } else {
        assert(evidence == ConfirmedReceipt(OperationIdentity(recovered.identity.get, "source", From, "reserve-source", Phase.Prepare), receipt))
        val finished = awaitTerminal(kit, again)
        assert(finished.status == StrictStatus.Succeeded)
        assert(p19Events(kit, From, txid).count(_.isInstanceOf[@ENTITY@.ReserveFundsConfirmed]) == 1)
        assert(balance(kit, entityRef(sharding, From)) == BigInt("99980"))
        assert(balance(kit, entityRef(sharding, To)) == BigInt("100020"))
        assertPublished(kit, sharding, finished, "succeeded")
      }
      assert(executes.get == 1)
    } finally {
      held.tryFailure(new IllegalStateException("test ACK channel closed"))
      kit.shutdownTestKit()
    }
  }

