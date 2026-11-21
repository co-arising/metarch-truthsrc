package example.stockreservation.application.services.transactor

import akka.actor.typed.ActorRef
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.PersistenceId
import com.google.protobuf.ByteString
import example.stockreservation.application.aggregates.WarehouseProtocol
import example.stockreservation.domain.entities.WarehouseState
import example.stockreservation.domain.events.StockTransferCompletedEvent
import java.util.UUID
import net.imadz.infra.saga.strict._
import org.scalacheck.Gen
import org.scalacheck.Prop.{forAll, secure}
import org.scalacheck.Properties
import scala.concurrent.Await
import scala.concurrent.duration._
import StrictWire._

/** 行为合同（真宿主面）：StrictWire/编解码/合同护栏/触发器/完成桥/Entry 面
  * ＋真实 cluster 流（真实 ClusterSharding、真实 WarehouseEntity、真实协调器、
  * persistence-testkit journal）。无生成器场景性质 secure＝单次评估 Proved；
  * 随机面 forAll＝≥1000 次评估。恢复流经 persistence-testkit 的 PID 级
  * failNextPersisted 确定性注入首 persist 失败 → 宿主 ask 超时折叠 Unknown →
  * RecoveryRequired → 授权对账 → 重驱成功。 */
object SagaEntryProperties extends Properties("strict-fixture-host.behavior.v1") {
  import SagaEntryOracle._
  import SagaEntryCases._
  private implicit val ec: scala.concurrent.ExecutionContext =
    scala.concurrent.ExecutionContext.global

  private def throwsMessage(thunk: => Any): String = {
    try {
      thunk
      "<no-throw>"
    } catch { case ex: Throwable =>
      Option(ex.getMessage).getOrElse("<null-message>").stripPrefix("requirement failed: ")
    }
  }

  private val genText: Gen[String] = Gen.chooseNum(0, 80).flatMap(n =>
    Gen.listOfN(n, Gen.alphaNumChar).map(_.mkString))
  private val genSku: Gen[String] = Gen.chooseNum(1, 40).flatMap(n =>
    Gen.listOfN(n, Gen.alphaNumChar).map(_.mkString))
  private val genQuantity: Gen[Int] = Gen.chooseNum(1, 1000000)
  private val genMode: Gen[String] = Gen.oneOf(modeStandard, modeUrgent)
  private val genUuid: Gen[UUID] = Gen.chooseNum(1, 1000000000).map(n =>
    UUID.nameUUIDFromBytes(s"gen-$n".getBytes(java.nio.charset.StandardCharsets.UTF_8)))
  private val genArgs: Gen[StockTransferSagaModule.Args] = for {
    sku <- genSku
    quantity <- genQuantity
    mode <- genMode
  } yield StockTransferSagaModule.Args(warehouseOne, warehouseTwo, sku, quantity, mode)

  private def frameOf(text: String): ByteString =
    StrictWire.lengthPrefixed(text)

  private def argsCodec(): StockTransferArgsCodec = new StockTransferArgsCodec

  private def portIdentity(resource: String): OperationIdentity =
    hostIdentity("flow-" + resource.take(8), resource)

  private def failed(pending: scala.util.Try[_]): Boolean =
    pending.isFailure

  // ---------- StrictWire ----------

  property("StrictWire length-prefixed single field roundtrips exactly") =
    forAll(genText) { text =>
      StrictWire.readPrefixed(frameOf(text), 1) ==
        scala.util.Success((Vector(text), ByteString.EMPTY))
    }

  property("StrictWire multi-field readPrefixed returns fields and remainder") =
    forAll(genText, genText, genText) { (a, b, c) =>
      val bytes = frameOf(a) ++ frameOf(b) ++ frameOf(c) ++ frameOf("tail")
      StrictWire.readPrefixed(bytes, 3) ==
        scala.util.Success((Vector(a, b, c), frameOf("tail")))
    }

  property("negative: StrictWire truncated header fails closed") = secure {
    failed(StrictWire.readPrefixed(ByteString.copyFromUtf8("abc"), 1))
  }

  property("negative: StrictWire truncated field body fails closed") = secure {
    val bytes = ByteString.copyFrom(new Array[Byte](3)) // fake header says huge length
    failed(StrictWire.readPrefixed(bytes, 1))
  }

  property("negative: StrictWire negative field length fails closed") = secure {
    val bytes = ByteString.copyFrom(Array(0xff.toByte, 0xff.toByte, 0xff.toByte, 0xff.toByte))
    failed(StrictWire.readPrefixed(bytes, 1))
  }

  property("StrictWire bounded collection roundtrips under the 64 cap") =
    forAll(Gen.chooseNum(0, 64), genText) { (count, text) =>
      val values = Vector.fill(count)(text)
      StrictWire.readPrefixedAll(StrictWire.lengthPrefixedAll(values)) ==
        scala.util.Success((values, ByteString.EMPTY))
    }

  property("negative: StrictWire bounded collection above the cap is rejected") = secure {
    val values = Vector.fill(65)("x")
    throwsMessage(StrictWire.lengthPrefixedAll(values)) == "bounded collection required"
  }

  property("negative: StrictWire readPrefixedAll requires a 4-byte count header") = secure {
    throwsMessage(StrictWire.readPrefixedAll(ByteString.copyFromUtf8("abc"))) ==
      "bounded collection header required"
  }

  property("StrictWire frozen wire vector matches the oracle hex") = secure {
    SagaEntryOracle.hex(frameOf(skuAlpha).toByteArray) == framedAlpha
  }

  // ---------- ArgsCodec ----------

  property("ArgsCodec canonical roundtrip equals original bytes") =
    forAll(genArgs) { args =>
      val codec = argsCodec()
      val bytes = codec.encode(args)
      codec.decode(bytes).map(codec.encode).get == bytes
    }

  property("ArgsCodec frame order follows the declared args slots") = secure {
    val expected = frameOf(warehouseOne.toString) ++ frameOf(warehouseTwo.toString) ++
      frameOf(skuAlpha) ++ frameOf("30") ++ frameOf(modeStandard)
    argsCodec().encode(standardArgs) == expected
  }

  property("negative: ArgsCodec rejects trailing bytes with the verbatim wire message") = secure {
    val codec = argsCodec()
    val bytes = codec.encode(standardArgs) ++ ByteString.copyFromUtf8("x")
    codec.decode(bytes).failed.get.getMessage == trailingMessage
  }

  property("negative: ArgsCodec rejects short field counts fail-closed") = secure {
    val codec = argsCodec()
    val bytes = frameOf(warehouseOne.toString) ++ frameOf(warehouseTwo.toString)
    codec.decode(bytes).failed.get.getMessage.stripPrefix("requirement failed: ") ==
      "truncated length header"
  }

  property("negative: ArgsCodec rejects malformed uuid text fail-closed") = secure {
    val codec = argsCodec()
    val bytes = frameOf("not-a-uuid") ++ frameOf(warehouseTwo.toString) ++
      frameOf(skuAlpha) ++ frameOf("30") ++ frameOf(modeStandard)
    failed(codec.decode(bytes))
  }

  property("negative: ArgsCodec rejects malformed quantity text fail-closed") = secure {
    val codec = argsCodec()
    val bytes = frameOf(warehouseOne.toString) ++ frameOf(warehouseTwo.toString) ++
      frameOf(skuAlpha) ++ frameOf("not-a-number") ++ frameOf(modeStandard)
    failed(codec.decode(bytes))
  }

  // ---------- receipt codecs ----------

  property("reserve prepare receipt codec roundtrips with pin v1") = secure {
    val codec = SagaEntryFixture.host.reserveSourceStockPrepareBinding.receiptCodec
    val receipt = StockTransferSagaModule.ReserveSourceStockPrepareReceipt(reservationOne, 30)
    codec.pin == reservePreparePin &&
      codec.decode(codec.encode(receipt)).get == receipt
  }

  property("reserve commit receipt codec roundtrips with pin v1") = secure {
    val codec = SagaEntryFixture.host.reserveSourceStockCommitBinding.receiptCodec
    val receipt = StockTransferSagaModule.ReserveSourceStockCommitReceipt(30)
    codec.pin == reserveCommitPin &&
      codec.decode(codec.encode(receipt)).get == receipt
  }

  property("reserve compensate receipt codec roundtrips with pin v1") = secure {
    val codec = SagaEntryFixture.host.reserveSourceStockCompensateBinding.receiptCodec
    val receipt = StockTransferSagaModule.ReserveSourceStockCompensateReceipt(30)
    codec.pin == reserveCompensatePin &&
      codec.decode(codec.encode(receipt)).get == receipt
  }

  property("target prepare receipt codec roundtrips with pin v2") = secure {
    val codec = SagaEntryFixture.host.commitTargetStockPrepareBinding.receiptCodec
    val receipt = StockTransferSagaModule.CommitTargetStockPrepareReceipt(orderTwo, 30)
    codec.pin == targetPreparePin &&
      codec.decode(codec.encode(receipt)).get == receipt
  }

  property("target commit receipt codec roundtrips with pin v1") = secure {
    val codec = SagaEntryFixture.host.commitTargetStockCommitBinding.receiptCodec
    val receipt = StockTransferSagaModule.CommitTargetStockCommitReceipt(30)
    codec.pin == targetCommitPin &&
      codec.decode(codec.encode(receipt)).get == receipt
  }

  property("target compensate receipt codec roundtrips with pin v1") = secure {
    val codec = SagaEntryFixture.host.commitTargetStockCompensateBinding.receiptCodec
    val receipt = StockTransferSagaModule.CommitTargetStockCompensateReceipt(30)
    codec.pin == targetCompensatePin &&
      codec.decode(codec.encode(receipt)).get == receipt
  }

  // ---------- host requirements ----------

  property("requireImplemented accepts the module requirements verbatim") = secure {
    SagaEntryFixture.host.requireImplemented(
      StockTransferSagaModule.requiredHost,
      StockTransferSagaModule.requiredTypes,
      StockTransferSagaModule.requiredArgsCodec)
    true
  }

  property("negative: requireImplemented rejects unsupported capabilities") = secure {
    val mutated = StockTransferSagaModule.requiredHost.copy(
      capabilities = StockTransferSagaModule.requiredHost.capabilities :+
        unsupportedCapability)
    throwsMessage(SagaEntryFixture.host.requireImplemented(mutated,
      StockTransferSagaModule.requiredTypes,
      StockTransferSagaModule.requiredArgsCodec)) == "unsupported capability required to be absent"
  }

  property("negative: requireImplemented rejects decision wiring drift") = secure {
    val mutated = StockTransferSagaModule.requiredHost.copy(commitDecision = "other")
    throwsMessage(SagaEntryFixture.host.requireImplemented(mutated,
      StockTransferSagaModule.requiredTypes,
      StockTransferSagaModule.requiredArgsCodec)) == "commit decision wiring mismatch"
  }

  property("negative: requireImplemented rejects compensation wiring drift") = secure {
    val mutated = StockTransferSagaModule.requiredHost.copy(
      cancelBeforePrepare = "other")
    throwsMessage(SagaEntryFixture.host.requireImplemented(mutated,
      StockTransferSagaModule.requiredTypes,
      StockTransferSagaModule.requiredArgsCodec)) ==
      "cancel-before-prepare wiring mismatch"
  }

  property("negative: requireImplemented rejects non-positive budgets") = secure {
    val mutated = StockTransferSagaModule.requiredHost.copy(maxInFlight = 0)
    throwsMessage(SagaEntryFixture.host.requireImplemented(mutated,
      StockTransferSagaModule.requiredTypes,
      StockTransferSagaModule.requiredArgsCodec)) == "positive budget required"
  }

  property("negative: requireImplemented rejects undeclared invariants") = secure {
    val mutated = StockTransferSagaModule.requiredHost.copy(
      businessInvariants = StockTransferSagaModule.requiredHost.businessInvariants :+
        "other-invariant")
    throwsMessage(SagaEntryFixture.host.requireImplemented(mutated,
      StockTransferSagaModule.requiredTypes,
      StockTransferSagaModule.requiredArgsCodec)) == "undeclared business invariant required"
  }

  property("negative: requireImplemented refuses non-durable manifests") = secure {
    val mutated = StockTransferSagaModule.requiredHost.copy(durableManifest = false)
    throwsMessage(SagaEntryFixture.host.requireImplemented(mutated,
      StockTransferSagaModule.requiredTypes,
      StockTransferSagaModule.requiredArgsCodec)) == "durable manifest required"
  }

  property("negative: requireImplemented rejects args codec pin drift") = secure {
    val mutated = StockTransferSagaModule.requiredArgsCodec.copy(
      runtimePin = CodecPin("drifted-args", 1))
    throwsMessage(SagaEntryFixture.host.requireImplemented(
      StockTransferSagaModule.requiredHost,
      StockTransferSagaModule.requiredTypes, mutated)) ==
      "args codec runtime pin mismatch"
  }

  property("negative: requireImplemented rejects declared type identity drift") = secure {
    val mutated = StockTransferSagaModule.requiredTypes.drop(1)
    throwsMessage(SagaEntryFixture.host.requireImplemented(
      StockTransferSagaModule.requiredHost, mutated,
      StockTransferSagaModule.requiredArgsCodec)) == "declared type identity mismatch"
  }

  // ---------- host identity / settings face ----------

  property("exact-resource addressing renders canonical uuid text") =
    forAll(genUuid) { id =>
      SagaEntryFixture.host.sourceWarehouseResource(id) == id.toString &&
        SagaEntryFixture.host.targetWarehouseResource(id) == id.toString
    }

  property("coordinator settings pin interaction timeout and reconcile budget") = secure {
    val settings = SagaEntryFixture.host.settings
    settings.interactionTimeout == 1000.millis && settings.maxReconcileInteractions == 32
  }

  property("namespace guard accepts strict-saga persistence ids") = secure {
    SagaEntryFixture.host.requireIndependentNamespace(
      PersistenceId.ofUniqueId("strict-saga/any-fixture-pid"))
    true
  }

  property("negative: namespace guard rejects foreign persistence ids") = secure {
    throwsMessage(SagaEntryFixture.host.requireIndependentNamespace(
      PersistenceId.ofUniqueId("other-namespace/pid"))) == "independent strict namespace required"
  }

  // ---------- trigger face ----------

  property("command trigger maps the whole typed command with transfer-id txid") = secure {
    SagaEntryFixture.host.transferStockRequestedTrigger.map(standardCommand) ==
      StockTransferSagaModule.TriggerStart(transferZero.toString, standardArgs)
  }

  property("negative: command trigger rejects oversized sku") = secure {
    val oversized = standardCommand.copy(sku = "s" * 41)
    throwsMessage(SagaEntryFixture.host.transferStockRequestedTrigger.map(oversized)) ==
      "sku outside declared text bounds"
  }

  property("negative: command trigger rejects empty sku") = secure {
    val empty = standardCommand.copy(sku = "")
    throwsMessage(SagaEntryFixture.host.transferStockRequestedTrigger.map(empty)) ==
      "sku outside declared text bounds"
  }

  property("event trigger txid is deterministic 64-hex sha-256") =
    forAll(genSku, genQuantity) { (sku, quantity) =>
      val event = receivedOf(warehouseOne, sku, quantity)
      val first = SagaEntryFixture.host.warehouseStockReceivedTrigger.map(event)
      val second = SagaEntryFixture.host.warehouseStockReceivedTrigger.map(event)
      first.transactionId == second.transactionId && first.transactionId.length == 64 &&
        first.transactionId.forall(c => c.isDigit || (c >= 'a' && c <= 'f'))
    }

  property("event trigger distinct events derive distinct txids") =
    forAll(genSku, genQuantity) { (sku, quantity) =>
      val first = SagaEntryFixture.host.warehouseStockReceivedTrigger.map(
        receivedOf(warehouseOne, sku, quantity))
      val second = SagaEntryFixture.host.warehouseStockReceivedTrigger.map(
        receivedOf(warehouseOne, sku, quantity + 1))
      val third = SagaEntryFixture.host.warehouseStockReceivedTrigger.map(
        receivedOf(warehouseTwo, sku, quantity))
      first.transactionId != second.transactionId &&
        first.transactionId != third.transactionId
    }

  property("event trigger maps the fixture restock shape") =
    forAll(genSku, genQuantity) { (sku, quantity) =>
      val start = SagaEntryFixture.host.warehouseStockReceivedTrigger.map(
        receivedOf(warehouseOne, sku, quantity))
      start.args == StockTransferSagaModule.Args(warehouseOne, warehouseOne, sku, quantity,
        modeStandard)
    }

  // ---------- completion face ----------

  property("completion mapper builds the declared module event") = secure {
    val identity = SagaEntryIdentity()
    val input = StockTransferSagaModule.SucceededCompletionInput(
      identity.transactionId, warehouseOne)
    SagaEntryFixture.host.succeededCompletion.map(identity, input) ==
      StockTransferCompletedEvent(identity.transactionId, warehouseOne)
  }

  property("completion binding contract equals the module contract verbatim") = secure {
    SagaEntryFixture.host.succeededCompletion.contract ==
      StockTransferSagaModule.succeededCompletionContract
  }

  // ---------- entry face ----------

  property("entry persistence id lives in the strict namespace") = secure {
    StockTransferSagaEntry.persistenceId.id == modulePid &&
      StockTransferSagaEntry.NamespacePrefix == namespacePrefix
  }

  property("reconcile authorizer accepts the expected token") = secure {
    FixtureReconcileAuthorizer(reconcileToken).authorize(
      SagaEntryIdentity(), reconcileToken) == Right(reconcilePrincipal)
  }

  property("negative: reconcile authorizer rejects wrong tokens") = secure {
    FixtureReconcileAuthorizer(reconcileToken).authorize(
      SagaEntryIdentity(), wrongToken) == Left(tokenMismatch)
  }

  property("negative: reconcile authorizer rejects null tokens") = secure {
    FixtureReconcileAuthorizer(reconcileToken).authorize(
      SagaEntryIdentity(), null) == Left(tokenMismatch)
  }

  property("negative: reconcile authorizer rejects null expected token") = secure {
    FixtureReconcileAuthorizer(null).authorize(
      SagaEntryIdentity(), reconcileToken) == Left(tokenMismatch)
  }

  property("entry status maps the Status reply") = secure {
    val ref = SagaEntryFixture.spawnCoordinator(reconcileToken)
    val state = SagaEntryFixture.coordinatorStatus(ref)
    state.status == StrictStatus.Empty
  }

  property("negative: entry status fails closed on unexpected replies") = secure {
    val stub = SagaEntryFixture.testKit.spawn(Behaviors.receiveMessage[
      StrictSagaCoordinator.Command] {
      case StrictSagaCoordinator.GetStatus(replyTo) =>
        replyTo ! StrictSagaCoordinator.Denied("stub")
        Behaviors.same
      case _ => Behaviors.same
    }, "status-stub-" + nextWarehouseId.toString)
    val failure = Await.result(
      StockTransferSagaEntry.status(stub)(akka.util.Timeout(5.seconds),
        SagaEntryFixture.testKit.scheduler, ec).failed, 10.seconds)
    SagaEntryFixture.testKit.stop(stub)
    failure.getMessage == "unexpected coordinator reply"
  }

  property("completionEvent maps only the declared succeeded outcome") = secure {
    val identity = SagaEntryIdentity()
    val args = standardArgs
    val host = SagaEntryFixture.host
    val succeeded = StrictState().copy(status = StrictStatus.Succeeded,
      identity = Some(identity))
    val preparing = StrictState().copy(status = StrictStatus.Preparing,
      identity = Some(identity))
    val aborted = StrictState().copy(status = StrictStatus.Aborted, identity = Some(identity))
    StockTransferSagaEntry.completionEvent(identity, args, host, succeeded).isDefined &&
      StockTransferSagaEntry.completionEvent(identity, args, host, preparing).isEmpty &&
      StockTransferSagaEntry.completionEvent(identity, args, host, aborted).isEmpty
  }

  property("negative: publishCompletion refuses non-terminal states") = secure {
    val identity = SagaEntryIdentity()
    val state = StrictState().copy(status = StrictStatus.Preparing,
      identity = Some(identity))
    throwsMessage(StockTransferSagaEntry.publishCompletion(SagaEntryFixture.sharding,
      SagaEntryFixture.host, state)(akka.util.Timeout(5.seconds),
      SagaEntryFixture.testKit.scheduler, ec)) == "terminal state required"
  }

  // ---------- real cluster flows ----------

  private def freshCoordinator(token: String): ActorRef[StrictSagaCoordinator.Command] =
    SagaEntryFixture.spawnCoordinator(token)

  private def terminalOrHalted(state: StrictState): Boolean =
    state.terminal || state.status == StrictStatus.RecoveryRequired

  private def sourceConserved(sourceState: WarehouseState): Boolean =
    sourceState.available.getOrElse(skuAlpha, 0) == 70 &&
      sourceState.committed.get(transferZero.toString).contains(30)

  private def targetSettled(targetState: WarehouseState): Boolean =
    targetState.available.getOrElse(skuAlpha, 0) == 130 &&
      targetState.settled.get(transferZero.toString).contains(30)

  private def settledAndConserved(state: StrictState, sourceState: WarehouseState,
      targetState: WarehouseState): Boolean =
    state.terminal && state.status == StrictStatus.Succeeded &&
      sourceConserved(sourceState) && targetSettled(targetState)

  private def recoveryHalted(halted: StrictState, denied: StrictSagaCoordinator.Reply): Boolean =
    halted.status == StrictStatus.RecoveryRequired &&
      denied == StrictSagaCoordinator.Denied(tokenMismatch)

  private def recoveryResumed(resumed: StrictState, sourceState: WarehouseState,
      targetState: WarehouseState): Boolean =
    resumed.terminal && resumed.status == StrictStatus.Succeeded &&
      sourceConserved(sourceState) && targetSettled(targetState)

  private def recoveryHaltedThenResumed(halted: StrictState,
      denied: StrictSagaCoordinator.Reply, resumed: StrictState,
      sourceState: WarehouseState, targetState: WarehouseState): Boolean =
    recoveryHalted(halted, denied) && recoveryResumed(resumed, sourceState, targetState)

  property("full stock-transfer saga settles both warehouses and publishes") = secure {
    val source = nextWarehouseId
    val target = nextWarehouseId
    SagaEntryFixture.seedWarehouse(source, skuAlpha, 100)
    SagaEntryFixture.seedWarehouse(target, skuAlpha, 100)
    val ref = freshCoordinator(reconcileToken)
    val command = commandOf(transferZero, source, target, skuAlpha, 30, modeStandard)
    SagaEntryFixture.startCommand(ref, command)
    val state = SagaEntryFixture.awaitStable(ref, 60.seconds)
    val sourceState = SagaEntryFixture.stateOfWarehouse(source)
    val targetState = SagaEntryFixture.stateOfWarehouse(target)
    settledAndConserved(state, sourceState, targetState)
  }

  property("publication acks idempotently and records the completion once") = secure {
    val source = nextWarehouseId
    val target = nextWarehouseId
    SagaEntryFixture.seedWarehouse(source, skuAlpha, 100)
    SagaEntryFixture.seedWarehouse(target, skuAlpha, 100)
    val ref = freshCoordinator(reconcileToken)
    SagaEntryFixture.startCommand(ref,
      commandOf(transferZero, source, target, skuAlpha, 30, modeStandard))
    val state = SagaEntryFixture.awaitStable(ref, 60.seconds)
    val published = Await.result(StockTransferSagaEntry.publishCompletion(
      SagaEntryFixture.sharding, SagaEntryFixture.host, state)(
      akka.util.Timeout(5.seconds), SagaEntryFixture.testKit.scheduler, ec), 10.seconds)
    val repeated = Await.result(StockTransferSagaEntry.publishCompletion(
      SagaEntryFixture.sharding, SagaEntryFixture.host, state)(
      akka.util.Timeout(5.seconds), SagaEntryFixture.testKit.scheduler, ec), 10.seconds)
    val sourceState = SagaEntryFixture.stateOfWarehouse(source)
    published.result.isRight && repeated.result.isRight &&
      published.result.toOption.get.transactionId == transferZero.toString &&
      sourceState.completedTransfers.count(_ == transferZero.toString) == 1
  }

  property("insufficient source stock aborts with untouched reservations") = secure {
    val source = nextWarehouseId
    val target = nextWarehouseId
    SagaEntryFixture.seedWarehouse(source, skuAlpha, 10)
    SagaEntryFixture.seedWarehouse(target, skuAlpha, 100)
    val ref = freshCoordinator(reconcileToken)
    SagaEntryFixture.startCommand(ref,
      commandOf(transferZero, source, target, skuAlpha, 30, modeStandard))
    val state = SagaEntryFixture.awaitStable(ref, 60.seconds)
    val sourceState = SagaEntryFixture.stateOfWarehouse(source)
    terminalOrHalted(state) &&
      sourceState.reserved.get(transferZero.toString).isEmpty &&
      sourceState.available.getOrElse(skuAlpha, 0) == 10
  }

  property("first-persist failure folds to Unknown and recovers under authorization") = secure {
    val source = nextWarehouseId
    val target = nextWarehouseId
    SagaEntryFixture.seedWarehouse(source, skuAlpha, 100)
    SagaEntryFixture.seedWarehouse(target, skuAlpha, 100)
    SagaEntryFixture.stateOfWarehouse(source) // spawn the source entity before arming
    akka.persistence.testkit.scaladsl.PersistenceTestKit(SagaEntryFixture.testKit.system)
      .failNextPersisted(SagaEntryFixture.warehousePid(source))
    val ref = freshCoordinator(reconcileToken)
    SagaEntryFixture.startCommand(ref,
      commandOf(transferZero, source, target, skuAlpha, 30, modeStandard))
    val halted = SagaEntryFixture.awaitStable(ref, 60.seconds)
    val identity = halted.identity.get
    val denied = {
      val probe = SagaEntryFixture.testKit.createTestProbe[StrictSagaCoordinator.Reply]()
      ref ! StrictSagaCoordinator.Reconcile(identity, wrongToken, 32, probe.ref)
      probe.receiveMessage(10.seconds)
    }
    val resumed = {
      val probe = SagaEntryFixture.testKit.createTestProbe[StrictSagaCoordinator.Reply]()
      ref ! StrictSagaCoordinator.Reconcile(identity, reconcileToken, 32, probe.ref)
      probe.receiveMessage(10.seconds)
      SagaEntryFixture.awaitStable(ref, 60.seconds)
    }
    val sourceState = SagaEntryFixture.stateOfWarehouse(source)
    val targetState = SagaEntryFixture.stateOfWarehouse(target)
    recoveryHaltedThenResumed(halted, denied, resumed, sourceState, targetState)
  }

  property("duplicate start with identical args stays idempotent") = secure {
    val source = nextWarehouseId
    val target = nextWarehouseId
    SagaEntryFixture.seedWarehouse(source, skuAlpha, 100)
    SagaEntryFixture.seedWarehouse(target, skuAlpha, 100)
    val ref = freshCoordinator(reconcileToken)
    val command = commandOf(transferZero, source, target, skuAlpha, 30, modeStandard)
    val first = SagaEntryFixture.startCommand(ref, command)
    val second = SagaEntryFixture.startCommand(ref, command)
    val conflicting = SagaEntryFixture.startCommand(ref,
      commandOf(transferZero, source, target, skuAlpha, 50, modeStandard))
    !first.isInstanceOf[StrictSagaCoordinator.Denied] &&
      !second.isInstanceOf[StrictSagaCoordinator.ConflictingIdentity.type] &&
      conflicting == StrictSagaCoordinator.ConflictingIdentity
  }

  property("reconcile short-circuits a healthy terminal state with its status") = secure {
    val source = nextWarehouseId
    val target = nextWarehouseId
    SagaEntryFixture.seedWarehouse(source, skuAlpha, 100)
    SagaEntryFixture.seedWarehouse(target, skuAlpha, 100)
    val ref = freshCoordinator(reconcileToken)
    SagaEntryFixture.startCommand(ref,
      commandOf(transferZero, source, target, skuAlpha, 30, modeStandard))
    val state = SagaEntryFixture.awaitStable(ref, 60.seconds)
    val probe = SagaEntryFixture.testKit.createTestProbe[StrictSagaCoordinator.Reply]()
    ref ! StrictSagaCoordinator.Reconcile(state.identity.get, reconcileToken, 32, probe.ref)
    val reply = probe.receiveMessage(10.seconds)
    reply == StrictSagaCoordinator.Status(state)
  }

  property("cluster singleton spawn exposes the same coordinator face") = secure {
    import akka.actor.typed.scaladsl.AskPattern._
    val ref = StockTransferSagaEntry.spawnClusterSingleton(SagaEntryFixture.testKit.system,
      SagaEntryFixture.sharding, reconcileToken)
    val reply = Await.result(ref.ask[StrictSagaCoordinator.Reply](
      StrictSagaCoordinator.GetStatus(_))(30.seconds, SagaEntryFixture.testKit.scheduler),
      40.seconds)
    reply == StrictSagaCoordinator.Status(StrictState())
  }
}

/** 相位身份构造助手（Support 层）：真实协调器恢复流需要真实 TransactionIdentity。 */
object SagaEntryIdentity {
  private val counter = new java.util.concurrent.atomic.AtomicInteger(9000)
  def apply(): TransactionIdentity =
    TransactionIdentity(s"flow-${counter.incrementAndGet()}", StockTransferSagaModule.name,
      StockTransferSagaModule.version, "args-digest-fixture",
      StockTransferSagaModule.definitionDigest, StockTransferSagaModule.argsPin,
      "plan-digest-fixture")
}
