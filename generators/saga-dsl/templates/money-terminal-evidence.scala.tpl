  private def p20Port(host: @MODULE@.Host, source: Boolean, commit: Boolean)(implicit ec: ExecutionContext): PhasePort[@MODULE@.Args, String] = {
    val phase = if (commit) Phase.Commit else Phase.Compensate
    val codec = new net.imadz.infra.saga.strict.PayloadCodec[String] {
      override val pin = if (source && commit) host.reserve_sourceCommitBinding.receiptCodec.pin
        else if (source) host.reserve_sourceCompensateBinding.receiptCodec.pin
        else if (commit) host.reserve_targetCommitBinding.receiptCodec.pin else host.reserve_targetCompensateBinding.receiptCodec.pin
      override def encode(value: String) = if (source && commit) host.reserve_sourceCommitBinding.receiptCodec.encode(@MODULE@.Reserve_sourceCommitReceipt(value))
        else if (source) host.reserve_sourceCompensateBinding.receiptCodec.encode(@MODULE@.Reserve_sourceCompensateReceipt(value))
        else if (commit) host.reserve_targetCommitBinding.receiptCodec.encode(@MODULE@.Reserve_targetCommitReceipt(value))
        else host.reserve_targetCompensateBinding.receiptCodec.encode(@MODULE@.Reserve_targetCompensateReceipt(value))
      override def decode(bytes: com.google.protobuf.ByteString) = if (source && commit) host.reserve_sourceCommitBinding.receiptCodec.decode(bytes).map(_.txid)
        else if (source) host.reserve_sourceCompensateBinding.receiptCodec.decode(bytes).map(_.txid)
        else if (commit) host.reserve_targetCommitBinding.receiptCodec.decode(bytes).map(_.txid)
        else host.reserve_targetCompensateBinding.receiptCodec.decode(bytes).map(_.txid)
    }
    new PhasePort[@MODULE@.Args, String] {
      override def receiptCodec = codec
      override def querySafety = net.imadz.infra.saga.strict.QuerySafety.DeclaredReadOnly
      private def invoke(request: OperationRequest[@MODULE@.Args], query: Boolean): Future[PhaseOutcome[String]] = {
        val txid = request.identity.transaction.transactionId
        val id = if (source) request.args.from else request.args.to
        val identity = request.identity.copy(phase = phase)
        if (source && commit) {
          val b = host.reserve_sourceCommitBinding; val in = @MODULE@.Reserve_sourceCommitInput(txid, id)
          (if (query) b.query(identity, in) else b.execute(identity, in)).map {
            case ConfirmedReceipt(i, r) => ConfirmedReceipt(i, r.txid); case other: NotExecuted => other; case other: Unknown => other
          }
        } else if (source) {
          val b = host.reserve_sourceCompensateBinding; val in = @MODULE@.Reserve_sourceCompensateInput(txid, id)
          (if (query) b.query(identity, in) else b.execute(identity, in)).map {
            case ConfirmedReceipt(i, r) => ConfirmedReceipt(i, r.txid); case other: NotExecuted => other; case other: Unknown => other
          }
        } else if (commit) {
          val b = host.reserve_targetCommitBinding; val in = @MODULE@.Reserve_targetCommitInput(txid, id)
          (if (query) b.query(identity, in) else b.execute(identity, in)).map {
            case ConfirmedReceipt(i, r) => ConfirmedReceipt(i, r.txid); case other: NotExecuted => other; case other: Unknown => other
          }
        } else {
          val b = host.reserve_targetCompensateBinding; val in = @MODULE@.Reserve_targetCompensateInput(txid, id)
          (if (query) b.query(identity, in) else b.execute(identity, in)).map {
            case ConfirmedReceipt(i, r) => ConfirmedReceipt(i, r.txid); case other: NotExecuted => other; case other: Unknown => other
          }
        }
      }
      override def execute(request: OperationRequest[@MODULE@.Args]) = invoke(request, false)
      override def query(request: OperationRequest[@MODULE@.Args]) = invoke(request, true)
    }
  }

  test("P20 terminal repeat and opposite phase: four real ports preserve one event and original receipt bytes") {
    val port = freePort(); val name = "MoneyRepeatP20"
    val kit = ActorTestKit(name, clusterConfig(port, "\"akka://" + name + "@127.0.0.1:" + port + "\""))
    try {
      val sharding = initSharding(kit); awaitMembers(kit, 1)
      implicit val ec: ExecutionContext = kit.system.executionContext
      val host = new FixtureHost(kit.system, sharding)
      for (source <- Vector(true, false); commit <- Vector(true, false)) {
        val id = "p20-repeat-" + source + "-" + commit; val txid = "tx-" + id
        seedFunds(kit, id, "seed-" + id)
        val identity = p19Identity(host, txid, id, source)
        val amount = Money("30", Currency)
        val prepared = if (source) host.reserve_sourcePrepareBinding.execute(identity, @MODULE@.Reserve_sourcePrepareInput(txid, id, amount))
          else host.reserve_targetPrepareBinding.execute(identity, @MODULE@.Reserve_targetPrepareInput(txid, id, amount))
        assert(Await.result(prepared, 10.seconds).isInstanceOf[ConfirmedReceipt[_]])
        val request = OperationRequest(identity.copy(phase = if (commit) Phase.Commit else Phase.Compensate), @MODULE@.Args(id, id, amount))
        val terminal = p20Port(host, source, commit)
        val first = Await.result(terminal.execute(request), 10.seconds)
        assert(first == ConfirmedReceipt(request.identity, txid))
        val before = stateOf(kit, entityRef(sharding, id)); val events = p19Events(kit, id, txid)
        assert(events.size == 2)
        assert((if (commit) before.committed else before.compensated)(txid) == amount)
        assert(!(if (source) before.reservedAmount else before.incomingCredits).contains(txid))
        val expectedBalance = if (source && commit) "99970" else if (!source && commit) "100030" else "100000"
        assert(before.accountBalance(Currency).minorUnits == expectedBalance)
        assert(Await.result(terminal.execute(request), 10.seconds) == first)
        assert(Await.result(terminal.query(request), 10.seconds) == first)
        assert(terminal.receiptCodec.encode(txid) == StrictWire.lengthPrefixed(txid))
        val opposite = p20Port(host, source, !commit)
        val otherRequest = request.copy(identity = request.identity.copy(phase = if (commit) Phase.Compensate else Phase.Commit))
        for (outcome <- Vector(Await.result(opposite.query(otherRequest), 10.seconds), Await.result(opposite.execute(otherRequest), 10.seconds)))
          assert(outcome match { case Unknown(_, reason) => reason.startsWith("MONEY_TERMINAL_FACT_CONFLICT"); case _ => false })
        assert(stateOf(kit, entityRef(sharding, id)) == before)
        assert(p19Events(kit, id, txid) == events)
      }
    } finally kit.shutdownTestKit()
  }

  test("P20 synthetic classification: absence, corrupt/conflicting markers, false ACK and query failure are not runtime evidence") {
    val port = freePort(); val name = "MoneySyntheticP20"
    val kit = ActorTestKit(name, clusterConfig(port, "\"akka://" + name + "@127.0.0.1:" + port + "\""))
    try {
      implicit val ec: ExecutionContext = kit.system.executionContext
      val txid = "p20-synthetic"; val amount = Money("30", Currency)
      def synthetic(id: String): @ENTITY@.CreditBalanceState = {
        val base = @ENTITY@.empty(id)
        val marker = if (id.contains("null")) Map(txid -> null.asInstanceOf[@MONEY@])
          else if (id.contains("bad")) Map(txid -> Money("", Currency)) else Map(txid -> amount)
        if (id.contains("empty") || id.contains("failure")) base
        else if (id.contains("live-only")) base.copy(reservedAmount = Map(txid -> amount), incomingCredits = Map(txid -> amount))
        else if (id.contains("both")) base.copy(committed = marker, compensated = marker)
        else if (id.contains("live") && id.contains("commit")) base.copy(committed = marker,
          reservedAmount = Map(txid -> amount), incomingCredits = Map(txid -> amount))
        else if (id.contains("live") && id.contains("compensate")) base.copy(compensated = marker,
          reservedAmount = Map(txid -> amount), incomingCredits = Map(txid -> amount))
        else if (id.contains("commit")) base.copy(committed = marker) else base.copy(compensated = marker)
      }
      val observed = scala.concurrent.Promise[Unit]()
      val sharding = ClusterSharding(kit.system)
      sharding.init(Entity(@AGGREGATE@.entityTypeKey) { ctx =>
        akka.actor.typed.scaladsl.Behaviors.receiveMessage[@COMMANDS@] {
          case CreditBalanceProtocol.GetBalance(replyTo) if ctx.entityId.contains("failure") =>
            observed.trySuccess(()); akka.actor.typed.scaladsl.Behaviors.stopped
          case CreditBalanceProtocol.GetBalance(replyTo) =>
            replyTo ! CreditBalanceProtocol.GetCreditBalanceStateReply(synthetic(ctx.entityId)); akka.actor.typed.scaladsl.Behaviors.same
          case c: CreditBalanceProtocol.DeductFunds => c.replyTo ! CreditBalanceProtocol.CreditBalanceReply(None); akka.actor.typed.scaladsl.Behaviors.same
          case c: CreditBalanceProtocol.ReleaseReservedFunds => c.replyTo ! CreditBalanceProtocol.CreditBalanceReply(None); akka.actor.typed.scaladsl.Behaviors.same
          case c: CreditBalanceProtocol.CommitIncomingCredits => c.replyTo ! CreditBalanceProtocol.CreditBalanceReply(None); akka.actor.typed.scaladsl.Behaviors.same
          case c: CreditBalanceProtocol.CancelIncomingCredit => c.replyTo ! CreditBalanceProtocol.CreditBalanceReply(None); akka.actor.typed.scaladsl.Behaviors.same
          case _ => akka.actor.typed.scaladsl.Behaviors.unhandled
        }
      })
      awaitMembers(kit, 1)
      val host = new FixtureHost(kit.system, sharding)
      for (source <- Vector(true, false); commit <- Vector(true, false)) {
        val terminal = p20Port(host, source, commit)
        def request(id: String) = OperationRequest(p19Identity(host, txid, id, source).copy(phase = if (commit) Phase.Commit else Phase.Compensate), @MODULE@.Args(id, id, amount))
        for (suffix <- Vector("empty", "live-only")) {
          val r = request("p20-" + suffix)
          assert(Await.result(terminal.query(r), 10.seconds) match { case NotExecuted(_, _, true) => true; case _ => false })
          assert(Await.result(terminal.execute(r), 10.seconds) match { case Unknown(_, reason) => reason.startsWith("MONEY_TERMINAL_ACK_WITHOUT_FACT"); case _ => false })
        }
        for (suffix <- Vector("both", (if (commit) "commit" else "compensate") + "-live", (if (commit) "commit" else "compensate") + "-null", (if (commit) "commit" else "compensate") + "-bad")) {
          val outcome = Await.result(terminal.query(request("p20-" + suffix)), 10.seconds)
          val expected = if (suffix.contains("null") || suffix.contains("bad")) "MONEY_TERMINAL_FACT_UNAVAILABLE" else "MONEY_TERMINAL_FACT_CONFLICT"
          assert(outcome match { case Unknown(_, reason) => reason.startsWith(expected); case _ => false })
        }
      }
      val failed = p20Port(host, true, true).query(OperationRequest(p19Identity(host, txid, "p20-failure", true).copy(phase = Phase.Commit), @MODULE@.Args("p20-failure", "p20-failure", amount)))
      Await.result(observed.future, 10.seconds)
      assert(Await.result(failed, 10.seconds) match { case Unknown(_, reason) => reason.startsWith("phase evidence query failed"); case _ => false })
    } finally kit.shutdownTestKit()
  }

  for ((source, commit, conflict) <- Vector((true, true, false), (false, true, false),
    (true, false, false), (false, false, false), (true, true, true), (true, false, true)))
    test("P20 terminal ACK loss: real durable command and authorized actor recovery; source=" + source + "; commit=" + commit + "; opposite-injection=" + conflict) {
      val port = freePort(); val name = "MoneyAckP20" + source + commit + conflict
      val kit = ActorTestKit(name, clusterConfig(port, "\"akka://" + name + "@127.0.0.1:" + port + "\""))
      val held = scala.concurrent.Promise[PhaseOutcome[String]]()
      val prepareHeld = scala.concurrent.Promise[PhaseOutcome[@MODULE@.Reserve_targetPrepareReceipt]]()
      try {
        val sharding = initSharding(kit); awaitMembers(kit, 1)
        seedFunds(kit, From, "seed-p20-from"); seedFunds(kit, To, "seed-p20-to")
        implicit val ec: ExecutionContext = kit.system.executionContext
        val host = new FixtureHost(kit.system, sharding)
        val original = @MODULE@.definition(host)
        val phase = if (commit) Phase.Commit else Phase.Compensate
        val actual = p20Port(host, source, commit)
        val injected = p20Port(host, source, !commit)
        val durable = scala.concurrent.Promise[String]()
        val queried = scala.concurrent.Promise[PhaseOutcome[String]]()
        val preparedTarget = scala.concurrent.Promise[@MODULE@.Reserve_targetPrepareReceipt]()
        val executes = new java.util.concurrent.atomic.AtomicInteger()
        val refusalAttempts = new java.util.concurrent.atomic.AtomicInteger()
        val wrapped = new PhasePort[@MODULE@.Args, String] {
          override def receiptCodec = actual.receiptCodec
          override def querySafety = actual.querySafety
          override def execute(request: OperationRequest[@MODULE@.Args]) = {
            executes.incrementAndGet()
            val sent = if (conflict) request.copy(identity = request.identity.copy(phase = if (commit) Phase.Compensate else Phase.Commit)) else request
            (if (conflict) injected.execute(sent) else actual.execute(sent)).flatMap {
              case ConfirmedReceipt(_, receipt) => durable.trySuccess(receipt); held.future
              case other => Future.successful(other)
            }
          }
          override def query(request: OperationRequest[@MODULE@.Args]) = actual.query(request).map { outcome => queried.trySuccess(outcome); outcome }
        }
        val targetPrepare = new PhasePort[@MODULE@.Args, @MODULE@.Reserve_targetPrepareReceipt] {
          private val b = host.reserve_targetPrepareBinding
          override def receiptCodec = b.receiptCodec
          override def querySafety = b.querySafety
          override def execute(request: OperationRequest[@MODULE@.Args]) = {
            if (source) {
              refusalAttempts.incrementAndGet()
              Future.successful(NotExecuted(request.identity, "P20_TEST_PRE_DISPATCH_TARGET_REFUSAL", safeToRetry = true))
            } else b.execute(request.identity, @MODULE@.Reserve_targetPrepareInput(request.identity.transaction.transactionId, request.args.to, request.args.amount)).flatMap {
              case ConfirmedReceipt(_, receipt) => preparedTarget.trySuccess(receipt); prepareHeld.future
              case other => Future.successful(other)
            }
          }
          override def query(request: OperationRequest[@MODULE@.Args]) =
            b.query(request.identity, @MODULE@.Reserve_targetPrepareInput(request.identity.transaction.transactionId, request.args.to, request.args.amount))
        }
        val definition = original.copy(participants = (args: @MODULE@.Args) => original.participants(args).map { p =>
          val withTerminal = if (p.participantId == (if (source) "source" else "target")) p.copy(phases = p.phases.updated(phase, PhaseBinding(wrapped))) else p
          if (!commit && p.participantId == "target") withTerminal.copy(phases = withTerminal.phases.updated(Phase.Prepare, PhaseBinding(targetPrepare))) else withTerminal
        })
        val pid = PersistenceId.ofUniqueId("strict-saga/p20-ack")
        def spawn() = kit.spawn(StrictSagaCoordinator(pid, definition, FixtureReconcileAuthorizer(ReconcileToken), host.settings))
        val first = spawn(); val txid = "p20-ack"
        first ! StrictSagaCoordinator.Start(txid, host.argsCodec.encode(@MODULE@.Args(From, To, Money("20", Currency))), kit.createTestProbe[StrictSagaCoordinator.Reply]().ref)
        if (!commit && !source) {
          Await.result(preparedTarget.future, 10.seconds)
          val probe = kit.createTestProbe[StrictSagaCoordinator.Reply]()
          first ! StrictSagaCoordinator.GetStatus(probe.ref)
          val beforeAbort = probe.expectMessageType[StrictSagaCoordinator.Status].state
          assert(!beforeAbort.commitDecision && beforeAbort.pending.exists(_.identity.phase == Phase.Prepare))
          first ! StrictSagaCoordinator.Abort(beforeAbort.identity.get, "P20_TEST_AUTHORIZED_ABORT_BEFORE_COMMIT", probe.ref)
          assert(probe.expectMessageType[StrictSagaCoordinator.Status].state.abortRequested)
        }
        assert(Await.result(durable.future, 10.seconds) == txid)
        val interrupted = awaitTerminal(kit, first)
        assert(interrupted.status == StrictStatus.RecoveryRequired)
        assert(interrupted.commitDecision == commit && interrupted.abortRequested == !commit)
        val operation = OperationIdentity(interrupted.identity.get, if (source) "source" else "target", if (source) From else To,
          if (source) "reserve-source" else "reserve-target", phase)
        assert(interrupted.evidence(operation).isInstanceOf[Evidence.Uncertain])
        val sourceBefore = stateOf(kit, entityRef(sharding, From)); val targetBefore = stateOf(kit, entityRef(sharding, To))
        val sourceEvents = p19Events(kit, From, txid); val targetEvents = p19Events(kit, To, txid)
        assert((if (commit != conflict) (if (source) sourceBefore else targetBefore).committed else (if (source) sourceBefore else targetBefore).compensated)(txid) == Money("20", Currency))
        if (commit && source) assert(targetBefore.incomingCredits(txid) == Money("20", Currency))
        if (commit && !source) assert(sourceBefore.committed(txid) == Money("20", Currency))
        if (!commit && source) assert(targetEvents.isEmpty && refusalAttempts.get == 1)
        if (!commit && !source) assert(sourceBefore.reservedAmount(txid) == Money("20", Currency))
        kit.stop(first)
        val again = spawn(); val probe = kit.createTestProbe[StrictSagaCoordinator.Reply]()
        again ! StrictSagaCoordinator.GetStatus(probe.ref)
        val recovered = probe.expectMessageType[StrictSagaCoordinator.Status].state
        assert(recovered == interrupted)
        assert(p19Events(kit, From, txid) == sourceEvents && p19Events(kit, To, txid) == targetEvents)
        assert(executes.get == 1)
        again ! StrictSagaCoordinator.Reconcile(recovered.identity.get, ReconcileToken, 32, probe.ref)
        val evidence = Await.result(queried.future, 10.seconds)
        val finished = awaitTerminal(kit, again)
        if (conflict) {
          assert(evidence match { case Unknown(_, reason) => reason.startsWith("MONEY_TERMINAL_FACT_CONFLICT"); case _ => false })
          assert(finished.status == StrictStatus.RecoveryRequired && finished.commitDecision == commit && finished.abortRequested == !commit)
          assert(stateOf(kit, entityRef(sharding, From)) == sourceBefore && stateOf(kit, entityRef(sharding, To)) == targetBefore)
          assert(p19Events(kit, From, txid) == sourceEvents && p19Events(kit, To, txid) == targetEvents)
        } else {
          assert(evidence == ConfirmedReceipt(operation, txid))
          assert(finished.status == (if (commit) StrictStatus.Succeeded else StrictStatus.Aborted))
          assert(balance(kit, entityRef(sharding, From)) == BigInt(if (commit) "99980" else "100000"))
          assert(balance(kit, entityRef(sharding, To)) == BigInt(if (commit) "100020" else "100000"))
          val selectedBefore = if (source) sourceEvents else targetEvents
          val selectedAfter = p19Events(kit, if (source) From else To, txid)
          assert(selectedAfter == selectedBefore)
          val all = p19Events(kit, From, txid) ++ p19Events(kit, To, txid)
          if (commit) {
            assert(all.count(_.isInstanceOf[@ENTITY@.DeductFundsConfirmed]) == 1)
            assert(all.count(_.isInstanceOf[@ENTITY@.CommitIncomingCreditsConfirmed]) == 1)
            assert(!all.exists(e => e.isInstanceOf[@ENTITY@.ReleaseReservedFundsConfirmed] || e.isInstanceOf[@ENTITY@.CancelIncomingCreditConfirmed]))
          } else {
            assert(all.count(_.isInstanceOf[@ENTITY@.ReleaseReservedFundsConfirmed]) == 1)
            assert(all.count(_.isInstanceOf[@ENTITY@.CancelIncomingCreditConfirmed]) == (if (source) 0 else 1))
            assert(!all.exists(e => e.isInstanceOf[@ENTITY@.DeductFundsConfirmed] || e.isInstanceOf[@ENTITY@.CommitIncomingCreditsConfirmed]))
          }
          assert(finished.evidence(operation) == Evidence.Confirmed(operation, actual.receiptCodec.encode(txid)))
          assert(executes.get == 1)
          assertPublished(kit, sharding, finished, if (commit) "succeeded" else "compensated")
        }
        assert(executes.get == 1)
      } finally {
        held.tryFailure(new IllegalStateException("P20 test terminal ACK channel closed"))
        prepareHeld.tryFailure(new IllegalStateException("P20 test Prepare ACK channel closed"))
        kit.shutdownTestKit()
      }
    }
