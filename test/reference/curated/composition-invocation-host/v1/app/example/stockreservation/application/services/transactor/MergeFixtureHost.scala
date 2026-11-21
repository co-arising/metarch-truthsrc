package example.stockreservation.application.services.transactor

import akka.actor.typed.{ActorRef, ActorSystem, Scheduler}
import akka.actor.typed.scaladsl.AskPattern._
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.persistence.typed.PersistenceId
import akka.util.Timeout
import com.google.protobuf.ByteString
import example.stockreservation.application.aggregates.LotProtocol
import example.stockreservation.domain.entities.LotState
import example.stockreservation.domain.events.LotTransferCompletedEvent
import net.imadz.infra.saga.strict._
import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Try}
import StrictWire._

/** 手写 fixture host（#42 组合供给，#41 族形状）：WaferMergeSagaModule.Host 的
  * 生产实现——canonical args codec、fail-closed 合同校验、exact-resource 寻址
  * （lot 资源是有界文本 id，寻址恒等；#40 族 UUID 资源规则的记档偏离）、逐相位
  * ask/证据重读、收据 wire 编解码（六命名 codec 类）、触发器映射（含边界护栏）
  * 与完成映射。lot 资源不走 UUID：WaferLot 的 exact-resource 就是 lot id 字符串。 */
object MergeFixtureHost {

  /** 固定运行能力集（raw B01 顺序）＋模块 HostRequirements 要求的三项能力
    * （#41 F13 同款修正）。 */
  val SupportedCapabilities: Set[String] = Set(
    "durable-commit-decision", "durable-abort-decision", "typed-nonterminal-unknown",
    "safe-status-reattach", "receipt-reconciliation", "participant-idempotency-query",
    "pinned-definition-codec", "manual-evidence-authorization", "cancel-before-prepare-fencing",
    "durable-manifest", "durable-receipt", "exact-resource-addressing",
    "read-only-evidence-query")

  val DeclaredInvariants: Set[String] = Set("wafer-conservation")
}

final class MergeFixtureHost(system: ActorSystem[_], sharding: ClusterSharding)(
    implicit ec: ExecutionContext
) extends WaferMergeSagaModule.Host {
  import WaferMergeSagaModule._
  import MergeFixtureHost._

  private val canonicalArgsCodec = new WaferMergeArgsCodec
  private implicit val askTimeout: Timeout = Timeout(settings.interactionTimeout)
  private implicit val askScheduler: Scheduler = system.scheduler

  def argsCodec: PayloadCodec[Args] = canonicalArgsCodec

  def settings: StrictSagaCoordinator.Settings =
    StrictSagaCoordinator.Settings(FiniteDuration(1000, "millis"), 32)

  def requireImplemented(
      requirements: HostRequirements,
      types: Vector[TypeContract],
      argsCodec: ArgsCodecContract
  ): Unit = {
    requireUnsupported(requirements)
    requireSafetyWiring(requirements)
    requireBudgets(requirements)
    require(requirements.durableManifest, "durable manifest required")
    requireDeclaredInvariants(requirements)
    require(argsCodec.runtimePin == argsPin, "args codec runtime pin mismatch")
    requireDeclaredTypes(types)
  }

  private def requireUnsupported(requirements: HostRequirements): Unit =
    require(requirements.capabilities.filterNot(SupportedCapabilities.contains).isEmpty,
      "unsupported capability required to be absent")

  private def requireSafetyWiring(requirements: HostRequirements): Unit = {
    requireDecisionWiring(requirements)
    requireCompensationWiring(requirements)
  }

  private def requireDecisionWiring(requirements: HostRequirements): Unit = {
    require(requirements.commitDecision == "durable-before-commit",
      "commit decision wiring mismatch")
    require(requirements.abortDecision == "durable-before-compensate",
      "abort decision wiring mismatch")
    require(requirements.afterCommit == "forward-recovery", "after-commit wiring mismatch")
    require(requirements.unknown == "reconcile-before-resume", "unknown wiring mismatch")
  }

  private def requireCompensationWiring(requirements: HostRequirements): Unit = {
    require(requirements.compensation == "confirmed-reservations",
      "compensation wiring mismatch")
    require(requirements.cancelBeforePrepare == "empty-release-and-fence",
      "cancel-before-prepare wiring mismatch")
    require(requirements.retryIdentity == "stable-operation", "retry identity wiring mismatch")
    require(requirements.manualRecovery == "authorized-reconciliation-evidence",
      "manual recovery wiring mismatch")
  }

  private def requireBudgets(requirements: HostRequirements): Unit =
    Vector(requirements.totalDeadlineMs, requirements.maxParticipants, requirements.maxInFlight,
      requirements.maxAttempts, requirements.phaseTimeoutMs, requirements.queryTimeoutMs)
      .foreach(value => require(value > 0, "positive budget required"))

  private def requireDeclaredInvariants(requirements: HostRequirements): Unit =
    require(requirements.businessInvariants.forall(DeclaredInvariants.contains),
      "undeclared business invariant required")

  private def requireDeclaredTypes(types: Vector[TypeContract]): Unit =
    require(types.map(_.id).toSet == declaredTypeIds, "declared type identity mismatch")

  private val declaredTypeIds = Set("transaction-id", "lot-id", "wafer-list", "manifest", "count")

  def requireIndependentNamespace(persistenceId: PersistenceId): Unit =
    require(persistenceId.id.startsWith("strict-saga/"), "independent strict namespace required")

  // pure exact-resource addressing; no I/O (lot ids are bounded text, identity form)
  def fromLotResource(resource: String): String = resource

  // pure exact-resource addressing; no I/O
  def toLotResource(resource: String): String = resource

  def fromLotResourceContract: AddressContract =
    WaferMergeSagaModule.fromLotResourceContract

  def toLotResourceContract: AddressContract =
    WaferMergeSagaModule.toLotResourceContract

  def removeFromLotPrepareBinding: RemoveFromLotPrepareHostBinding =
    new RemoveFromLotPrepareBinding

  def removeFromLotCommitBinding: RemoveFromLotCommitHostBinding =
    new RemoveFromLotCommitBinding

  def removeFromLotCompensateBinding: RemoveFromLotCompensateHostBinding =
    new RemoveFromLotCompensateBinding

  def addToLotPrepareBinding: AddToLotPrepareHostBinding =
    new AddToLotPrepareBinding

  def addToLotCommitBinding: AddToLotCommitHostBinding =
    new AddToLotCommitBinding

  def addToLotCompensateBinding: AddToLotCompensateHostBinding =
    new AddToLotCompensateBinding

  def waferTransferRequestedTrigger: WaferTransferRequestedTriggerBinding =
    new WaferTransferRequestedTrigger

  def succeededCompletion: SucceededCompletionBinding = new SucceededCompletionMapper

  private def lotEntityRef(id: String) =
    sharding.entityRefFor(LotProtocol.entityKey, id)

  private def lotReplyAsk(
      id: String,
      construct: ActorRef[LotProtocol.LotReply] => LotProtocol.LotCommand
  ): Future[LotProtocol.LotReply] =
    lotEntityRef(id).ask(construct)

  private def lotStateAsk(id: String): Future[LotState] =
    lotEntityRef(id).ask(replyTo => LotProtocol.GetLotState(replyTo))

  private def refusedEvidence(error: LotProtocol.OperationError): String =
    s"refused ${error.code} ${error.message}; no events persisted"

  private def absentMarkEvidence(step: String, transactionId: String): String =
    s"no durable $step mark for transaction $transactionId (controlled profile only)"

  private def requireBoundedText(
      label: String, value: String, minLength: Int, maxLength: Int): Unit =
    require(value != null && value.length >= minLength && value.length <= maxLength,
      s"$label outside declared text bounds")

  private def requireBoundedList(
      label: String, value: List[String], minLength: Int, maxLength: Int): Unit =
    require(value != null && value.size >= minLength && value.size <= maxLength &&
      value.forall(wafer => wafer != null && wafer.nonEmpty),
      s"$label outside declared collection bounds")

  final class WaferMergeArgsCodec extends PayloadCodec[WaferMergeSagaModule.Args] {
    override val pin: CodecPin = CodecPin("wafer-transfer-merge-args", 1)
    override def encode(value: WaferMergeSagaModule.Args): ByteString =
      StrictWire.lengthPrefixed(value.txid) ++
        StrictWire.lengthPrefixed(value.from) ++
        StrictWire.lengthPrefixed(value.to) ++
        StrictWire.lengthPrefixedAll(value.wafers.toVector) ++
        StrictWire.lengthPrefixed(value.manifest)
    override def decode(bytes: ByteString): Try[WaferMergeSagaModule.Args] =
      StrictWire.readPrefixed(bytes, 3).flatMap {
        case (Vector(txid, from, to), rest) =>
          StrictWire.readPrefixedAll(rest).flatMap {
            case (wafers, rest2) =>
              StrictWire.readPrefixed(rest2, 1).flatMap {
                case (Vector(manifest), rest3) =>
                  if (rest3.isEmpty)
                    Try(WaferMergeSagaModule.Args(txid, from, to, wafers.toList, manifest))
                  else Failure(new IllegalArgumentException(
                    "what wire: trailing bytes after the declared fields"))
                case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
              }
            case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
          }
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class RemoveFromLotPrepareReceiptCodec
      extends PayloadCodec[RemoveFromLotPrepareReceipt] {
    override val pin: CodecPin = CodecPin("wafer-transfer-merge-remove-from-lot-prepare", 1)
    override def encode(value: RemoveFromLotPrepareReceipt): ByteString =
      StrictWire.lengthPrefixedAll(value.wafers.toVector)
    override def decode(bytes: ByteString): Try[RemoveFromLotPrepareReceipt] =
      StrictWire.readPrefixedAll(bytes).flatMap { case (wafers, rest) =>
        if (rest.isEmpty) Try(RemoveFromLotPrepareReceipt(wafers.toList))
        else Failure(new IllegalArgumentException(
          "what wire: trailing bytes after the declared fields"))
      }
  }

  private final class RemoveFromLotCommitReceiptCodec
      extends PayloadCodec[RemoveFromLotCommitReceipt] {
    override val pin: CodecPin = CodecPin("wafer-transfer-merge-remove-from-lot-commit", 1)
    override def encode(value: RemoveFromLotCommitReceipt): ByteString =
      StrictWire.lengthPrefixed(value.removedCount.toString)
    override def decode(bytes: ByteString): Try[RemoveFromLotCommitReceipt] =
      StrictWire.readPrefixed(bytes, 1).flatMap {
        case (Vector(first), rest) =>
          if (rest.isEmpty) Try(RemoveFromLotCommitReceipt(first.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class RemoveFromLotCompensateReceiptCodec
      extends PayloadCodec[RemoveFromLotCompensateReceipt] {
    override val pin: CodecPin = CodecPin("wafer-transfer-merge-remove-from-lot-compensate", 1)
    override def encode(value: RemoveFromLotCompensateReceipt): ByteString =
      StrictWire.lengthPrefixed(value.restoredCount.toString)
    override def decode(bytes: ByteString): Try[RemoveFromLotCompensateReceipt] =
      StrictWire.readPrefixed(bytes, 1).flatMap {
        case (Vector(first), rest) =>
          if (rest.isEmpty) Try(RemoveFromLotCompensateReceipt(first.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class AddToLotPrepareReceiptCodec
      extends PayloadCodec[AddToLotPrepareReceipt] {
    override val pin: CodecPin = CodecPin("wafer-transfer-merge-add-to-lot-prepare", 1)
    override def encode(value: AddToLotPrepareReceipt): ByteString =
      StrictWire.lengthPrefixedAll(value.wafers.toVector)
    override def decode(bytes: ByteString): Try[AddToLotPrepareReceipt] =
      StrictWire.readPrefixedAll(bytes).flatMap { case (wafers, rest) =>
        if (rest.isEmpty) Try(AddToLotPrepareReceipt(wafers.toList))
        else Failure(new IllegalArgumentException(
          "what wire: trailing bytes after the declared fields"))
      }
  }

  private final class AddToLotCommitReceiptCodec
      extends PayloadCodec[AddToLotCommitReceipt] {
    override val pin: CodecPin = CodecPin("wafer-transfer-merge-add-to-lot-commit", 1)
    override def encode(value: AddToLotCommitReceipt): ByteString =
      StrictWire.lengthPrefixed(value.addedCount.toString)
    override def decode(bytes: ByteString): Try[AddToLotCommitReceipt] =
      StrictWire.readPrefixed(bytes, 1).flatMap {
        case (Vector(first), rest) =>
          if (rest.isEmpty) Try(AddToLotCommitReceipt(first.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class AddToLotCompensateReceiptCodec
      extends PayloadCodec[AddToLotCompensateReceipt] {
    override val pin: CodecPin = CodecPin("wafer-transfer-merge-add-to-lot-compensate", 1)
    override def encode(value: AddToLotCompensateReceipt): ByteString =
      StrictWire.lengthPrefixed(value.restoredCount.toString)
    override def decode(bytes: ByteString): Try[AddToLotCompensateReceipt] =
      StrictWire.readPrefixed(bytes, 1).flatMap {
        case (Vector(first), rest) =>
          if (rest.isEmpty) Try(AddToLotCompensateReceipt(first.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class RemoveFromLotPrepareBinding
      extends RemoveFromLotPrepareHostBinding {
    private val codec = new RemoveFromLotPrepareReceiptCodec
    def contract: PhaseContract = removeFromLotPrepareBindingContract
    def receiptCodec: PayloadCodec[RemoveFromLotPrepareReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: RemoveFromLotPrepareInput
    ): Future[PhaseOutcome[RemoveFromLotPrepareReceipt]] =
      lotReplyAsk(identity.resource, replyTo =>
        LotProtocol.ReserveWaferRemoval(input.transactionId, input.from, input.wafers, replyTo)
      ).map { reply =>
        reply.error match {
          case Some(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case None => ConfirmedReceipt(identity, RemoveFromLotPrepareReceipt(input.wafers))
        }
      }.recover { case throwable =>
        Unknown(identity, s"reserve-wafer-removal interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: RemoveFromLotPrepareInput
    ): Future[PhaseOutcome[RemoveFromLotPrepareReceipt]] =
      lotStateAsk(identity.resource).map { state =>
        state.removalReservations.get(input.transactionId).map(wafers =>
          ConfirmedReceipt(identity, RemoveFromLotPrepareReceipt(wafers))).getOrElse(
          NotExecuted(identity, absentMarkEvidence("removal-reserve", input.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"remove-from-lot evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class RemoveFromLotCommitBinding
      extends RemoveFromLotCommitHostBinding {
    private val codec = new RemoveFromLotCommitReceiptCodec
    def contract: PhaseContract = removeFromLotCommitBindingContract
    def receiptCodec: PayloadCodec[RemoveFromLotCommitReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: RemoveFromLotCommitInput
    ): Future[PhaseOutcome[RemoveFromLotCommitReceipt]] =
      lotReplyAsk(identity.resource, replyTo =>
        LotProtocol.CommitWaferRemoval(identity.transaction.transactionId, identity.resource,
          replyTo)
      ).map { reply =>
        reply.error match {
          case Some(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case None => ConfirmedReceipt(identity,
            RemoveFromLotCommitReceipt(input.wafers.size))
        }
      }.recover { case throwable =>
        Unknown(identity, s"commit-wafer-removal interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: RemoveFromLotCommitInput
    ): Future[PhaseOutcome[RemoveFromLotCommitReceipt]] =
      lotStateAsk(identity.resource).map { state =>
        state.committedRemovals.get(identity.transaction.transactionId).map(count =>
          ConfirmedReceipt(identity, RemoveFromLotCommitReceipt(count))).getOrElse(
          NotExecuted(identity,
            absentMarkEvidence("removal-commit", identity.transaction.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"remove-from-lot evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class RemoveFromLotCompensateBinding
      extends RemoveFromLotCompensateHostBinding {
    private val codec = new RemoveFromLotCompensateReceiptCodec
    def contract: PhaseContract = removeFromLotCompensateBindingContract
    def receiptCodec: PayloadCodec[RemoveFromLotCompensateReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: RemoveFromLotCompensateInput
    ): Future[PhaseOutcome[RemoveFromLotCompensateReceipt]] =
      lotReplyAsk(identity.resource, replyTo =>
        LotProtocol.RestoreWaferRemoval(identity.transaction.transactionId, identity.resource,
          replyTo)
      ).map { reply =>
        reply.error match {
          case Some(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case None => ConfirmedReceipt(identity,
            RemoveFromLotCompensateReceipt(input.wafers.size))
        }
      }.recover { case throwable =>
        Unknown(identity, s"restore-wafer-removal interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: RemoveFromLotCompensateInput
    ): Future[PhaseOutcome[RemoveFromLotCompensateReceipt]] =
      lotStateAsk(identity.resource).map { state =>
        state.restoredRemovals.get(identity.transaction.transactionId).map(count =>
          ConfirmedReceipt(identity, RemoveFromLotCompensateReceipt(count))).getOrElse(
          NotExecuted(identity,
            absentMarkEvidence("removal-restore", identity.transaction.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"remove-from-lot evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class AddToLotPrepareBinding
      extends AddToLotPrepareHostBinding {
    private val codec = new AddToLotPrepareReceiptCodec
    def contract: PhaseContract = addToLotPrepareBindingContract
    def receiptCodec: PayloadCodec[AddToLotPrepareReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: AddToLotPrepareInput
    ): Future[PhaseOutcome[AddToLotPrepareReceipt]] =
      lotReplyAsk(identity.resource, replyTo =>
        LotProtocol.ReserveWaferAddition(input.transactionId, input.to, input.wafers, replyTo)
      ).map { reply =>
        reply.error match {
          case Some(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case None => ConfirmedReceipt(identity, AddToLotPrepareReceipt(input.wafers))
        }
      }.recover { case throwable =>
        Unknown(identity, s"reserve-wafer-addition interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: AddToLotPrepareInput
    ): Future[PhaseOutcome[AddToLotPrepareReceipt]] =
      lotStateAsk(identity.resource).map { state =>
        state.additionReservations.get(input.transactionId).map(wafers =>
          ConfirmedReceipt(identity, AddToLotPrepareReceipt(wafers))).getOrElse(
          NotExecuted(identity, absentMarkEvidence("addition-reserve", input.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"add-to-lot evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class AddToLotCommitBinding
      extends AddToLotCommitHostBinding {
    private val codec = new AddToLotCommitReceiptCodec
    def contract: PhaseContract = addToLotCommitBindingContract
    def receiptCodec: PayloadCodec[AddToLotCommitReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: AddToLotCommitInput
    ): Future[PhaseOutcome[AddToLotCommitReceipt]] =
      lotReplyAsk(identity.resource, replyTo =>
        LotProtocol.CommitWaferAddition(identity.transaction.transactionId, identity.resource,
          replyTo)
      ).map { reply =>
        reply.error match {
          case Some(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case None => ConfirmedReceipt(identity,
            AddToLotCommitReceipt(input.wafers.size))
        }
      }.recover { case throwable =>
        Unknown(identity, s"commit-wafer-addition interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: AddToLotCommitInput
    ): Future[PhaseOutcome[AddToLotCommitReceipt]] =
      lotStateAsk(identity.resource).map { state =>
        state.committedAdditions.get(identity.transaction.transactionId).map(count =>
          ConfirmedReceipt(identity, AddToLotCommitReceipt(count))).getOrElse(
          NotExecuted(identity,
            absentMarkEvidence("addition-commit", identity.transaction.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"add-to-lot evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class AddToLotCompensateBinding
      extends AddToLotCompensateHostBinding {
    private val codec = new AddToLotCompensateReceiptCodec
    def contract: PhaseContract = addToLotCompensateBindingContract
    def receiptCodec: PayloadCodec[AddToLotCompensateReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: AddToLotCompensateInput
    ): Future[PhaseOutcome[AddToLotCompensateReceipt]] =
      lotReplyAsk(identity.resource, replyTo =>
        LotProtocol.RestoreWaferAddition(identity.transaction.transactionId, identity.resource,
          replyTo)
      ).map { reply =>
        reply.error match {
          case Some(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case None => ConfirmedReceipt(identity,
            AddToLotCompensateReceipt(input.wafers.size))
        }
      }.recover { case throwable =>
        Unknown(identity, s"restore-wafer-addition interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: AddToLotCompensateInput
    ): Future[PhaseOutcome[AddToLotCompensateReceipt]] =
      lotStateAsk(identity.resource).map { state =>
        state.restoredAdditions.get(identity.transaction.transactionId).map(count =>
          ConfirmedReceipt(identity, AddToLotCompensateReceipt(count))).getOrElse(
          NotExecuted(identity,
            absentMarkEvidence("addition-restore", identity.transaction.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"add-to-lot evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class WaferTransferRequestedTrigger extends WaferTransferRequestedTriggerBinding {
    def contract: TriggerContract = waferTransferRequestedTriggerContract
    def map(source: LotProtocol.StartTransfer): TriggerStart = {
      requireBoundedText("transaction id", source.txid, 1, 64)
      requireBoundedText("from lot id", source.from, 1, 64)
      requireBoundedText("to lot id", source.to, 1, 64)
      requireBoundedText("manifest", source.manifest, 1, 64)
      requireBoundedList("wafers", source.wafers, 1, 64)
      TriggerStart(source.txid, Args(source.txid, source.from, source.to,
        source.wafers, source.manifest))
    }
  }

  private final class SucceededCompletionMapper extends SucceededCompletionBinding {
    def contract: CompletionContract = succeededCompletionContract
    def map(identity: TransactionIdentity,
        input: SucceededCompletionInput): LotTransferCompletedEvent =
      LotTransferCompletedEvent(input.transactionId, input.from, input.to)
  }
}
