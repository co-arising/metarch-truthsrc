package example.stockreservation.application.services.transactor

import akka.actor.typed.{ActorRef, ActorSystem, Scheduler}
import akka.actor.typed.scaladsl.AskPattern._
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.persistence.typed.PersistenceId
import akka.util.Timeout
import com.google.protobuf.ByteString
import example.stockreservation.application.aggregates.{TransferStockCommand, WarehouseProtocol}
import example.stockreservation.domain.entities.WarehouseState
import example.stockreservation.domain.events.{StockReceivedEvent, StockTransferCompletedEvent}
import net.imadz.infra.saga.strict._
import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Try}
import StrictWire._

/** Generated fixture host family (strict-fixture-host): the technical host for
  * the admitted stock-transfer saga module. NOT an authentication or production
  * service. Every phase interaction re-derives its ask from the transaction
  * identity resource (exact-resource addressing), builds receipts from the
  * aggregate reply payload (F8 ruling) and re-reads them from the durable
  * per-phase mark maps (F10 ruling); refusal replies fold to NotExecuted with
  * safeToRetry=true, any interaction failure folds to Unknown. Aggregate
  * refusal never persists events. Receipt codecs pin the module codec ids
  * verbatim (target prepare rides pin version 2). All structural obligations
  * of the module Host trait fail closed. */
object FixtureHost {

  /** The fixed runtime capability set (raw B01 order) plus the three capability
    * names the admitted module's HostRequirements demands — a fixture-host
    * profile amendment (F13): the raw template's CreditBalance module demanded
    * none beyond the fixed ten, but this module's requiredHost declares
    * durable-receipt / exact-resource-addressing / read-only-evidence-query,
    * and requireImplemented filters the requirement against this set. */
  val SupportedCapabilities: Set[String] = Set(
    "durable-commit-decision", "durable-abort-decision", "typed-nonterminal-unknown",
    "safe-status-reattach", "receipt-reconciliation", "participant-idempotency-query",
    "pinned-definition-codec", "manual-evidence-authorization", "cancel-before-prepare-fencing",
    "durable-manifest", "durable-receipt", "exact-resource-addressing",
    "read-only-evidence-query")

  val DeclaredInvariants: Set[String] = Set("reservation-conservation")
}

final class FixtureHost(system: ActorSystem[_], sharding: ClusterSharding)(
    implicit ec: ExecutionContext
) extends StockTransferSagaModule.Host {
  import StockTransferSagaModule._
  import FixtureHost._

  private val canonicalArgsCodec = new StockTransferArgsCodec
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

  private val declaredTypeIds = Set("transaction-id", "warehouse-id", "sku", "quantity",
    "transfer-mode", "transfer-id")

  def requireIndependentNamespace(persistenceId: PersistenceId): Unit =
    require(persistenceId.id.startsWith("strict-saga/"), "independent strict namespace required")

  // pure exact-resource addressing; no I/O
  def sourceWarehouseResource(resource: java.util.UUID): String = resource.toString

  // pure exact-resource addressing; no I/O
  def targetWarehouseResource(resource: java.util.UUID): String = resource.toString

  def sourceWarehouseResourceContract: AddressContract =
    StockTransferSagaModule.sourceWarehouseResourceContract

  def targetWarehouseResourceContract: AddressContract =
    StockTransferSagaModule.targetWarehouseResourceContract

  def reserveSourceStockPrepareBinding: ReserveSourceStockPrepareHostBinding =
    new ReserveSourceStockPrepareBinding

  def reserveSourceStockCommitBinding: ReserveSourceStockCommitHostBinding =
    new ReserveSourceStockCommitBinding

  def reserveSourceStockCompensateBinding: ReserveSourceStockCompensateHostBinding =
    new ReserveSourceStockCompensateBinding

  def commitTargetStockPrepareBinding: CommitTargetStockPrepareHostBinding =
    new CommitTargetStockPrepareBinding

  def commitTargetStockCommitBinding: CommitTargetStockCommitHostBinding =
    new CommitTargetStockCommitBinding

  def commitTargetStockCompensateBinding: CommitTargetStockCompensateHostBinding =
    new CommitTargetStockCompensateBinding

  def transferStockRequestedTrigger: TransferStockRequestedTriggerBinding =
    new TransferStockRequestedTrigger

  def warehouseStockReceivedTrigger: WarehouseStockReceivedTriggerBinding =
    new WarehouseStockReceivedTrigger

  def succeededCompletion: SucceededCompletionBinding = new SucceededCompletionMapper

  private def warehouseEntityRef(id: String) =
    sharding.entityRefFor(WarehouseProtocol.entityKey, id)

  private def warehouseReplyAsk[R](
      id: String,
      construct: ActorRef[WarehouseProtocol.PhaseReply[R]] => WarehouseProtocol.WarehouseCommand
  ): Future[WarehouseProtocol.PhaseReply[R]] =
    warehouseEntityRef(id).ask(construct)

  private def warehouseStateAsk(id: String): Future[WarehouseState] =
    warehouseEntityRef(id).ask(replyTo => WarehouseProtocol.GetWarehouseState(replyTo))

  private def refusedEvidence(error: WarehouseProtocol.OperationError): String =
    s"refused ${error.code} ${error.message}; no events persisted"

  private def absentMarkEvidence(step: String, transactionId: String): String =
    s"no durable $step mark for transaction $transactionId (controlled profile only)"

  private def requireBoundedText(
      label: String, value: String, minLength: Int, maxLength: Int): Unit =
    require(value != null && value.length >= minLength && value.length <= maxLength,
      s"$label outside declared text bounds")

  private def sha256Hex(value: String): String = {
    val digest = java.security.MessageDigest.getInstance("SHA-256")
    digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8))
      .map(byte => f"${byte & 0xff}%02x").mkString
  }

  private final class ReserveSourceStockPrepareReceiptCodec
      extends PayloadCodec[ReserveSourceStockPrepareReceipt] {
    override val pin: CodecPin = CodecPin("stock-transfer-reserve-source-stock-prepare", 1)
    override def encode(value: ReserveSourceStockPrepareReceipt): ByteString =
      StrictWire.lengthPrefixed(value.reservationId.toString) ++
        StrictWire.lengthPrefixed(value.reservedQuantity.toString)
    override def decode(bytes: ByteString): Try[ReserveSourceStockPrepareReceipt] =
      StrictWire.readPrefixed(bytes, 2).flatMap {
        case (Vector(first, second), rest) =>
          if (rest.isEmpty)
            Try(ReserveSourceStockPrepareReceipt(java.util.UUID.fromString(first), second.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class ReserveSourceStockCommitReceiptCodec
      extends PayloadCodec[ReserveSourceStockCommitReceipt] {
    override val pin: CodecPin = CodecPin("stock-transfer-reserve-source-stock-commit", 1)
    override def encode(value: ReserveSourceStockCommitReceipt): ByteString =
      StrictWire.lengthPrefixed(value.committedQuantity.toString)
    override def decode(bytes: ByteString): Try[ReserveSourceStockCommitReceipt] =
      StrictWire.readPrefixed(bytes, 1).flatMap {
        case (Vector(first), rest) =>
          if (rest.isEmpty) Try(ReserveSourceStockCommitReceipt(first.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class ReserveSourceStockCompensateReceiptCodec
      extends PayloadCodec[ReserveSourceStockCompensateReceipt] {
    override val pin: CodecPin = CodecPin("stock-transfer-reserve-source-stock-compensate", 1)
    override def encode(value: ReserveSourceStockCompensateReceipt): ByteString =
      StrictWire.lengthPrefixed(value.releasedQuantity.toString)
    override def decode(bytes: ByteString): Try[ReserveSourceStockCompensateReceipt] =
      StrictWire.readPrefixed(bytes, 1).flatMap {
        case (Vector(first), rest) =>
          if (rest.isEmpty) Try(ReserveSourceStockCompensateReceipt(first.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class CommitTargetStockPrepareReceiptCodec
      extends PayloadCodec[CommitTargetStockPrepareReceipt] {
    override val pin: CodecPin = CodecPin("stock-transfer-commit-target-stock-prepare", 2)
    override def encode(value: CommitTargetStockPrepareReceipt): ByteString =
      StrictWire.lengthPrefixed(value.orderId.toString) ++
        StrictWire.lengthPrefixed(value.confirmedQuantity.toString)
    override def decode(bytes: ByteString): Try[CommitTargetStockPrepareReceipt] =
      StrictWire.readPrefixed(bytes, 2).flatMap {
        case (Vector(first, second), rest) =>
          if (rest.isEmpty)
            Try(CommitTargetStockPrepareReceipt(java.util.UUID.fromString(first), second.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class CommitTargetStockCommitReceiptCodec
      extends PayloadCodec[CommitTargetStockCommitReceipt] {
    override val pin: CodecPin = CodecPin("stock-transfer-commit-target-stock-commit", 1)
    override def encode(value: CommitTargetStockCommitReceipt): ByteString =
      StrictWire.lengthPrefixed(value.settledQuantity.toString)
    override def decode(bytes: ByteString): Try[CommitTargetStockCommitReceipt] =
      StrictWire.readPrefixed(bytes, 1).flatMap {
        case (Vector(first), rest) =>
          if (rest.isEmpty) Try(CommitTargetStockCommitReceipt(first.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class CommitTargetStockCompensateReceiptCodec
      extends PayloadCodec[CommitTargetStockCompensateReceipt] {
    override val pin: CodecPin = CodecPin("stock-transfer-commit-target-stock-compensate", 1)
    override def encode(value: CommitTargetStockCompensateReceipt): ByteString =
      StrictWire.lengthPrefixed(value.cancelledQuantity.toString)
    override def decode(bytes: ByteString): Try[CommitTargetStockCompensateReceipt] =
      StrictWire.readPrefixed(bytes, 1).flatMap {
        case (Vector(first), rest) =>
          if (rest.isEmpty) Try(CommitTargetStockCompensateReceipt(first.toInt))
          else Failure(new IllegalArgumentException(
            "what wire: trailing bytes after the declared fields"))
        case _ => Failure(new IllegalArgumentException("what wire: field count mismatch"))
      }
  }

  private final class ReserveSourceStockPrepareBinding
      extends ReserveSourceStockPrepareHostBinding {
    private val codec = new ReserveSourceStockPrepareReceiptCodec
    def contract: PhaseContract = reserveSourceStockPrepareBindingContract
    def receiptCodec: PayloadCodec[ReserveSourceStockPrepareReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: ReserveSourceStockPrepareInput
    ): Future[PhaseOutcome[ReserveSourceStockPrepareReceipt]] =
      warehouseReplyAsk(identity.resource, replyTo =>
        WarehouseProtocol.ReserveStock(input.transactionId, input.sku, input.quantity, replyTo)
      ).map { reply =>
        reply.result match {
          case Left(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case Right(payload) => ConfirmedReceipt(identity, ReserveSourceStockPrepareReceipt(
            payload.reservationId, payload.reservedQuantity))
        }
      }.recover { case throwable =>
        Unknown(identity, s"reserve-stock interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: ReserveSourceStockPrepareInput
    ): Future[PhaseOutcome[ReserveSourceStockPrepareReceipt]] =
      warehouseStateAsk(identity.resource).map { state =>
        state.reserved.get(input.transactionId).map(mark => ConfirmedReceipt(identity,
          ReserveSourceStockPrepareReceipt(mark.reservationId, mark.quantity))).getOrElse(
          NotExecuted(identity, absentMarkEvidence("reserve", input.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"reserve-source-stock evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class ReserveSourceStockCommitBinding
      extends ReserveSourceStockCommitHostBinding {
    private val codec = new ReserveSourceStockCommitReceiptCodec
    def contract: PhaseContract = reserveSourceStockCommitBindingContract
    def receiptCodec: PayloadCodec[ReserveSourceStockCommitReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: ReserveSourceStockCommitInput
    ): Future[PhaseOutcome[ReserveSourceStockCommitReceipt]] =
      warehouseReplyAsk(identity.resource, replyTo =>
        WarehouseProtocol.CommitStock(identity.transaction.transactionId, input.reservationId,
          replyTo)
      ).map { reply =>
        reply.result match {
          case Left(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case Right(payload) => ConfirmedReceipt(identity,
            ReserveSourceStockCommitReceipt(payload.committedQuantity))
        }
      }.recover { case throwable =>
        Unknown(identity, s"commit-stock interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: ReserveSourceStockCommitInput
    ): Future[PhaseOutcome[ReserveSourceStockCommitReceipt]] =
      warehouseStateAsk(identity.resource).map { state =>
        state.committed.get(identity.transaction.transactionId).map(quantity =>
          ConfirmedReceipt(identity, ReserveSourceStockCommitReceipt(quantity))).getOrElse(
          NotExecuted(identity,
            absentMarkEvidence("commit", identity.transaction.transactionId), safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"reserve-source-stock evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class ReserveSourceStockCompensateBinding
      extends ReserveSourceStockCompensateHostBinding {
    private val codec = new ReserveSourceStockCompensateReceiptCodec
    def contract: PhaseContract = reserveSourceStockCompensateBindingContract
    def receiptCodec: PayloadCodec[ReserveSourceStockCompensateReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: ReserveSourceStockCompensateInput
    ): Future[PhaseOutcome[ReserveSourceStockCompensateReceipt]] =
      warehouseReplyAsk(identity.resource, replyTo =>
        WarehouseProtocol.ReleaseStock(identity.transaction.transactionId, input.reservationId,
          replyTo)
      ).map { reply =>
        reply.result match {
          case Left(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case Right(payload) => ConfirmedReceipt(identity,
            ReserveSourceStockCompensateReceipt(payload.releasedQuantity))
        }
      }.recover { case throwable =>
        Unknown(identity, s"release-stock interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: ReserveSourceStockCompensateInput
    ): Future[PhaseOutcome[ReserveSourceStockCompensateReceipt]] =
      warehouseStateAsk(identity.resource).map { state =>
        state.released.get(identity.transaction.transactionId).map(quantity =>
          ConfirmedReceipt(identity, ReserveSourceStockCompensateReceipt(quantity))).getOrElse(
          NotExecuted(identity,
            absentMarkEvidence("release", identity.transaction.transactionId), safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"reserve-source-stock evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class CommitTargetStockPrepareBinding
      extends CommitTargetStockPrepareHostBinding {
    private val codec = new CommitTargetStockPrepareReceiptCodec
    def contract: PhaseContract = commitTargetStockPrepareBindingContract
    def receiptCodec: PayloadCodec[CommitTargetStockPrepareReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: CommitTargetStockPrepareInput
    ): Future[PhaseOutcome[CommitTargetStockPrepareReceipt]] =
      warehouseReplyAsk(identity.resource, replyTo =>
        WarehouseProtocol.PlaceStockOrder(input.transactionId, input.sku,
          input.reservedQuantity, replyTo)
      ).map { reply =>
        reply.result match {
          case Left(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case Right(payload) => ConfirmedReceipt(identity, CommitTargetStockPrepareReceipt(
            payload.orderId, payload.confirmedQuantity))
        }
      }.recover { case throwable =>
        Unknown(identity, s"place-stock-order interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: CommitTargetStockPrepareInput
    ): Future[PhaseOutcome[CommitTargetStockPrepareReceipt]] =
      warehouseStateAsk(identity.resource).map { state =>
        state.orders.get(input.transactionId).map(mark => ConfirmedReceipt(identity,
          CommitTargetStockPrepareReceipt(mark.orderId, mark.quantity))).getOrElse(
          NotExecuted(identity, absentMarkEvidence("order", input.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"commit-target-stock evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class CommitTargetStockCommitBinding
      extends CommitTargetStockCommitHostBinding {
    private val codec = new CommitTargetStockCommitReceiptCodec
    def contract: PhaseContract = commitTargetStockCommitBindingContract
    def receiptCodec: PayloadCodec[CommitTargetStockCommitReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: CommitTargetStockCommitInput
    ): Future[PhaseOutcome[CommitTargetStockCommitReceipt]] =
      warehouseReplyAsk(identity.resource, replyTo =>
        WarehouseProtocol.SettleStockOrder(identity.transaction.transactionId, input.orderId,
          replyTo)
      ).map { reply =>
        reply.result match {
          case Left(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case Right(payload) => ConfirmedReceipt(identity,
            CommitTargetStockCommitReceipt(payload.settledQuantity))
        }
      }.recover { case throwable =>
        Unknown(identity, s"settle-stock-order interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: CommitTargetStockCommitInput
    ): Future[PhaseOutcome[CommitTargetStockCommitReceipt]] =
      warehouseStateAsk(identity.resource).map { state =>
        state.settled.get(identity.transaction.transactionId).map(quantity =>
          ConfirmedReceipt(identity, CommitTargetStockCommitReceipt(quantity))).getOrElse(
          NotExecuted(identity,
            absentMarkEvidence("settlement", identity.transaction.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"commit-target-stock evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class CommitTargetStockCompensateBinding
      extends CommitTargetStockCompensateHostBinding {
    private val codec = new CommitTargetStockCompensateReceiptCodec
    def contract: PhaseContract = commitTargetStockCompensateBindingContract
    def receiptCodec: PayloadCodec[CommitTargetStockCompensateReceipt] = codec
    def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
    def execute(
        identity: OperationIdentity,
        input: CommitTargetStockCompensateInput
    ): Future[PhaseOutcome[CommitTargetStockCompensateReceipt]] =
      warehouseReplyAsk(identity.resource, replyTo =>
        WarehouseProtocol.CancelStockOrder(identity.transaction.transactionId, input.orderId,
          replyTo)
      ).map { reply =>
        reply.result match {
          case Left(error) =>
            NotExecuted(identity, refusedEvidence(error), safeToRetry = true)
          case Right(payload) => ConfirmedReceipt(identity,
            CommitTargetStockCompensateReceipt(payload.cancelledQuantity))
        }
      }.recover { case throwable =>
        Unknown(identity, s"cancel-stock-order interaction failed: ${throwable.getMessage}")
      }
    def query(
        identity: OperationIdentity,
        input: CommitTargetStockCompensateInput
    ): Future[PhaseOutcome[CommitTargetStockCompensateReceipt]] =
      warehouseStateAsk(identity.resource).map { state =>
        state.cancelled.get(identity.transaction.transactionId).map(quantity =>
          ConfirmedReceipt(identity, CommitTargetStockCompensateReceipt(quantity))).getOrElse(
          NotExecuted(identity,
            absentMarkEvidence("cancellation", identity.transaction.transactionId),
            safeToRetry = true))
      }.recover { case throwable =>
        Unknown(identity, s"commit-target-stock evidence query failed: ${throwable.getMessage}")
      }
  }

  private final class TransferStockRequestedTrigger extends TransferStockRequestedTriggerBinding {
    def contract: TriggerContract = transferStockRequestedTriggerContract
    def map(source: TransferStockCommand): TriggerStart = {
      val transferId = source.transferId.toString
      requireBoundedText("transfer id", transferId, 36, 36)
      requireBoundedText("source warehouse id", source.sourceWarehouseId.toString, 36, 36)
      requireBoundedText("target warehouse id", source.targetWarehouseId.toString, 36, 36)
      requireBoundedText("sku", source.sku, 1, 40)
      TriggerStart(transferId, Args(source.sourceWarehouseId, source.targetWarehouseId,
        source.sku, source.quantity, source.transferMode))
    }
  }

  private final class WarehouseStockReceivedTrigger
      extends WarehouseStockReceivedTriggerBinding {
    def contract: TriggerContract = warehouseStockReceivedTriggerContract
    def map(source: StockReceivedEvent): TriggerStart = {
      val eventIdentity = s"warehouse-stock-received:${source.warehouseId}/" +
        s"${source.sku}/${source.receivedQuantity}"
      val transactionId = sha256Hex(eventIdentity)
      requireBoundedText("transaction id", transactionId, 1, 64)
      requireBoundedText("warehouse id", source.warehouseId.toString, 36, 36)
      requireBoundedText("sku", source.sku, 1, 40)
      TriggerStart(transactionId, Args(source.warehouseId, source.warehouseId,
        source.sku, source.receivedQuantity, "STANDARD"))
    }
  }

  private final class SucceededCompletionMapper extends SucceededCompletionBinding {
    def contract: CompletionContract = succeededCompletionContract
    def map(identity: TransactionIdentity,
        input: SucceededCompletionInput): StockTransferCompletedEvent =
      StockTransferCompletedEvent(input.transactionId, input.sourceWarehouseId)
  }
}
