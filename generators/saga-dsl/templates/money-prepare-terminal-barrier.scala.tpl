  private def p21AllEvents(kit: ActorTestKit, id: String): Vector[Any] =
    PersistenceTestKit(kit.system).persistedInStorage(PersistenceId(@AGGREGATE@.entityTypeKey.name, id).id).toVector

  private def p21PrepareCommand(source: Boolean, txid: String, id: String, amount: @MONEY@, reply: ActorRef[CreditBalanceProtocol.CreditBalanceReply]): @COMMANDS@ =
    if (source) CreditBalanceProtocol.ReserveFunds(txid, id, amount, reply)
    else CreditBalanceProtocol.RecordIncomingCredits(txid, id, amount, reply)

  private def p21TerminalCommand(source: Boolean, commit: Boolean, txid: String, id: String, reply: ActorRef[CreditBalanceProtocol.CreditBalanceReply]): @COMMANDS@ =
    if (source && commit) CreditBalanceProtocol.DeductFunds(txid, id, reply)
    else if (source) CreditBalanceProtocol.ReleaseReservedFunds(txid, id, reply)
    else if (commit) CreditBalanceProtocol.CommitIncomingCredits(txid, id, reply)
    else CreditBalanceProtocol.CancelIncomingCredit(txid, id, reply)

  private def p21Fund(kit: ActorTestKit, ref: akka.actor.typed.RecipientRef[@COMMANDS@], id: String): Unit = {
    val seed = "p21-seed-" + id
    assert(askNow(kit, ref)(reply => CreditBalanceProtocol.RecordIncomingCredits(seed, id, SeedAmount, reply)).error.isEmpty)
    assert(askNow(kit, ref)(reply => CreditBalanceProtocol.CommitIncomingCredits(seed, id, reply)).error.isEmpty)
  }

  private def p21Amounts: Vector[@MONEY@] = Vector(Money("30", Currency), Money("31", Currency),
    Money("30", "YTS"), Money("0", Currency), Money("-1", Currency), Money("not-minor", Currency))

  for (source <- Vector(true, false); commit <- Vector(true, false)) {
    test("P21 participant terminal barrier: real commands and same-journal recovery; source=" + source + "; commit=" + commit) {
      val kit = ActorTestKit("P21Participant" + source + commit, singleNodeConfig())
      try {
        val id = "p21-participant-" + source + "-" + commit; val txid = "tx-" + id
        val first = kit.spawn(aggregateBehavior(id))
        p21Fund(kit, first, id)
        val amount = Money("30", Currency)
        assert(askNow(kit, first)(reply => p21PrepareCommand(source, txid, id, amount, reply)).error.isEmpty)
        assert(askNow(kit, first)(reply => p21TerminalCommand(source, commit, txid, id, reply)).error.isEmpty)
        val before = stateOf(kit, first); val journal = p21AllEvents(kit, id)
        assert(p19Events(kit, id, txid).size == 2 && journal.size == 4)
        assert((if (commit) before.committed else before.compensated)(txid) == amount)
        assert(!(if (commit) before.compensated else before.committed).contains(txid))
        assert(!before.reservedAmount.contains(txid) && !before.incomingCredits.contains(txid))
        val expected = if (source && commit) "99970" else if (!source && commit) "100030" else "100000"
        assert(before.accountBalance(Currency).minorUnits == expected)
        def late(ref: ActorRef[@COMMANDS@]): Unit = for (changed <- p21Amounts) {
          val reply = askNow(kit, ref)(r => p21PrepareCommand(source, txid, id, changed, r))
          assert(reply.error.map(_.code).contains(if (commit) "60011" else "60012"))
          assert(stateOf(kit, ref) == before)
          assert(p21AllEvents(kit, id) == journal)
        }
        late(first)
        kit.stop(first)
        val again = kit.spawn(aggregateBehavior(id))
        assert(stateOf(kit, again) == before)
        assert(p21AllEvents(kit, id) == journal)
        late(again)
      } finally kit.shutdownTestKit()
    }
  }

  test("P21 real Host terminal barrier: Prepare remains Unknown without reopening facts or receipt") {
    val port = freePort(); val name = "P21HostBarrier"
    val kit = ActorTestKit(name, clusterConfig(port, "\"akka://" + name + "@127.0.0.1:" + port + "\""))
    try {
      val sharding = initSharding(kit); awaitMembers(kit, 1)
      implicit val ec: ExecutionContext = kit.system.executionContext
      val host = new FixtureHost(kit.system, sharding)
      for (source <- Vector(true, false); commit <- Vector(true, false)) {
        val id = "p21-host-" + source + "-" + commit; val txid = "tx-" + id
        val ref = entityRef(sharding, id); p21Fund(kit, ref, id)
        val amount = Money("30", Currency); val identity = p19Identity(host, txid, id, source)
        val prepared = if (source) host.reserve_sourcePrepareBinding.execute(identity, @MODULE@.Reserve_sourcePrepareInput(txid, id, amount))
          else host.reserve_targetPrepareBinding.execute(identity, @MODULE@.Reserve_targetPrepareInput(txid, id, amount))
        assert(Await.result(prepared, 10.seconds).isInstanceOf[ConfirmedReceipt[_]])
        val request = OperationRequest(identity.copy(phase = if (commit) Phase.Commit else Phase.Compensate), @MODULE@.Args(id, id, amount))
        val terminal = p20Port(host, source, commit)
        val confirmed = Await.result(terminal.execute(request), 10.seconds)
        assert(confirmed == ConfirmedReceipt(request.identity, txid))
        val receiptBytes = terminal.receiptCodec.encode(txid)
        val before = stateOf(kit, ref); val journal = p21AllEvents(kit, id)
        for (changed <- p21Amounts) {
          val query = if (source) host.reserve_sourcePrepareBinding.query(identity, @MODULE@.Reserve_sourcePrepareInput(txid, id, changed))
            else host.reserve_targetPrepareBinding.query(identity, @MODULE@.Reserve_targetPrepareInput(txid, id, changed))
          val execute = if (source) host.reserve_sourcePrepareBinding.execute(identity, @MODULE@.Reserve_sourcePrepareInput(txid, id, changed))
            else host.reserve_targetPrepareBinding.execute(identity, @MODULE@.Reserve_targetPrepareInput(txid, id, changed))
          for (outcome <- Vector(Await.result(query, 10.seconds), Await.result(execute, 10.seconds)))
            assert(outcome match { case Unknown(_, reason) => reason.startsWith("MONEY_PREPARE_TERMINAL_FACT"); case _ => false })
          assert(stateOf(kit, ref) == before)
          assert(p21AllEvents(kit, id) == journal)
          assert(Await.result(terminal.query(request), 10.seconds) == confirmed)
          assert(terminal.receiptCodec.encode(txid) == receiptBytes)
        }
      }
    } finally kit.shutdownTestKit()
  }

  test("P21 ordered mailbox barrier: terminal-first rejects, live-repeat-first preserves old behavior") {
    val kit = ActorTestKit("P21OrderedBarrier", singleNodeConfig())
    try {
      for (source <- Vector(true, false); commit <- Vector(true, false); terminalFirst <- Vector(true, false)) {
        val id = "p21-order-" + source + "-" + commit + "-" + terminalFirst; val txid = "tx-" + id
        val ref = kit.spawn(aggregateBehavior(id)); p21Fund(kit, ref, id)
        val amount = Money("30", Currency)
        assert(askNow(kit, ref)(r => p21PrepareCommand(source, txid, id, amount, r)).error.isEmpty)
        val replies = kit.createTestProbe[CreditBalanceProtocol.CreditBalanceReply]()
        // Both commands are sent to the same local ActorRef from this test thread;
        // probe expectations acknowledge the actual durable command order, not sleeps.
        if (terminalFirst) {
          ref ! p21TerminalCommand(source, commit, txid, id, replies.ref)
          ref ! p21PrepareCommand(source, txid, id, amount, replies.ref)
          assert(replies.receiveMessage().error.isEmpty)
          assert(replies.receiveMessage().error.map(_.code).contains(if (commit) "60011" else "60012"))
        } else {
          ref ! p21PrepareCommand(source, txid, id, amount, replies.ref)
          ref ! p21TerminalCommand(source, commit, txid, id, replies.ref)
          val repeated = replies.receiveMessage()
          if (source) assert(repeated.error.isEmpty) else assert(repeated.error.map(_.code).contains("60007"))
          assert(replies.receiveMessage().error.isEmpty)
        }
        val state = stateOf(kit, ref)
        assert(p19Events(kit, id, txid).size == 2 && p21AllEvents(kit, id).size == 4)
        assert((if (commit) state.committed else state.compensated)(txid) == amount)
        assert(!state.reservedAmount.contains(txid) && !state.incomingCredits.contains(txid))
        assert(state.accountBalance(Currency).minorUnits == (if (source && commit) "99970" else if (!source && commit) "100030" else "100000"))
      }
    } finally kit.shutdownTestKit()
  }

  test("P21 synthetic rule precedence: terminal markers beat live empty-success and amount checks") {
    val txid = "p21-synthetic"; val amount = Money("30", Currency)
    val base = @ENTITY@.empty("p21-synthetic-resource").copy(
      accountBalance = Map(Currency -> SeedAmount), reservedAmount = Map(txid -> amount), incomingCredits = Map(txid -> amount))
    def rule(source: Boolean, state: @ENTITY@.CreditBalanceState, value: @MONEY@) =
      if (source) @RULES@.ReserveFundsRule(state, @RULE_PARAMS@.ReserveFundsParams(txid, value))
      else @RULES@.RecordIncomingCreditsRule(state, @RULE_PARAMS@.RecordIncomingCreditsParams(txid, value))
    val corrupt = null.asInstanceOf[@MONEY@]
    val states = Vector(
      base.copy(committed = Map(txid -> amount)) -> "60011",
      base.copy(compensated = Map(txid -> amount)) -> "60012",
      base.copy(committed = Map(txid -> amount), compensated = Map(txid -> amount)) -> "60011",
      base.copy(committed = Map(txid -> corrupt)) -> "60011",
      base.copy(compensated = Map(txid -> Money("", Currency))) -> "60012")
    for (source <- Vector(true, false); (state, expected) <- states; value <- p21Amounts) {
      val result = rule(source, state, value)
      assert(result match { case Left(error) => error.code == expected; case _ => false })
    }
    assert(rule(true, base, amount) == Right(Nil))
    assert(rule(false, base, amount) match { case Left(error) => error.code == "60007"; case _ => false })
  }
