package example.stockreservation.application.services.transactor

import akka.actor.typed.{ActorRef, Behavior}
import akka.persistence.typed.PersistenceId
import example.stockreservation.application.aggregates.LotProtocol
import example.stockreservation.domain.events.LotTransferCompletedEvent
import net.imadz.infra.saga.strict._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** 手写 strict 模块（#42 composition-invocation-host 组合供给，#40 族形状）：
  * wafer 转移的拆分侧 saga——remove-from-lot → add-to-lot，两个 participant 的
  * resourceSlot 逐字为 from/to（组合 builder B07 的 funding slot 合同）。触发
  * 命令 = LotProtocol.StartTransfer（组合两条 invocation 共享同一触发命令面）。
  * 收据 = 聚合回执产出 + 持久标记图精确重读（#41 F8/F10 证据语义）。与
  * WaferMergeSagaModule 结构孪生，仅身份/pin 不同——组合合同要求两条
  * invocation 指向不同 saga（独立 entry pid，oracle 的 exactly-once 才可构造）。
  * 上游候选旗标（#40 的 candidateArtifact 等）在此不适用：本模块是
  * admitted-by-construction 的手写供给，非生成候选（记档）。 */
object WaferMergeSagaModule {
  val name = "wafer-transfer-merge"
  val version = 1
  val definitionDigest = "sha256:42a80323e7a97b74ebb60f17cc990af25609c32857f27b3bbe499326b820f449"
  val argsPin = CodecPin("wafer-transfer-merge-args", 1)
  final case class Args(
      txid: String,
      from: String,
      to: String,
      wafers: List[String],
      manifest: String)
  final case class TriggerStart(transactionId: String, args: Args)
  final case class AddressContract(
      participant: String,
      resourceSlot: String,
      resourceType: String,
      aggregate: String,
      resolverFqn: String,
      mode: String)
  val fromLotResourceContract = AddressContract(
    "from-lot",
    "from",
    "lot-id",
    "lot",
    "example.stockreservation.domain.lot.LotRegistry",
    "exact-resource")
  val toLotResourceContract = AddressContract(
    "to-lot",
    "to",
    "lot-id",
    "lot",
    "example.stockreservation.domain.lot.LotRegistry",
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
  final case class IntegerShape(minimum: Long, maximum: Long) extends ValueShape
  /** 集合形状（#40 族 ValueShape 的记档扩展：wafer-list 的合同面；#40 发射器的
    * shapeOf 已有 Collection 分支但金样值形集未声明，本模块补齐）。 */
  final case class SequenceShape(elementShape: ValueShape, minItems: Int, maxItems: Int)
    extends ValueShape
  val requiredTypes: Vector[TypeContract] = Vector(
    TypeContract("transaction-id", "TransactionId", "java.lang.String",
      BoundedText("text", 1, 64)),
    TypeContract("lot-id", "LotId", "java.lang.String", BoundedText("text", 1, 64)),
    TypeContract(
      "wafer-list", "WaferList", "scala.collection.immutable.List",
      SequenceShape(BoundedText("text", 1, 64), 1, 64)),
    TypeContract("manifest", "Manifest", "java.lang.String", BoundedText("text", 1, 64)),
    TypeContract("count", "Count", "scala.Int", IntegerShape(0L, 64L)))
  final case class ArgsCodecContract(mapperFqn: String, id: String, version: String,
    compatibleVersions: Vector[String], runtimePin: CodecPin)
  val requiredArgsCodec = ArgsCodecContract(
    "example.stockreservation.saga.codec.WaferMergeArgsCodec",
    "wafer-transfer-merge-v1", "1.0.0", Vector("1.0.0"), argsPin)
  final case class HostRequirements(capabilities: Vector[String], totalDeadlineMs: Int,
    maxParticipants: Int, maxInFlight: Int, maxItemsPerChunk: Int, durableManifest: Boolean,
    businessInvariants: Vector[String], commitDecision: String, abortDecision: String,
    afterCommit: String, unknown: String, compensation: String, cancelBeforePrepare: String,
    retryIdentity: String, manualRecovery: String, maxAttempts: Int, phaseTimeoutMs: Int,
    queryTimeoutMs: Int, backoffMs: Int)
  val requiredHost = HostRequirements(
    Vector("durable-receipt", "exact-resource-addressing", "read-only-evidence-query"),
    30000, 8, 64, 500, true, Vector("wafer-conservation"),
    "durable-before-commit", "durable-before-compensate", "forward-recovery",
    "reconcile-before-resume",
    "confirmed-reservations", "empty-release-and-fence", "stable-operation",
    "authorized-reconciliation-evidence", 3, 5000, 2000, 250)
  trait Host {
    // canonical codec:
    //   example.stockreservation.saga.codec.WaferMergeArgsCodec, 1.0.0
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
    // pure exact-resource addressing; no I/O (lot resources are bounded text ids)
    def fromLotResource(resource: String): String
    // pure exact-resource addressing; no I/O
    def toLotResource(resource: String): String
    def fromLotResourceContract: AddressContract
    def toLotResourceContract: AddressContract
    def removeFromLotPrepareBinding: RemoveFromLotPrepareHostBinding
    def removeFromLotCommitBinding: RemoveFromLotCommitHostBinding
    def removeFromLotCompensateBinding: RemoveFromLotCompensateHostBinding
    def addToLotPrepareBinding: AddToLotPrepareHostBinding
    def addToLotCommitBinding: AddToLotCommitHostBinding
    def addToLotCompensateBinding: AddToLotCompensateHostBinding
    def waferTransferRequestedTrigger: WaferTransferRequestedTriggerBinding
    def succeededCompletion: SucceededCompletionBinding
  }
  private def checkedArgsCodec(host: Host): PayloadCodec[Args] = {
    require(host != null && host.argsCodec != null, "host canonical args codec required")
    host.requireImplemented(requiredHost, requiredTypes, requiredArgsCodec)
    require(
      host.fromLotResourceContract == fromLotResourceContract,
      "exact resource binding mismatch")
    require(
      host.toLotResourceContract == toLotResourceContract,
      "exact resource binding mismatch")
    val codec = host.argsCodec
    require(codec.pin == argsPin, "args codec pin mismatch")
    codec
  }

  final case class RemoveFromLotPrepareInput(
      transactionId: String, from: String, wafers: List[String])
  final case class RemoveFromLotPrepareReceipt(wafers: List[String])
  val removeFromLotPrepareBindingContract: PhaseContract = PhaseContract(
    "remove-from-lot", "from-lot", Phase.Prepare,
    "example.stockreservation.infrastructure.saga.RemoveFromLotPort",
    "example.stockreservation.saga.mapper.RemoveFromLotCommandMapper",
    "lot", "reserve-wafer-removal",
    Vector(
      InputContract("transaction-id", "transaction-id",
        ValueSource("transaction-id", "", "", "")),
      InputContract("from", "lot-id", ValueSource("args", "from", "", "")),
      InputContract("wafers", "wafer-list", ValueSource("args", "wafers", "", ""))),
    Vector(
      SlotContract("wafers", "wafer-list")),
    ConfirmationContract(
      "lot", "wafer-removal-reserved",
      "example.stockreservation.saga.mapper.RemoveFromLotPrepareConfirmationMapper",
      Vector(
        InputContract("wafers", "wafer-list",
          ValueSource("receipt-field", "wafers", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.RemoveFromLotPrepareQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.RemoveFromLotPrepareReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "wafer-tcc-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.RemoveFromLotPrepareIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "wafer-transfer-merge-remove-from-lot-prepare", "1.0.0",
    CodecPin("wafer-transfer-merge-remove-from-lot-prepare", 1))
  trait RemoveFromLotPrepareHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[RemoveFromLotPrepareReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: RemoveFromLotPrepareInput
    ): Future[PhaseOutcome[RemoveFromLotPrepareReceipt]]
    def query(
        identity: OperationIdentity,
        input: RemoveFromLotPrepareInput
    ): Future[PhaseOutcome[RemoveFromLotPrepareReceipt]]
  }
  private final class RemoveFromLotPreparePort(
      host: Host,
      binding: RemoveFromLotPrepareHostBinding,
      codec: PayloadCodec[RemoveFromLotPrepareReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, RemoveFromLotPrepareReceipt] {
    def receiptCodec: PayloadCodec[RemoveFromLotPrepareReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == removeFromLotPrepareBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[RemoveFromLotPrepareInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "remove-from-lot" &&
          request.identity.participantId == "from-lot" &&
          request.identity.phase == Phase.Prepare &&
          request.identity.resource == host.fromLotResource(request.args.from),
          "consumer identity mismatch")
        RemoveFromLotPrepareInput(
          request.identity.transaction.transactionId,
          request.args.from,
          request.args.wafers)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[RemoveFromLotPrepareReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[RemoveFromLotPrepareReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def removeFromLotPrepareBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, RemoveFromLotPrepareReceipt] = {
    val binding = host.removeFromLotPrepareBinding
    require(binding != null && binding.contract == removeFromLotPrepareBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("wafer-transfer-merge-remove-from-lot-prepare", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new RemoveFromLotPreparePort(host, binding, codec)
  }

  final case class RemoveFromLotCommitInput(wafers: List[String])
  final case class RemoveFromLotCommitReceipt(removedCount: Int)
  val removeFromLotCommitBindingContract: PhaseContract = PhaseContract(
    "remove-from-lot", "from-lot", Phase.Commit,
    "example.stockreservation.infrastructure.saga.RemoveFromLotPort",
    "example.stockreservation.saga.mapper.RemoveFromLotCommandMapper",
    "lot", "commit-wafer-removal",
    Vector(
      InputContract("wafers", "wafer-list",
        ValueSource("step-receipt", "wafers", "remove-from-lot", "prepare"))),
    Vector(
      SlotContract("removed-count", "count")),
    ConfirmationContract(
      "lot", "wafer-removal-committed",
      "example.stockreservation.saga.mapper.RemoveFromLotCommitConfirmationMapper",
      Vector(
        InputContract("removed-count", "count",
          ValueSource("receipt-field", "removed-count", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.RemoveFromLotCommitQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.RemoveFromLotCommitReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "wafer-tcc-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.RemoveFromLotCommitIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "wafer-transfer-merge-remove-from-lot-commit", "1.0.0",
    CodecPin("wafer-transfer-merge-remove-from-lot-commit", 1))
  trait RemoveFromLotCommitHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[RemoveFromLotCommitReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: RemoveFromLotCommitInput
    ): Future[PhaseOutcome[RemoveFromLotCommitReceipt]]
    def query(
        identity: OperationIdentity,
        input: RemoveFromLotCommitInput
    ): Future[PhaseOutcome[RemoveFromLotCommitReceipt]]
  }
  private final class RemoveFromLotCommitPort(
      host: Host,
      binding: RemoveFromLotCommitHostBinding,
      codec: PayloadCodec[RemoveFromLotCommitReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, RemoveFromLotCommitReceipt] {
    def receiptCodec: PayloadCodec[RemoveFromLotCommitReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == removeFromLotCommitBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[RemoveFromLotCommitInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "remove-from-lot" &&
          request.identity.participantId == "from-lot" &&
          request.identity.phase == Phase.Commit &&
          request.identity.resource == host.fromLotResource(request.args.from),
          "consumer identity mismatch")
        val removeFromLotPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "from-lot",
            host.fromLotResource(request.args.from),
            "remove-from-lot",
            Phase.Prepare),
          CodecPin("wafer-transfer-merge-remove-from-lot-prepare", 1),
          host.removeFromLotPrepareBinding.receiptCodec).get
        RemoveFromLotCommitInput(removeFromLotPrepare0.wafers)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[RemoveFromLotCommitReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[RemoveFromLotCommitReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def removeFromLotCommitBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, RemoveFromLotCommitReceipt] = {
    val binding = host.removeFromLotCommitBinding
    require(binding != null && binding.contract == removeFromLotCommitBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("wafer-transfer-merge-remove-from-lot-commit", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new RemoveFromLotCommitPort(host, binding, codec)
  }

  final case class RemoveFromLotCompensateInput(wafers: List[String])
  final case class RemoveFromLotCompensateReceipt(restoredCount: Int)
  val removeFromLotCompensateBindingContract: PhaseContract = PhaseContract(
    "remove-from-lot", "from-lot", Phase.Compensate,
    "example.stockreservation.infrastructure.saga.RemoveFromLotPort",
    "example.stockreservation.saga.mapper.RemoveFromLotCommandMapper",
    "lot", "restore-wafer-removal",
    Vector(
      InputContract("wafers", "wafer-list",
        ValueSource("step-receipt", "wafers", "remove-from-lot", "prepare"))),
    Vector(
      SlotContract("restored-count", "count")),
    ConfirmationContract(
      "lot", "wafer-removal-restored",
      "example.stockreservation.saga.mapper.RemoveFromLotCompensateConfirmationMapper",
      Vector(
        InputContract("restored-count", "count",
          ValueSource("receipt-field", "restored-count", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.RemoveFromLotCompensateQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.RemoveFromLotCompensateReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "wafer-tcc-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.RemoveFromLotCompensateIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "wafer-transfer-merge-remove-from-lot-compensate", "1.0.0",
    CodecPin("wafer-transfer-merge-remove-from-lot-compensate", 1))
  trait RemoveFromLotCompensateHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[RemoveFromLotCompensateReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: RemoveFromLotCompensateInput
    ): Future[PhaseOutcome[RemoveFromLotCompensateReceipt]]
    def query(
        identity: OperationIdentity,
        input: RemoveFromLotCompensateInput
    ): Future[PhaseOutcome[RemoveFromLotCompensateReceipt]]
  }
  private final class RemoveFromLotCompensatePort(
      host: Host,
      binding: RemoveFromLotCompensateHostBinding,
      codec: PayloadCodec[RemoveFromLotCompensateReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, RemoveFromLotCompensateReceipt] {
    def receiptCodec: PayloadCodec[RemoveFromLotCompensateReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == removeFromLotCompensateBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[RemoveFromLotCompensateInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "remove-from-lot" &&
          request.identity.participantId == "from-lot" &&
          request.identity.phase == Phase.Compensate &&
          request.identity.resource == host.fromLotResource(request.args.from),
          "consumer identity mismatch")
        val removeFromLotPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "from-lot",
            host.fromLotResource(request.args.from),
            "remove-from-lot",
            Phase.Prepare),
          CodecPin("wafer-transfer-merge-remove-from-lot-prepare", 1),
          host.removeFromLotPrepareBinding.receiptCodec).get
        RemoveFromLotCompensateInput(removeFromLotPrepare0.wafers)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[RemoveFromLotCompensateReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[RemoveFromLotCompensateReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def removeFromLotCompensateBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, RemoveFromLotCompensateReceipt] = {
    val binding = host.removeFromLotCompensateBinding
    require(binding != null && binding.contract == removeFromLotCompensateBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("wafer-transfer-merge-remove-from-lot-compensate", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new RemoveFromLotCompensatePort(host, binding, codec)
  }

  final case class AddToLotPrepareInput(transactionId: String, to: String, wafers: List[String])
  final case class AddToLotPrepareReceipt(wafers: List[String])
  val addToLotPrepareBindingContract: PhaseContract = PhaseContract(
    "add-to-lot", "to-lot", Phase.Prepare,
    "example.stockreservation.infrastructure.saga.AddToLotPort",
    "example.stockreservation.saga.mapper.AddToLotCommandMapper",
    "lot", "reserve-wafer-addition",
    Vector(
      InputContract("transaction-id", "transaction-id",
        ValueSource("transaction-id", "", "", "")),
      InputContract("to", "lot-id", ValueSource("args", "to", "", "")),
      InputContract("wafers", "wafer-list",
        ValueSource("step-receipt", "wafers", "remove-from-lot", "prepare"))),
    Vector(
      SlotContract("wafers", "wafer-list")),
    ConfirmationContract(
      "lot", "wafer-addition-reserved",
      "example.stockreservation.saga.mapper.AddToLotPrepareConfirmationMapper",
      Vector(
        InputContract("wafers", "wafer-list",
          ValueSource("receipt-field", "wafers", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.AddToLotPrepareQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.AddToLotPrepareReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "wafer-tcc-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.AddToLotPrepareIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "wafer-transfer-merge-add-to-lot-prepare", "1.0.0",
    CodecPin("wafer-transfer-merge-add-to-lot-prepare", 1))
  trait AddToLotPrepareHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[AddToLotPrepareReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: AddToLotPrepareInput
    ): Future[PhaseOutcome[AddToLotPrepareReceipt]]
    def query(
        identity: OperationIdentity,
        input: AddToLotPrepareInput
    ): Future[PhaseOutcome[AddToLotPrepareReceipt]]
  }
  private final class AddToLotPreparePort(
      host: Host,
      binding: AddToLotPrepareHostBinding,
      codec: PayloadCodec[AddToLotPrepareReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, AddToLotPrepareReceipt] {
    def receiptCodec: PayloadCodec[AddToLotPrepareReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == addToLotPrepareBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[AddToLotPrepareInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "add-to-lot" &&
          request.identity.participantId == "to-lot" &&
          request.identity.phase == Phase.Prepare &&
          request.identity.resource == host.toLotResource(request.args.to),
          "consumer identity mismatch")
        val removeFromLotPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "from-lot",
            host.fromLotResource(request.args.from),
            "remove-from-lot",
            Phase.Prepare),
          CodecPin("wafer-transfer-merge-remove-from-lot-prepare", 1),
          host.removeFromLotPrepareBinding.receiptCodec).get
        AddToLotPrepareInput(
          request.identity.transaction.transactionId,
          request.args.to,
          removeFromLotPrepare0.wafers)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[AddToLotPrepareReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[AddToLotPrepareReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def addToLotPrepareBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, AddToLotPrepareReceipt] = {
    val binding = host.addToLotPrepareBinding
    require(binding != null && binding.contract == addToLotPrepareBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("wafer-transfer-merge-add-to-lot-prepare", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new AddToLotPreparePort(host, binding, codec)
  }

  final case class AddToLotCommitInput(wafers: List[String])
  final case class AddToLotCommitReceipt(addedCount: Int)
  val addToLotCommitBindingContract: PhaseContract = PhaseContract(
    "add-to-lot", "to-lot", Phase.Commit,
    "example.stockreservation.infrastructure.saga.AddToLotPort",
    "example.stockreservation.saga.mapper.AddToLotCommandMapper",
    "lot", "commit-wafer-addition",
    Vector(
      InputContract("wafers", "wafer-list",
        ValueSource("step-receipt", "wafers", "add-to-lot", "prepare"))),
    Vector(
      SlotContract("added-count", "count")),
    ConfirmationContract(
      "lot", "wafer-addition-committed",
      "example.stockreservation.saga.mapper.AddToLotCommitConfirmationMapper",
      Vector(
        InputContract("added-count", "count",
          ValueSource("receipt-field", "added-count", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.AddToLotCommitQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.AddToLotCommitReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "wafer-tcc-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.AddToLotCommitIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "wafer-transfer-merge-add-to-lot-commit", "1.0.0",
    CodecPin("wafer-transfer-merge-add-to-lot-commit", 1))
  trait AddToLotCommitHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[AddToLotCommitReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: AddToLotCommitInput
    ): Future[PhaseOutcome[AddToLotCommitReceipt]]
    def query(
        identity: OperationIdentity,
        input: AddToLotCommitInput
    ): Future[PhaseOutcome[AddToLotCommitReceipt]]
  }
  private final class AddToLotCommitPort(
      host: Host,
      binding: AddToLotCommitHostBinding,
      codec: PayloadCodec[AddToLotCommitReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, AddToLotCommitReceipt] {
    def receiptCodec: PayloadCodec[AddToLotCommitReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == addToLotCommitBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[AddToLotCommitInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "add-to-lot" &&
          request.identity.participantId == "to-lot" &&
          request.identity.phase == Phase.Commit &&
          request.identity.resource == host.toLotResource(request.args.to),
          "consumer identity mismatch")
        val addToLotPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "to-lot",
            host.toLotResource(request.args.to),
            "add-to-lot",
            Phase.Prepare),
          CodecPin("wafer-transfer-merge-add-to-lot-prepare", 1),
          host.addToLotPrepareBinding.receiptCodec).get
        AddToLotCommitInput(addToLotPrepare0.wafers)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[AddToLotCommitReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[AddToLotCommitReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def addToLotCommitBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, AddToLotCommitReceipt] = {
    val binding = host.addToLotCommitBinding
    require(binding != null && binding.contract == addToLotCommitBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("wafer-transfer-merge-add-to-lot-commit", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new AddToLotCommitPort(host, binding, codec)
  }

  final case class AddToLotCompensateInput(wafers: List[String])
  final case class AddToLotCompensateReceipt(restoredCount: Int)
  val addToLotCompensateBindingContract: PhaseContract = PhaseContract(
    "add-to-lot", "to-lot", Phase.Compensate,
    "example.stockreservation.infrastructure.saga.AddToLotPort",
    "example.stockreservation.saga.mapper.AddToLotCommandMapper",
    "lot", "restore-wafer-addition",
    Vector(
      InputContract("wafers", "wafer-list",
        ValueSource("step-receipt", "wafers", "add-to-lot", "prepare"))),
    Vector(
      SlotContract("restored-count", "count")),
    ConfirmationContract(
      "lot", "wafer-addition-restored",
      "example.stockreservation.saga.mapper.AddToLotCompensateConfirmationMapper",
      Vector(
        InputContract("restored-count", "count",
          ValueSource("receipt-field", "restored-count", "", "")))),
    QueryContract(
      "example.stockreservation.saga.mapper.AddToLotCompensateQueryMapper",
      "read-only",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      Vector("confirmed", "not-executed", "unknown")),
    ReceiptContract(
      "example.stockreservation.saga.mapper.AddToLotCompensateReceiptMapper",
      "1.0.0", true,
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "exact", "wafer-tcc-effect-reconciliation"),
    IdempotencyContract(
      "example.stockreservation.saga.mapper.AddToLotCompensateIdempotencyMapper",
      Vector("txid", "definition-version", "participant", "resource",
        "step", "phase"),
      "reject", "excluded"),
    "wafer-transfer-merge-add-to-lot-compensate", "1.0.0",
    CodecPin("wafer-transfer-merge-add-to-lot-compensate", 1))
  trait AddToLotCompensateHostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[AddToLotCompensateReceipt]
    def querySafety: QuerySafety
    def execute(
        identity: OperationIdentity,
        input: AddToLotCompensateInput
    ): Future[PhaseOutcome[AddToLotCompensateReceipt]]
    def query(
        identity: OperationIdentity,
        input: AddToLotCompensateInput
    ): Future[PhaseOutcome[AddToLotCompensateReceipt]]
  }
  private final class AddToLotCompensatePort(
      host: Host,
      binding: AddToLotCompensateHostBinding,
      codec: PayloadCodec[AddToLotCompensateReceipt]
  )(implicit ec: ExecutionContext) extends PhasePort[Args, AddToLotCompensateReceipt] {
    def receiptCodec: PayloadCodec[AddToLotCompensateReceipt] = {
      require(binding.receiptCodec eq codec, "host receipt codec replacement")
      require(binding.contract == addToLotCompensateBindingContract,
        "technical phase binding drift")
      codec
    }
    def querySafety: QuerySafety = binding.querySafety
    private def input(request: OperationRequest[Args]): Future[AddToLotCompensateInput] =
      Future.fromTry(Try {
        require(
          request.identity.stepId == "add-to-lot" &&
          request.identity.participantId == "to-lot" &&
          request.identity.phase == Phase.Compensate &&
          request.identity.resource == host.toLotResource(request.args.to),
          "consumer identity mismatch")
        val addToLotPrepare0 = request.receipt(
          OperationIdentity(
            request.identity.transaction,
            "to-lot",
            host.toLotResource(request.args.to),
            "add-to-lot",
            Phase.Prepare),
          CodecPin("wafer-transfer-merge-add-to-lot-prepare", 1),
          host.addToLotPrepareBinding.receiptCodec).get
        AddToLotCompensateInput(addToLotPrepare0.wafers)
      })
    def execute(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[AddToLotCompensateReceipt]] =
      input(request).flatMap(value => binding.execute(request.identity, value))
    def query(
        request: OperationRequest[Args]
    ): Future[PhaseOutcome[AddToLotCompensateReceipt]] =
      input(request).flatMap(value => binding.query(request.identity, value))
  }
  private def addToLotCompensateBindingPort(host: Host)(
      implicit ec: ExecutionContext): PhasePort[Args, AddToLotCompensateReceipt] = {
    val binding = host.addToLotCompensateBinding
    require(binding != null && binding.contract == addToLotCompensateBindingContract,
      "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(
      codec != null && codec.pin == CodecPin("wafer-transfer-merge-add-to-lot-compensate", 1),
      "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new AddToLotCompensatePort(host, binding, codec)
  }

  val waferTransferRequestedTriggerContract = TriggerContract(
    "wafer-transfer-requested", "lot", "txid", "transaction-id",
    Vector(
      InputContract("txid", "transaction-id", ValueSource("args", "txid", "", "")),
      InputContract("from", "lot-id", ValueSource("args", "from", "", "")),
      InputContract("to", "lot-id", ValueSource("args", "to", "", "")),
      InputContract("wafers", "wafer-list", ValueSource("args", "wafers", "", "")),
      InputContract("manifest", "manifest", ValueSource("args", "manifest", "", ""))),
    "example.stockreservation.saga.mapper.WaferTransferRequestedArgsMapper",
    "example.stockreservation.saga.mapper.WaferTransferRequestedIdempotencyMapper",
    "saga-version", "reject-different-args")
  trait WaferTransferRequestedTriggerBinding {
    def contract: TriggerContract
    // Whole typed trigger, including the explicit idempotency source; never first/drop remaining.
    def map(source: LotProtocol.StartTransfer): TriggerStart
  }
  def waferTransferRequestedTriggerStart(
      source: LotProtocol.StartTransfer,
      host: Host,
      replyTo: ActorRef[StrictSagaCoordinator.Reply]
  ): StrictSagaCoordinator.Start = {
    val binding = host.waferTransferRequestedTrigger
    require(binding != null && binding.contract == waferTransferRequestedTriggerContract,
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

  final case class SucceededCompletionInput(transactionId: String, from: String, to: String)
  val succeededCompletionContract = CompletionContract(
    "succeeded", "lot", "lot-transfer-completed",
    "example.stockreservation.saga.mapper.SucceededCompletionMapper",
    Vector(
      InputContract("transaction-id", "transaction-id",
        ValueSource("transaction-id", "", "", "")),
      InputContract("from", "lot-id", ValueSource("args", "from", "", "")),
      InputContract("to", "lot-id", ValueSource("args", "to", "", ""))))
  trait SucceededCompletionBinding {
    def contract: CompletionContract
    def map(identity: TransactionIdentity,
      input: SucceededCompletionInput): LotTransferCompletedEvent
  }
  // Explicit mapping only: the host must observe the matching durable result and
  // publish idempotently.
  def succeededCompletionEvent(
      identity: TransactionIdentity,
      args: Args,
      host: Host
  ): LotTransferCompletedEvent = {
    require(identity.definitionName == name && identity.definitionVersion == version &&
      identity.definitionDigest == definitionDigest, "completion identity mismatch")
    val binding = host.succeededCompletion
    require(binding != null && binding.contract == succeededCompletionContract,
      "completion binding mismatch")
    binding.map(identity, SucceededCompletionInput(identity.transactionId, args.from, args.to))
  }

  def definition(host: Host)(implicit ec: ExecutionContext): StrictSagaDefinition[Args] = {
    val codec = checkedArgsCodec(host)
    StrictSagaDefinition[Args](name, version, definitionDigest, codec, args => Vector(
      StrictParticipant[Args](
        "remove-from-lot",
        "from-lot",
        host.fromLotResource(args.from),
        Map(
          Phase.Prepare -> PhaseBinding(removeFromLotPrepareBindingPort(host)),
          Phase.Commit -> PhaseBinding(removeFromLotCommitBindingPort(host)),
          Phase.Compensate -> PhaseBinding(removeFromLotCompensateBindingPort(host)))),
      StrictParticipant[Args](
        "add-to-lot",
        "to-lot",
        host.toLotResource(args.to),
        Map(
          Phase.Prepare -> PhaseBinding(addToLotPrepareBindingPort(host)),
          Phase.Commit -> PhaseBinding(addToLotCommitBindingPort(host)),
          Phase.Compensate -> PhaseBinding(addToLotCompensateBindingPort(host))))))
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
