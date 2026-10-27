  for (commit <- Vector(true, false); minor <- Vector("0", "-1")) {
    test("P22 participant incoming positive: reject, same-journal recovery and corrected txid; commit=" + commit + "; minor=" + minor) {
      val kit = ActorTestKit("P22Incoming" + commit + (if (minor == "0") "Zero" else "Negative"), singleNodeConfig())
      try {
        val id = "p22-incoming-" + commit + "-" + minor; val txid = "tx-" + id
        val first = kit.spawn(aggregateBehavior(id)); p21Fund(kit, first, id)
        val before = stateOf(kit, first); val journal = p21AllEvents(kit, id)
        assert(journal.size == 2 && before.accountBalance(Currency).minorUnits == "100000")
        val invalid = Money(minor, Currency)
        def rejected(ref: ActorRef[@COMMANDS@]): Unit = {
          val reply = askNow(kit, ref)(r => CreditBalanceProtocol.RecordIncomingCredits(txid, id, invalid, r))
          assert(reply.error.map(_.code).contains("60004"))
          assert(stateOf(kit, ref) == before && p21AllEvents(kit, id) == journal)
          assert(p19Events(kit, id, txid).isEmpty)
          assert(askNow(kit, ref)(r => CreditBalanceProtocol.CommitIncomingCredits(txid, id, r)).error.map(_.code).contains("60008"))
          assert(askNow(kit, ref)(r => CreditBalanceProtocol.CancelIncomingCredit(txid, id, r)).error.map(_.code).contains("60009"))
          assert(stateOf(kit, ref) == before && p21AllEvents(kit, id) == journal)
        }
        rejected(first)
        kit.stop(first)
        val again = kit.spawn(aggregateBehavior(id))
        assert(stateOf(kit, again) == before && p21AllEvents(kit, id) == journal)
        rejected(again)
        val amount = Money("30", Currency)
        assert(askNow(kit, again)(r => CreditBalanceProtocol.RecordIncomingCredits(txid, id, amount, r)).error.isEmpty)
        assert(stateOf(kit, again).incomingCredits(txid) == amount)
        assert(askNow(kit, again)(r => p21TerminalCommand(false, commit, txid, id, r)).error.isEmpty)
        val done = stateOf(kit, again)
        assert(done.accountBalance(Currency).minorUnits == (if (commit) "100030" else "100000"))
        assert((if (commit) done.committed else done.compensated)(txid) == amount)
        assert(!(if (commit) done.compensated else done.committed).contains(txid))
        assert(!done.incomingCredits.contains(txid) && !done.reservedAmount.contains(txid))
        assert(p19Events(kit, id, txid).size == 2 && p21AllEvents(kit, id).size == 4)
      } finally kit.shutdownTestKit()
    }
  }

  test("P22 real Host incoming positive: controlled rejection, exact repeat and payload-conflict Unknown") {
    val port = freePort(); val name = "P22IncomingHost"
    val kit = ActorTestKit(name, clusterConfig(port, "\"akka://" + name + "@127.0.0.1:" + port + "\""))
    try {
      val sharding = initSharding(kit); awaitMembers(kit, 1)
      implicit val ec: ExecutionContext = kit.system.executionContext
      val host = new FixtureHost(kit.system, sharding)
      val binding = host.reserve_targetPrepareBinding
      for (minor <- Vector("0", "-1")) {
        val id = "p22-host-" + minor; val txid = "tx-" + id
        val ref = entityRef(sharding, id); p21Fund(kit, ref, id)
        val identity = p19Identity(host, txid, id, false)
        val invalid = @MODULE@.Reserve_targetPrepareInput(txid, id, Money(minor, Currency))
        val before = stateOf(kit, ref); val journal = p21AllEvents(kit, id)
        def absent(outcome: PhaseOutcome[_]): Unit = assert(outcome match {
          case NotExecuted(actual, evidence, safe) => actual == identity && safe && evidence.contains("no transaction fact")
          case _ => false
        })
        absent(Await.result(binding.query(identity, invalid), 10.seconds))
        val rejected = Await.result(binding.execute(identity, invalid), 10.seconds)
        assert(rejected match {
          case NotExecuted(actual, evidence, safe) => actual == identity && safe && evidence.contains("60004")
          case _ => false
        })
        absent(Await.result(binding.query(identity, invalid), 10.seconds))
        assert(stateOf(kit, ref) == before && p21AllEvents(kit, id) == journal)
        val amount = Money("30", Currency); val input = @MODULE@.Reserve_targetPrepareInput(txid, id, amount)
        val receipt = @MODULE@.Reserve_targetPrepareReceipt(txid, amount)
        val confirmed = ConfirmedReceipt(identity, receipt)
        assert(Await.result(binding.execute(identity, input), 10.seconds) == confirmed)
        val receiptBytes = binding.receiptCodec.encode(receipt)
        val prepared = stateOf(kit, ref); val preparedJournal = p21AllEvents(kit, id)
        assert(prepared.incomingCredits(txid) == amount && prepared.accountBalance(Currency).minorUnits == "100000")
        assert(p19Events(kit, id, txid).size == 1 && preparedJournal.size == 3)
        assert(Await.result(binding.execute(identity, input), 10.seconds) == confirmed)
        assert(Await.result(binding.query(identity, input), 10.seconds) == confirmed)
        for (changed <- Vector("0", "-1")) {
          val conflict = @MODULE@.Reserve_targetPrepareInput(txid, id, Money(changed, Currency))
          for (outcome <- Vector(Await.result(binding.execute(identity, conflict), 10.seconds), Await.result(binding.query(identity, conflict), 10.seconds)))
            assert(outcome match { case Unknown(actual, reason) => actual == identity && reason.startsWith("MONEY_PREPARE_PAYLOAD_CONFLICT"); case _ => false })
          assert(stateOf(kit, ref) == prepared && p21AllEvents(kit, id) == preparedJournal)
        }
        assert(Await.result(binding.query(identity, input), 10.seconds) == confirmed)
        assert(binding.receiptCodec.encode(receipt) == receiptBytes)
      }
    } finally kit.shutdownTestKit()
  }

  test("P22 synthetic incoming precedence: terminal and live guards precede non-positive rejection") {
    val txid = "p22-synthetic"; val amount = Money("30", Currency)
    val base = @ENTITY@.empty("p22-synthetic-resource").copy(accountBalance = Map(Currency -> SeedAmount))
    def rule(state: @ENTITY@.CreditBalanceState, value: @MONEY@) =
      @RULES@.RecordIncomingCreditsRule(state, @RULE_PARAMS@.RecordIncomingCreditsParams(txid, value))
    val cases = Vector(
      base -> "60004",
      base.copy(incomingCredits = Map(txid -> amount)) -> "60007",
      base.copy(committed = Map(txid -> amount)) -> "60011",
      base.copy(compensated = Map(txid -> amount)) -> "60012",
      base.copy(committed = Map(txid -> amount), compensated = Map(txid -> amount)) -> "60011")
    for ((state, expected) <- cases; minor <- Vector("0", "-1"))
      assert(rule(state, Money(minor, Currency)) match { case Left(error) => error.code == expected; case _ => false })
    assert(rule(base, amount) == Right(List(@ENTITY@.RecordIncomingCreditsConfirmed(txid, amount))))
  }
