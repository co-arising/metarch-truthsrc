package example.stockreservation.application.services.transactor

import akka.actor.typed.{ActorRef, Behavior}
import akka.persistence.typed.PersistenceId
import example.stockreservation.application.aggregates.TransferStockCommand
import example.stockreservation.domain.events.{StockReceivedEvent, StockTransferCompletedEvent}
import net.imadz.infra.saga.strict._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** Generated/buildable candidate; NOT runtime verified. No production dependency is selected.
  * Host adapters must implement all named technical mappers and durable outcomes;
  * FQN is not an ABI. Independent strict persistence namespace, admission/deadline
  * enforcement and idempotent completion publication remain host obligations.
  * Upstream blocked/readiness flags are not rewritten. */
object StockTransferSagaModule {
  val name = "stock-transfer"
  val version = 1
  val definitionDigest = "sha256:6d7dbbcfe6d0aa09b5b83723dee9f7ca85727eec8d48e6d8f0f239db483b8610"
  val argsPin = CodecPin("stock-transfer-args", 1)
  val candidateArtifact = "StockTransferSagaModule"
  val artifactStatus = "generated"
  val upstreamRunnable = true
  val upstreamRuntimeBindingVerified = true
  val upstreamBlocked = Vector()
  final case class Args(
      sourceWarehouseId: java.util.UUID,
      targetWarehouseId: java.util.UUID,
      sku: String,
      quantity: Int,
      transferMode: String)
  final case class TriggerStart(transactionId: String, args: Args)
  final case class AddressContract(
      participant: String,
      resourceSlot: String,
      resourceType: String,
      aggregate: String,
      resolverFqn: String,
      mode: String)
  val sourceWarehouseResourceContract = AddressContract(
    "source-warehouse",
    "source-warehouse-id",
    "warehouse-id",
    "warehouse",
    "example.stockreservation.domain.warehouse.WarehouseRegistry",
    "exact-resource")
  val targetWarehouseResourceContract = AddressContract(
    "target-warehouse",
    "target-warehouse-id",
    "warehouse-id",
    "warehouse",
    "example.stockreservation.domain.warehouse.WarehouseRegistry",
    "exact-resource")
  final case class ValueSource(kind: String, slot: String, producerStep: String,
    producerPhase: String)
  final case class SlotContract(slot: String, typeId: String)
  final case class InputContract(slot: String, typeId: String, source: ValueSource)
  final case class ConfirmationContract(aggregate: String, event: String, mapperFqn: String,
    outputs: Vector[InputContract])
  final case class QueryContract(mapperFqn: String, mode: String, identity: Vector[String],
    results: Vector[String])
  final case class ReceiptContract(mapperFqn: String, version: String, durable: Boolean,
    identity: Vector[String], compatibility: String, evidence: String)
  final case class IdempotencyContract(mapperFqn: String, identity: Vector[String],
    payloadConflict: String, attempt: String)
  final case class PhaseContract(step: String, participant: String, phase: Phase, portFqn: String,
    commandMapperFqn: String, aggregate: String, command: String, inputs: Vector[InputContract],
    outputs: Vector[SlotContract], confirmation: ConfirmationContract, query: QueryContract,
    receipt: ReceiptContract, idempotency: IdempotencyContract, contractCodecId: String,
    contractCodecVersion: String, receiptPin: CodecPin)
  final case class TriggerContract(id: String, aggregate: String, idempotencySource: String,
    idempotencyType: String, args: Vector[InputContract], argsMapperFqn: String,
    idempotencyMapperFqn: String, scope: String, conflict: String)
  final case class CompletionContract(kind: String, aggregate: String, event: String,
    mapperFqn: String, inputs: Vector[InputContract])
  final case class TypeContract(id: String, canonicalType: String, implementationFqn: String,
    shape: ValueShape)
  sealed trait ValueShape
  final case class BoundedText(kind: String, minLength: Int, maxLength: Int) extends ValueShape
  case object BooleanShape extends ValueShape
  final case class IntegerShape(minimum: Long, maximum: Long) extends ValueShape
  final case class EnumerationShape(values: Vector[String]) extends ValueShape
  final case class ValueObjectShape(fields: Vector[SlotContract]) extends ValueShape
  final case class MoneyShape(scale: Int, precision: Int, codecFqn: String, currency: String,
    encoding: String) extends ValueShape
  val requiredTypes: Vector[TypeContract] = Vector(
    TypeContract("transaction-id", "TransactionId", "java.lang.String",
      BoundedText("text", 1, 64)),
    TypeContract(
      "warehouse-id", "WarehouseId", "net.imadz.common.CommonTypes.Id", BoundedText("id", 36, 36)),
    TypeContract("sku", "Sku", "java.lang.String", BoundedText("text", 1, 40)),
    TypeContract("quantity", "Quantity", "scala.Int", IntegerShape(1L, 1000000L)),
    TypeContract("transfer-mode", "TransferMode", "java.lang.String",
      EnumerationShape(Vector("STANDARD", "URGENT"))),
    TypeContract(
      "transfer-id", "TransferId", "net.imadz.common.CommonTypes.Id", BoundedText("id", 36, 36)))
  final case class ArgsCodecContract(mapperFqn: String, id: String, version: String,
    compatibleVersions: Vector[String], runtimePin: CodecPin)
  val requiredArgsCodec = ArgsCodecContract(
    "example.stockreservation.saga.codec.StockTransferArgsCodec",
    "stock-transfer-v1", "1.0.0", Vector("1.0.0"), argsPin)
  final case class HostRequirements(capabilities: Vector[String], totalDeadlineMs: Int,
    maxParticipants: Int, maxInFlight: Int, maxItemsPerChunk: Int, durableManifest: Boolean,
    businessInvariants: Vector[String], commitDecision: String, abortDecision: String,
    afterCommit: String, unknown: String, compensation: String, cancelBeforePrepare: String,
    retryIdentity: String, manualRecovery: String, maxAttempts: Int, phaseTimeoutMs: Int,
    queryTimeoutMs: Int, backoffMs: Int)
  val requiredHost = HostRequirements(
    Vector("durable-receipt", "exact-resource-addressing", "read-only-evidence-query"),
    30000, 8, 64, 500, true, Vector("reservation-conservation"),
    "durable-before-commit", "durable-before-compensate", "forward-recovery",
    "reconcile-before-resume",
    "confirmed-reservations", "empty-release-and-fence", "stable-operation",
    "authorized-reconciliation-evidence", 3, 5000, 2000, 250)
  trait Host {
    // canonical codec:
    //   example.stockreservation.saga.codec.StockTransferArgsCodec, 1.0.0
    def argsCodec: PayloadCodec[Args]
    def settings: StrictSagaCoordinator.Settings // explicit reconcile budget; no guessed default
    // Fail closed when deadline/admission/retry/capability or named mapper ABI
    // implementation is unavailable.
    // Returning normally is a host declaration, not runtime certification by generated code.
    def requireImplemented(
        requirements: HostRequirements,
        types: Vector[TypeContract],
        argsCodec: ArgsCodecContract
    ): Unit
    def requireIndependentNamespace(persistenceId: PersistenceId): Unit
    // pure exact-resource addressing; no I/O
    def sourceWarehouseResource(resource: java.util.UUID): String
    // pure exact-resource addressing; no I/O
    def targetWarehouseResource(resource: java.util.UUID): String
    def sourceWarehouseResourceContract: AddressContract
    def targetWarehouseResourceContract: AddressContract
    def reserveSourceStockPrepareBinding: ReserveSourceStockPrepareHostBinding
    def reserveSourceStockCommitBinding: ReserveSourceStockCommitHostBinding
    def reserveSourceStockCompensateBinding: ReserveSourceStockCompensateHostBinding
    def commitTargetStockPrepareBinding: CommitTargetStockPrepareHostBinding
    def commitTargetStockCommitBinding: CommitTargetStockCommitHostBinding
    def commitTargetStockCompensateBinding: CommitTargetStockCompensateHostBinding
    def transferStockRequestedTrigger: TransferStockRequestedTriggerBinding
    def warehouseStockReceivedTrigger: WarehouseStockReceivedTriggerBinding
    def succeededCompletion: SucceededCompletionBinding
  }
  private def checkedArgsCodec(host: Host): PayloadCodec[Args] = {
    require(host != null && host.argsCodec != null, "host canonical args codec required")
    host.requireImplemented(requiredHost, requiredTypes, requiredArgsCodec)
    require(
      host.sourceWarehouseResourceContract == sourceWarehouseResourceContract,
      "exact resource binding mismatch")
    require(
      host.targetWarehouseResourceContract == targetWarehouseResourceContract,
      "exact resource binding mismatch")
    val codec = host.argsCodec
    require(codec.pin == argsPin, "args codec pin mismatch")
    codec
  }

  final case class ReserveSourceStockPrepareInput(
      transactionId: String, sourceWarehouseId: java.util.UUID, sku: String, quantity: Int)
  final case class ReserveSourceStockPrepareReceipt(
      reservationId: java.util.UUID, reservedQuantity: Int)
  val reserveSourceStockPrepareBindingContract: PhaseContract = PhaseContract(
    "reserve-source-stock", "source-warehouse", Phase.Prepare,
    "example.stockreservation.infrastructure.saga.ReserveSourceStockPort",
    "example.stockreservation.saga.mapper.ReserveSourceStockCommandMapper",
    "warehouse", "reserve-stock",
    Vector(
      InputContract("transaction-id", "transaction-id",
        ValueSource("transaction-id", "", "", "")),
      InputContract("source-warehouse-id", "warehouse-id",
        ValueSource("args", "source-warehouse-id", "", "")),
      InputContract("sku", "sku", ValueSource("args", "sku", "", "")),
      InputContract("quantity", "quantity", ValueSource("args", "quantity", "", ""))),
    Vector(
      SlotContract("reservation-id", "warehouse-id"),
      SlotContract("reserved-quantity", "quantity")),
    ConfirmationContract(
      "warehouse", "stock-reserved",
      "example.stockreservation.saga.mapper.ReserveSourceStockPrepareConfirmationMapper",
      Vector(
        InputContract("reservation-id", "warehouse-id",
          ValueSource("receipt-field", "reservation-id", "", "")),
        InputContract("reserved-quantity", "quantity",
          ValueSource("receipt-field", "reserved-quantity", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.ReserveSourceStockPrepareQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "args-digest", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.ReserveSourceStockPrepareReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "reservation-decision-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.ReserveSourceStockPrepareIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "stock-transfer-reserve-source-stock-prepare", "1.0.0",
    CodecPin("stock-transfer-reserve-source-stock-prepare", 1))
  trait ReserveSourceStockPrepareHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[ReserveSourceStockPrepareReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: ReserveSourceStockPrepareInput
    ): Future[PhaseOutcome[ReserveSourceStockPrepareReceipt]]
    def query(
        identity: OperationIdentity,
        input: ReserveSourceStockPrepareInput
    ): Future[PhaseOutcome[ReserveSourceStockPrepareReceipt]]
  }
  private final class ReserveSourceStockPreparePort(
      host: Host,
      binding: ReserveSourceStockPrepareHostBinding,
      codec: PayloadCodec[ReserveSourceStockPrepareReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, ReserveSourceStockPrepareReceipt] {
    def receiptCodec: PayloadCodec[ReserveSourceStockPrepareReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == reserveSourceStockPrepareBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[ReserveSourceStockPrepareInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "reserve-source-stock" &&
          request.identity.participantId == "source-warehouse" &&
          request.identity.phase == Phase.Prepare &&
          request.identity.resource == host.sourceWarehouseResource(request.args.sourceWarehouseId),
          "consumer identity mismatch")
        ReserveSourceStockPrepareInput(
          request.identity.transaction.transactionId,
          request.args.sourceWarehouseId,
          request.args.sku,
          request.args.quantity)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[ReserveSourceStockPrepareReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[ReserveSourceStockPrepareReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def reserveSourceStockPrepareBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, ReserveSourceStockPrepareReceipt] = {
    val binding = host.reserveSourceStockPrepareBinding
    require(binding != null && binding.contract == reserveSourceStockPrepareBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("stock-transfer-reserve-source-stock-prepare", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new ReserveSourceStockPreparePort(host, binding, codec)
  }

  final case class ReserveSourceStockCommitInput(reservationId: java.util.UUID)
  final case class ReserveSourceStockCommitReceipt(committedQuantity: Int)
  val reserveSourceStockCommitBindingContract: PhaseContract = PhaseContract(
    "reserve-source-stock", "source-warehouse", Phase.Commit,
    "example.stockreservation.infrastructure.saga.ReserveSourceStockPort",
    "example.stockreservation.saga.mapper.ReserveSourceStockCommandMapper",
    "warehouse", "commit-stock",
    Vector(
      InputContract("reservation-id", "warehouse-id",
        ValueSource("step-receipt", "reservation-id", "reserve-source-stock", "prepare"))),
    Vector(
      SlotContract("committed-quantity", "quantity")),
    ConfirmationContract(
      "warehouse", "stock-committed",
      "example.stockreservation.saga.mapper.ReserveSourceStockCommitConfirmationMapper",
      Vector(
        InputContract("committed-quantity", "quantity",
          ValueSource("receipt-field", "committed-quantity", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.ReserveSourceStockCommitQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "args-digest", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.ReserveSourceStockCommitReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "reservation-decision-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.ReserveSourceStockCommitIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "stock-transfer-reserve-source-stock-commit", "1.0.0",
    CodecPin("stock-transfer-reserve-source-stock-commit", 1))
  trait ReserveSourceStockCommitHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[ReserveSourceStockCommitReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: ReserveSourceStockCommitInput
    ): Future[PhaseOutcome[ReserveSourceStockCommitReceipt]]
    def query(
        identity: OperationIdentity,
        input: ReserveSourceStockCommitInput
    ): Future[PhaseOutcome[ReserveSourceStockCommitReceipt]]
  }
  private final class ReserveSourceStockCommitPort(
      host: Host,
      binding: ReserveSourceStockCommitHostBinding,
      codec: PayloadCodec[ReserveSourceStockCommitReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, ReserveSourceStockCommitReceipt] {
    def receiptCodec: PayloadCodec[ReserveSourceStockCommitReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == reserveSourceStockCommitBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[ReserveSourceStockCommitInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "reserve-source-stock" &&
          request.identity.participantId == "source-warehouse" &&
          request.identity.phase == Phase.Commit &&
          request.identity.resource == host.sourceWarehouseResource(request.args.sourceWarehouseId),
          "consumer identity mismatch")
        val reserveSourceStockPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "source-warehouse",
            host.sourceWarehouseResource(request.args.sourceWarehouseId),
            "reserve-source-stock",
            Phase.Prepare),
          CodecPin("stock-transfer-reserve-source-stock-prepare", 1),
          host.reserveSourceStockPrepareBinding.receiptCodec).get
        ReserveSourceStockCommitInput(reserveSourceStockPrepare0.reservationId)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[ReserveSourceStockCommitReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[ReserveSourceStockCommitReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def reserveSourceStockCommitBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, ReserveSourceStockCommitReceipt] = {
    val binding = host.reserveSourceStockCommitBinding
    require(binding != null && binding.contract == reserveSourceStockCommitBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("stock-transfer-reserve-source-stock-commit", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new ReserveSourceStockCommitPort(host, binding, codec)
  }

  final case class ReserveSourceStockCompensateInput(reservationId: java.util.UUID)
  final case class ReserveSourceStockCompensateReceipt(releasedQuantity: Int)
  val reserveSourceStockCompensateBindingContract: PhaseContract = PhaseContract(
    "reserve-source-stock", "source-warehouse", Phase.Compensate,
    "example.stockreservation.infrastructure.saga.ReserveSourceStockPort",
    "example.stockreservation.saga.mapper.ReserveSourceStockCommandMapper",
    "warehouse", "release-stock",
    Vector(
      InputContract("reservation-id", "warehouse-id",
        ValueSource("step-receipt", "reservation-id", "reserve-source-stock", "prepare"))),
    Vector(
      SlotContract("released-quantity", "quantity")),
    ConfirmationContract(
      "warehouse", "stock-released",
      "example.stockreservation.saga.mapper.ReserveSourceStockCompensateConfirmationMapper",
      Vector(
        InputContract("released-quantity", "quantity",
          ValueSource("receipt-field", "released-quantity", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.ReserveSourceStockCompensateQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "args-digest", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.ReserveSourceStockCompensateReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "reservation-decision-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.ReserveSourceStockCompensateIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "stock-transfer-reserve-source-stock-compensate", "1.0.0",
    CodecPin("stock-transfer-reserve-source-stock-compensate", 1))
  trait ReserveSourceStockCompensateHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[ReserveSourceStockCompensateReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: ReserveSourceStockCompensateInput
    ): Future[PhaseOutcome[ReserveSourceStockCompensateReceipt]]
    def query(
        identity: OperationIdentity,
        input: ReserveSourceStockCompensateInput
    ): Future[PhaseOutcome[ReserveSourceStockCompensateReceipt]]
  }
  private final class ReserveSourceStockCompensatePort(
      host: Host,
      binding: ReserveSourceStockCompensateHostBinding,
      codec: PayloadCodec[ReserveSourceStockCompensateReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, ReserveSourceStockCompensateReceipt] {
    def receiptCodec: PayloadCodec[ReserveSourceStockCompensateReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == reserveSourceStockCompensateBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[ReserveSourceStockCompensateInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "reserve-source-stock" &&
          request.identity.participantId == "source-warehouse" &&
          request.identity.phase == Phase.Compensate &&
          request.identity.resource == host.sourceWarehouseResource(request.args.sourceWarehouseId),
          "consumer identity mismatch")
        val reserveSourceStockPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "source-warehouse",
            host.sourceWarehouseResource(request.args.sourceWarehouseId),
            "reserve-source-stock",
            Phase.Prepare),
          CodecPin("stock-transfer-reserve-source-stock-prepare", 1),
          host.reserveSourceStockPrepareBinding.receiptCodec).get
        ReserveSourceStockCompensateInput(reserveSourceStockPrepare0.reservationId)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[ReserveSourceStockCompensateReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[ReserveSourceStockCompensateReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def reserveSourceStockCompensateBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, ReserveSourceStockCompensateReceipt] = {
    val binding = host.reserveSourceStockCompensateBinding
    require(binding != null && binding.contract == reserveSourceStockCompensateBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("stock-transfer-reserve-source-stock-compensate", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new ReserveSourceStockCompensatePort(host, binding, codec)
  }

  final case class CommitTargetStockPrepareInput(
      transactionId: String, targetWarehouseId: java.util.UUID, sku: String,
      reservedQuantity: Int, reservationId: java.util.UUID)
  final case class CommitTargetStockPrepareReceipt(
      orderId: java.util.UUID, confirmedQuantity: Int)
  val commitTargetStockPrepareBindingContract: PhaseContract = PhaseContract(
    "commit-target-stock", "target-warehouse", Phase.Prepare,
    "example.stockreservation.infrastructure.saga.CommitTargetStockPort",
    "example.stockreservation.saga.mapper.CommitTargetStockCommandMapper",
    "warehouse", "place-stock-order",
    Vector(
      InputContract("transaction-id", "transaction-id",
        ValueSource("transaction-id", "", "", "")),
      InputContract("target-warehouse-id", "warehouse-id",
        ValueSource("args", "target-warehouse-id", "", "")),
      InputContract("sku", "sku", ValueSource("args", "sku", "", "")),
      InputContract("reserved-quantity", "quantity",
        ValueSource("step-receipt", "reserved-quantity", "reserve-source-stock", "prepare")),
      InputContract("reservation-id", "warehouse-id",
        ValueSource("step-receipt", "reservation-id", "reserve-source-stock", "prepare"))),
    Vector(
      SlotContract("order-id", "warehouse-id"),
      SlotContract("confirmed-quantity", "quantity")),
    ConfirmationContract(
      "warehouse", "stock-order-placed",
      "example.stockreservation.saga.mapper.CommitTargetStockPrepareConfirmationMapper",
      Vector(
        InputContract("order-id", "warehouse-id",
          ValueSource("receipt-field", "order-id", "", "")),
        InputContract("confirmed-quantity", "quantity",
          ValueSource("receipt-field", "confirmed-quantity", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.CommitTargetStockPrepareQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "args-digest", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.CommitTargetStockPrepareReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "reservation-decision-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.CommitTargetStockPrepareIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "stock-transfer-commit-target-stock-prepare", "1.0.0",
    CodecPin("stock-transfer-commit-target-stock-prepare", 2))
  trait CommitTargetStockPrepareHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[CommitTargetStockPrepareReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: CommitTargetStockPrepareInput
    ): Future[PhaseOutcome[CommitTargetStockPrepareReceipt]]
    def query(
        identity: OperationIdentity,
        input: CommitTargetStockPrepareInput
    ): Future[PhaseOutcome[CommitTargetStockPrepareReceipt]]
  }
  private final class CommitTargetStockPreparePort(
      host: Host,
      binding: CommitTargetStockPrepareHostBinding,
      codec: PayloadCodec[CommitTargetStockPrepareReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, CommitTargetStockPrepareReceipt] {
    def receiptCodec: PayloadCodec[CommitTargetStockPrepareReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == commitTargetStockPrepareBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[CommitTargetStockPrepareInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "commit-target-stock" &&
          request.identity.participantId == "target-warehouse" &&
          request.identity.phase == Phase.Prepare &&
          request.identity.resource == host.targetWarehouseResource(request.args.targetWarehouseId),
          "consumer identity mismatch")
        val reserveSourceStockPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "source-warehouse",
            host.sourceWarehouseResource(request.args.sourceWarehouseId),
            "reserve-source-stock",
            Phase.Prepare),
          CodecPin("stock-transfer-reserve-source-stock-prepare", 1),
          host.reserveSourceStockPrepareBinding.receiptCodec).get
        CommitTargetStockPrepareInput(
          request.identity.transaction.transactionId,
          request.args.targetWarehouseId,
          request.args.sku,
          reserveSourceStockPrepare0.reservedQuantity,
          reserveSourceStockPrepare0.reservationId)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[CommitTargetStockPrepareReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[CommitTargetStockPrepareReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def commitTargetStockPrepareBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, CommitTargetStockPrepareReceipt] = {
    val binding = host.commitTargetStockPrepareBinding
    require(binding != null && binding.contract == commitTargetStockPrepareBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("stock-transfer-commit-target-stock-prepare", 2),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new CommitTargetStockPreparePort(host, binding, codec)
  }

  final case class CommitTargetStockCommitInput(orderId: java.util.UUID)
  final case class CommitTargetStockCommitReceipt(settledQuantity: Int)
  val commitTargetStockCommitBindingContract: PhaseContract = PhaseContract(
    "commit-target-stock", "target-warehouse", Phase.Commit,
    "example.stockreservation.infrastructure.saga.CommitTargetStockPort",
    "example.stockreservation.saga.mapper.CommitTargetStockCommandMapper",
    "warehouse", "settle-stock-order",
    Vector(
      InputContract("order-id", "warehouse-id",
        ValueSource("step-receipt", "order-id", "commit-target-stock", "prepare"))),
    Vector(
      SlotContract("settled-quantity", "quantity")),
    ConfirmationContract(
      "warehouse", "stock-settled",
      "example.stockreservation.saga.mapper.CommitTargetStockCommitConfirmationMapper",
      Vector(
        InputContract("settled-quantity", "quantity",
          ValueSource("receipt-field", "settled-quantity", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.CommitTargetStockCommitQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "args-digest", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.CommitTargetStockCommitReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "reservation-decision-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.CommitTargetStockCommitIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "stock-transfer-commit-target-stock-commit", "1.0.0",
    CodecPin("stock-transfer-commit-target-stock-commit", 1))
  trait CommitTargetStockCommitHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[CommitTargetStockCommitReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: CommitTargetStockCommitInput
    ): Future[PhaseOutcome[CommitTargetStockCommitReceipt]]
    def query(
        identity: OperationIdentity,
        input: CommitTargetStockCommitInput
    ): Future[PhaseOutcome[CommitTargetStockCommitReceipt]]
  }
  private final class CommitTargetStockCommitPort(
      host: Host,
      binding: CommitTargetStockCommitHostBinding,
      codec: PayloadCodec[CommitTargetStockCommitReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, CommitTargetStockCommitReceipt] {
    def receiptCodec: PayloadCodec[CommitTargetStockCommitReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == commitTargetStockCommitBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[CommitTargetStockCommitInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "commit-target-stock" &&
          request.identity.participantId == "target-warehouse" &&
          request.identity.phase == Phase.Commit &&
          request.identity.resource == host.targetWarehouseResource(request.args.targetWarehouseId),
          "consumer identity mismatch")
        val commitTargetStockPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "target-warehouse",
            host.targetWarehouseResource(request.args.targetWarehouseId),
            "commit-target-stock",
            Phase.Prepare),
          CodecPin("stock-transfer-commit-target-stock-prepare", 2),
          host.commitTargetStockPrepareBinding.receiptCodec).get
        CommitTargetStockCommitInput(commitTargetStockPrepare0.orderId)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[CommitTargetStockCommitReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[CommitTargetStockCommitReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def commitTargetStockCommitBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, CommitTargetStockCommitReceipt] = {
    val binding = host.commitTargetStockCommitBinding
    require(binding != null && binding.contract == commitTargetStockCommitBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("stock-transfer-commit-target-stock-commit", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new CommitTargetStockCommitPort(host, binding, codec)
  }

  final case class CommitTargetStockCompensateInput(orderId: java.util.UUID)
  final case class CommitTargetStockCompensateReceipt(cancelledQuantity: Int)
  val commitTargetStockCompensateBindingContract: PhaseContract = PhaseContract(
    "commit-target-stock", "target-warehouse", Phase.Compensate,
    "example.stockreservation.infrastructure.saga.CommitTargetStockPort",
    "example.stockreservation.saga.mapper.CommitTargetStockCommandMapper",
    "warehouse", "cancel-stock-order",
    Vector(
      InputContract("order-id", "warehouse-id",
        ValueSource("step-receipt", "order-id", "commit-target-stock", "prepare"))),
    Vector(
      SlotContract("cancelled-quantity", "quantity")),
    ConfirmationContract(
      "warehouse", "stock-cancelled",
      "example.stockreservation.saga.mapper.CommitTargetStockCompensateConfirmationMapper",
      Vector(
        InputContract("cancelled-quantity", "quantity",
          ValueSource("receipt-field", "cancelled-quantity", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.CommitTargetStockCompensateQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "args-digest", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.CommitTargetStockCompensateReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "reservation-decision-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.CommitTargetStockCompensateIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "stock-transfer-commit-target-stock-compensate", "1.0.0",
    CodecPin("stock-transfer-commit-target-stock-compensate", 1))
  trait CommitTargetStockCompensateHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[CommitTargetStockCompensateReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: CommitTargetStockCompensateInput
    ): Future[PhaseOutcome[CommitTargetStockCompensateReceipt]]
    def query(
        identity: OperationIdentity,
        input: CommitTargetStockCompensateInput
    ): Future[PhaseOutcome[CommitTargetStockCompensateReceipt]]
  }
  private final class CommitTargetStockCompensatePort(
      host: Host,
      binding: CommitTargetStockCompensateHostBinding,
      codec: PayloadCodec[CommitTargetStockCompensateReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, CommitTargetStockCompensateReceipt] {
    def receiptCodec: PayloadCodec[CommitTargetStockCompensateReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == commitTargetStockCompensateBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[CommitTargetStockCompensateInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "commit-target-stock" &&
          request.identity.participantId == "target-warehouse" &&
          request.identity.phase == Phase.Compensate &&
          request.identity.resource == host.targetWarehouseResource(request.args.targetWarehouseId),
          "consumer identity mismatch")
        val commitTargetStockPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "target-warehouse",
            host.targetWarehouseResource(request.args.targetWarehouseId),
            "commit-target-stock",
            Phase.Prepare),
          CodecPin("stock-transfer-commit-target-stock-prepare", 2),
          host.commitTargetStockPrepareBinding.receiptCodec).get
        CommitTargetStockCompensateInput(commitTargetStockPrepare0.orderId)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[CommitTargetStockCompensateReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[CommitTargetStockCompensateReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def commitTargetStockCompensateBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, CommitTargetStockCompensateReceipt] = {
    val binding = host.commitTargetStockCompensateBinding
    require(binding != null && binding.contract == commitTargetStockCompensateBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("stock-transfer-commit-target-stock-compensate", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new CommitTargetStockCompensatePort(host, binding, codec)
  }

  val transferStockRequestedTriggerContract = TriggerContract(
    "transfer-stock-requested", "stock-order", "transfer-id", "transfer-id",
    Vector(
      InputContract("source-warehouse-id", "warehouse-id",
        ValueSource("args", "source-warehouse-id", "", "")),
      InputContract("target-warehouse-id", "warehouse-id",
        ValueSource("args", "target-warehouse-id", "", "")),
      InputContract("sku", "sku", ValueSource("args", "sku", "", "")),
      InputContract("quantity", "quantity", ValueSource("args", "quantity", "", "")),
      InputContract("transfer-mode", "transfer-mode",
        ValueSource("args", "transfer-mode", "", ""))),
    "example.stockreservation.saga.mapper.TransferStockRequestedArgsMapper",
    "example.stockreservation.saga.mapper.TransferStockRequestedIdempotencyMapper",
    "saga-version", "reject-different-args")
  trait TransferStockRequestedTriggerBinding {
    def contract: TriggerContract
    // Whole typed trigger, including the explicit idempotency source; never first/drop remaining.
    def map(source: TransferStockCommand): TriggerStart
  }
  def transferStockRequestedTriggerStart(
      source: TransferStockCommand,
      host: Host,
      replyTo: ActorRef[StrictSagaCoordinator.Reply]
  ): StrictSagaCoordinator.Start = {
    val binding = host.transferStockRequestedTrigger
    require(binding != null && binding.contract == transferStockRequestedTriggerContract,
      "trigger binding mismatch")
    val mapped = binding.map(source)
    require(mapped != null && mapped.transactionId != null && mapped.transactionId.nonEmpty,
      "stable host idempotency transaction id required")
    val codec = checkedArgsCodec(host)
    val bytes = codec.encode(mapped.args)
    require(bytes != null && codec.decode(bytes).map(codec.encode).get == bytes,
      "canonical trigger args required")
    require(codec.pin == argsPin, "args codec drift")
    StrictSagaCoordinator.Start(mapped.transactionId, bytes, replyTo)
  }

  val warehouseStockReceivedTriggerContract = TriggerContract(
    "warehouse-stock-received", "warehouse", "transfer-id", "transfer-id",
    Vector(
      InputContract("source-warehouse-id", "warehouse-id",
        ValueSource("args", "source-warehouse-id", "", "")),
      InputContract("target-warehouse-id", "warehouse-id",
        ValueSource("args", "target-warehouse-id", "", "")),
      InputContract("sku", "sku", ValueSource("args", "sku", "", "")),
      InputContract("quantity", "quantity", ValueSource("args", "quantity", "", "")),
      InputContract("transfer-mode", "transfer-mode",
        ValueSource("args", "transfer-mode", "", ""))),
    "example.stockreservation.saga.mapper.WarehouseStockReceivedArgsMapper",
    "example.stockreservation.saga.mapper.WarehouseStockReceivedIdempotencyMapper",
    "saga-version", "reject-different-args")
  trait WarehouseStockReceivedTriggerBinding {
    def contract: TriggerContract
    // Whole typed trigger, including the explicit idempotency source; never first/drop remaining.
    def map(source: StockReceivedEvent): TriggerStart
  }
  def warehouseStockReceivedTriggerStart(
      source: StockReceivedEvent,
      host: Host,
      replyTo: ActorRef[StrictSagaCoordinator.Reply]
  ): StrictSagaCoordinator.Start = {
    val binding = host.warehouseStockReceivedTrigger
    require(binding != null && binding.contract == warehouseStockReceivedTriggerContract,
      "trigger binding mismatch")
    val mapped = binding.map(source)
    require(mapped != null && mapped.transactionId != null && mapped.transactionId.nonEmpty,
      "stable host idempotency transaction id required")
    val codec = checkedArgsCodec(host)
    val bytes = codec.encode(mapped.args)
    require(bytes != null && codec.decode(bytes).map(codec.encode).get == bytes,
      "canonical trigger args required")
    require(codec.pin == argsPin, "args codec drift")
    StrictSagaCoordinator.Start(mapped.transactionId, bytes, replyTo)
  }

  final case class SucceededCompletionInput(transactionId: String,
    sourceWarehouseId: java.util.UUID)
  val succeededCompletionContract = CompletionContract(
    "succeeded", "stock-order", "stock-transfer-completed",
    "example.stockreservation.saga.mapper.SucceededCompletionMapper",
    Vector(
      InputContract("transaction-id", "transaction-id",
        ValueSource("transaction-id", "", "", "")),
      InputContract("source-warehouse-id", "warehouse-id",
        ValueSource("args", "source-warehouse-id", "", ""))))
  trait SucceededCompletionBinding {
    def contract: CompletionContract
    def map(identity: TransactionIdentity,
      input: SucceededCompletionInput): StockTransferCompletedEvent
  }
  // Explicit mapping only: the host must observe the matching durable result and
  // publish idempotently.
  def succeededCompletionEvent(
      identity: TransactionIdentity,
      args: Args,
      host: Host
  ): StockTransferCompletedEvent = {
    require(identity.definitionName == name && identity.definitionVersion == version &&
      identity.definitionDigest == definitionDigest, "completion identity mismatch")
    val binding = host.succeededCompletion
    require(binding != null && binding.contract == succeededCompletionContract,
      "completion binding mismatch")
    binding.map(identity, SucceededCompletionInput(identity.transactionId, args.sourceWarehouseId))
  }

  def definition(host: Host)(implicit ec: ExecutionContext): StrictSagaDefinition[Args] = {
    val codec = checkedArgsCodec(host)
    StrictSagaDefinition[Args](name, version, definitionDigest, codec, args => Vector(
      StrictParticipant[Args](
        "reserve-source-stock",
        "source-warehouse",
        host.sourceWarehouseResource(args.sourceWarehouseId),
        Map(
          Phase.Prepare -> PhaseBinding(reserveSourceStockPrepareBindingPort(host)),
          Phase.Commit -> PhaseBinding(reserveSourceStockCommitBindingPort(host)),
          Phase.Compensate -> PhaseBinding(reserveSourceStockCompensateBindingPort(host)))),
      StrictParticipant[Args](
        "commit-target-stock",
        "target-warehouse",
        host.targetWarehouseResource(args.targetWarehouseId),
        Map(
          Phase.Prepare -> PhaseBinding(commitTargetStockPrepareBindingPort(host)),
          Phase.Commit -> PhaseBinding(commitTargetStockCommitBindingPort(host)),
          Phase.Compensate -> PhaseBinding(commitTargetStockCompensateBindingPort(host))))))
  }
  def behavior(
      persistenceId: PersistenceId,
      host: Host,
      authorizer: ReconcileAuthorizer
  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {
    require(persistenceId != null && authorizer != null,
      "explicit persistence id and authorizer required")
    host.requireIndependentNamespace(persistenceId)
    val settings = host.settings
    require(settings != null && settings.interactionTimeout.toMillis == 1000,
      "coordinator timeout pin mismatch")
    StrictSagaCoordinator(persistenceId, definition(host), authorizer, settings)
  }
}
