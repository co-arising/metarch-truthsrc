package example.stockreservation.application.services.transactor

import akka.persistence.typed.PersistenceId
import example.stockreservation.application.aggregates.TransferStockCommand
import example.stockreservation.domain.events.{StockReceivedEvent, StockTransferCompletedEvent}
import example.stockreservation.application.services.transactor.StockTransferSagaModule
import example.stockreservation.application.services.transactor.StockTransferSagaModule._
import net.imadz.infra.saga.strict._
import scala.concurrent.Future

/** 探针 Host（Support 层）：模块 Host trait 的全部抽象义务实现。六相位 binding 共享
  * 记录基类；armedExecute/armedQuery 分离武装（默认＝ConfirmedReceipt(identity, 定值
  * 收据)，identity 取协调器传入的操作身份，证据键恒匹配）。codec/contract 武装位用于
  * 漂移围栏性质；failImplemented 用于护栏性质。 */
abstract class ProbePhaseBinding[I, R](initialCodec: PayloadCodec[R],
    fixedContract: PhaseContract) {
  var armedContract: PhaseContract = fixedContract
  var armedCodec: PayloadCodec[R] = initialCodec
  var armedExecute: OperationIdentity => Future[PhaseOutcome[R]] =
    identity => Future.successful(ConfirmedReceipt(identity, defaultReceipt))
  var armedQuery: OperationIdentity => Future[PhaseOutcome[R]] =
    identity => Future.successful(ConfirmedReceipt(identity, defaultReceipt))
  val executions = new ValueLog[(OperationIdentity, I)]
  val queries = new ValueLog[(OperationIdentity, I)]
  def contract: PhaseContract = armedContract
  def receiptCodec: PayloadCodec[R] = armedCodec
  def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
  def defaultReceipt: R
  def deliver(identity: OperationIdentity, input: I): Future[PhaseOutcome[R]] = {
    executions.record((identity, input))
    armedExecute(identity)
  }
  def probeCall(identity: OperationIdentity, input: I): Future[PhaseOutcome[R]] = {
    queries.record((identity, input))
    armedQuery(identity)
  }
}

final class ProbeReserveSourceStockPrepareBinding(initialCodec: PayloadCodec[
    StockTransferSagaModule.ReserveSourceStockPrepareReceipt])
  extends ProbePhaseBinding[StockTransferSagaModule.ReserveSourceStockPrepareInput,
    StockTransferSagaModule.ReserveSourceStockPrepareReceipt](initialCodec,
    StockTransferSagaModule.reserveSourceStockPrepareBindingContract)
  with StockTransferSagaModule.ReserveSourceStockPrepareHostBinding {
  def defaultReceipt: StockTransferSagaModule.ReserveSourceStockPrepareReceipt =
    StockTransferSagaModule.ReserveSourceStockPrepareReceipt(ProbeFixtures.reservationOne,
      ProbeFixtures.defaultQuantity)
  def execute(identity: OperationIdentity,
      input: StockTransferSagaModule.ReserveSourceStockPrepareInput
  ): Future[PhaseOutcome[StockTransferSagaModule.ReserveSourceStockPrepareReceipt]] =
    deliver(identity, input)
  def query(identity: OperationIdentity,
      input: StockTransferSagaModule.ReserveSourceStockPrepareInput
  ): Future[PhaseOutcome[StockTransferSagaModule.ReserveSourceStockPrepareReceipt]] =
    probeCall(identity, input)
}

final class ProbeReserveSourceStockCommitBinding(initialCodec: PayloadCodec[
    StockTransferSagaModule.ReserveSourceStockCommitReceipt])
  extends ProbePhaseBinding[StockTransferSagaModule.ReserveSourceStockCommitInput,
    StockTransferSagaModule.ReserveSourceStockCommitReceipt](initialCodec,
    StockTransferSagaModule.reserveSourceStockCommitBindingContract)
  with StockTransferSagaModule.ReserveSourceStockCommitHostBinding {
  def defaultReceipt: StockTransferSagaModule.ReserveSourceStockCommitReceipt =
    StockTransferSagaModule.ReserveSourceStockCommitReceipt(ProbeFixtures.defaultQuantity)
  def execute(identity: OperationIdentity,
      input: StockTransferSagaModule.ReserveSourceStockCommitInput
  ): Future[PhaseOutcome[StockTransferSagaModule.ReserveSourceStockCommitReceipt]] =
    deliver(identity, input)
  def query(identity: OperationIdentity,
      input: StockTransferSagaModule.ReserveSourceStockCommitInput
  ): Future[PhaseOutcome[StockTransferSagaModule.ReserveSourceStockCommitReceipt]] =
    probeCall(identity, input)
}

final class ProbeReserveSourceStockCompensateBinding(initialCodec: PayloadCodec[
    StockTransferSagaModule.ReserveSourceStockCompensateReceipt])
  extends ProbePhaseBinding[StockTransferSagaModule.ReserveSourceStockCompensateInput,
    StockTransferSagaModule.ReserveSourceStockCompensateReceipt](initialCodec,
    StockTransferSagaModule.reserveSourceStockCompensateBindingContract)
  with StockTransferSagaModule.ReserveSourceStockCompensateHostBinding {
  def defaultReceipt: StockTransferSagaModule.ReserveSourceStockCompensateReceipt =
    StockTransferSagaModule.ReserveSourceStockCompensateReceipt(ProbeFixtures.defaultQuantity)
  def execute(identity: OperationIdentity,
      input: StockTransferSagaModule.ReserveSourceStockCompensateInput
  ): Future[PhaseOutcome[StockTransferSagaModule.ReserveSourceStockCompensateReceipt]] =
    deliver(identity, input)
  def query(identity: OperationIdentity,
      input: StockTransferSagaModule.ReserveSourceStockCompensateInput
  ): Future[PhaseOutcome[StockTransferSagaModule.ReserveSourceStockCompensateReceipt]] =
    probeCall(identity, input)
}

final class ProbeCommitTargetStockPrepareBinding(initialCodec: PayloadCodec[
    StockTransferSagaModule.CommitTargetStockPrepareReceipt])
  extends ProbePhaseBinding[StockTransferSagaModule.CommitTargetStockPrepareInput,
    StockTransferSagaModule.CommitTargetStockPrepareReceipt](initialCodec,
    StockTransferSagaModule.commitTargetStockPrepareBindingContract)
  with StockTransferSagaModule.CommitTargetStockPrepareHostBinding {
  def defaultReceipt: StockTransferSagaModule.CommitTargetStockPrepareReceipt =
    StockTransferSagaModule.CommitTargetStockPrepareReceipt(ProbeFixtures.orderTwo,
      ProbeFixtures.defaultQuantity)
  def execute(identity: OperationIdentity,
      input: StockTransferSagaModule.CommitTargetStockPrepareInput
  ): Future[PhaseOutcome[StockTransferSagaModule.CommitTargetStockPrepareReceipt]] =
    deliver(identity, input)
  def query(identity: OperationIdentity,
      input: StockTransferSagaModule.CommitTargetStockPrepareInput
  ): Future[PhaseOutcome[StockTransferSagaModule.CommitTargetStockPrepareReceipt]] =
    probeCall(identity, input)
}

final class ProbeCommitTargetStockCommitBinding(initialCodec: PayloadCodec[
    StockTransferSagaModule.CommitTargetStockCommitReceipt])
  extends ProbePhaseBinding[StockTransferSagaModule.CommitTargetStockCommitInput,
    StockTransferSagaModule.CommitTargetStockCommitReceipt](initialCodec,
    StockTransferSagaModule.commitTargetStockCommitBindingContract)
  with StockTransferSagaModule.CommitTargetStockCommitHostBinding {
  def defaultReceipt: StockTransferSagaModule.CommitTargetStockCommitReceipt =
    StockTransferSagaModule.CommitTargetStockCommitReceipt(ProbeFixtures.defaultQuantity)
  def execute(identity: OperationIdentity,
      input: StockTransferSagaModule.CommitTargetStockCommitInput
  ): Future[PhaseOutcome[StockTransferSagaModule.CommitTargetStockCommitReceipt]] =
    deliver(identity, input)
  def query(identity: OperationIdentity,
      input: StockTransferSagaModule.CommitTargetStockCommitInput
  ): Future[PhaseOutcome[StockTransferSagaModule.CommitTargetStockCommitReceipt]] =
    probeCall(identity, input)
}

final class ProbeCommitTargetStockCompensateBinding(initialCodec: PayloadCodec[
    StockTransferSagaModule.CommitTargetStockCompensateReceipt])
  extends ProbePhaseBinding[StockTransferSagaModule.CommitTargetStockCompensateInput,
    StockTransferSagaModule.CommitTargetStockCompensateReceipt](initialCodec,
    StockTransferSagaModule.commitTargetStockCompensateBindingContract)
  with StockTransferSagaModule.CommitTargetStockCompensateHostBinding {
  def defaultReceipt: StockTransferSagaModule.CommitTargetStockCompensateReceipt =
    StockTransferSagaModule.CommitTargetStockCompensateReceipt(ProbeFixtures.defaultQuantity)
  def execute(identity: OperationIdentity,
      input: StockTransferSagaModule.CommitTargetStockCompensateInput
  ): Future[PhaseOutcome[StockTransferSagaModule.CommitTargetStockCompensateReceipt]] =
    deliver(identity, input)
  def query(identity: OperationIdentity,
      input: StockTransferSagaModule.CommitTargetStockCompensateInput
  ): Future[PhaseOutcome[StockTransferSagaModule.CommitTargetStockCompensateReceipt]] =
    probeCall(identity, input)
}

final class ProbeTransferStockRequestedBinding
  extends StockTransferSagaModule.TransferStockRequestedTriggerBinding {
  var armedContract: TriggerContract = StockTransferSagaModule.transferStockRequestedTriggerContract
  var armedStart: Option[StockTransferSagaModule.TriggerStart] = None
  def contract: TriggerContract = armedContract
  val mapped = new ValueLog[TransferStockCommand]
  def map(source: TransferStockCommand): StockTransferSagaModule.TriggerStart = {
    mapped.record(source)
    armedStart.getOrElse(StockTransferSagaModule.TriggerStart(source.transferId.toString,
      StockTransferSagaModule.Args(source.sourceWarehouseId, source.targetWarehouseId,
        source.sku, source.quantity, source.transferMode)))
  }
}

final class ProbeWarehouseStockReceivedBinding
  extends StockTransferSagaModule.WarehouseStockReceivedTriggerBinding {
  var armedContract: TriggerContract = StockTransferSagaModule.warehouseStockReceivedTriggerContract
  var armedStart: Option[StockTransferSagaModule.TriggerStart] = None
  def contract: TriggerContract = armedContract
  val mapped = new ValueLog[StockReceivedEvent]
  def map(source: StockReceivedEvent): StockTransferSagaModule.TriggerStart = {
    mapped.record(source)
    armedStart.getOrElse(StockTransferSagaModule.TriggerStart("received-" +
      source.receivedQuantity, StockTransferSagaModule.Args(source.warehouseId,
      source.warehouseId, source.sku, source.receivedQuantity, "STANDARD")))
  }
}

final class ProbeSucceededCompletionBinding
  extends StockTransferSagaModule.SucceededCompletionBinding {
  var armedContract: CompletionContract = StockTransferSagaModule.succeededCompletionContract
  def contract: CompletionContract = armedContract
  val mapped = new ValueLog[StockTransferSagaModule.SucceededCompletionInput]
  def map(identity: TransactionIdentity,
      input: StockTransferSagaModule.SucceededCompletionInput): StockTransferCompletedEvent = {
    mapped.record(input)
    StockTransferCompletedEvent(input.transactionId, input.sourceWarehouseId)
  }
}

final class ProbeAuthorizer extends ReconcileAuthorizer {
  var deniedReason: Option[String] = None
  var throwOnAuthorize: Boolean = false
  val asked = new ValueLog[String]
  def authorize(identity: TransactionIdentity, token: String): Either[String, String] = {
    asked.record(token)
    if (throwOnAuthorize) throw new IllegalArgumentException("authorizer crashed")
    deniedReason.fold[Either[String, String]](Right("probe-principal"))(Left(_))
  }
}

class ProbeHost(val probeArgsCodec: PayloadCodec[StockTransferSagaModule.Args],
    val probeSettings: StrictSagaCoordinator.Settings) extends StockTransferSagaModule.Host {
  val argsValue: StockTransferSagaModule.Args = StockTransferSagaModule.Args(
    ProbeFixtures.warehouseOne, ProbeFixtures.warehouseTwo, "SKU-100",
    ProbeFixtures.defaultQuantity, "STANDARD")
  var failImplemented: Boolean = false
  val implementedCalls = new ValueLog[String]
  val namespaceChecks = new ValueLog[String]
  val reserveSourceStockPrepareBinding =
    new ProbeReserveSourceStockPrepareBinding(ProbeReceipts.reserveSourceStockPrepare)
  val reserveSourceStockCommitBinding =
    new ProbeReserveSourceStockCommitBinding(ProbeReceipts.reserveSourceStockCommit)
  val reserveSourceStockCompensateBinding =
    new ProbeReserveSourceStockCompensateBinding(ProbeReceipts.reserveSourceStockCompensate)
  val commitTargetStockPrepareBinding =
    new ProbeCommitTargetStockPrepareBinding(ProbeReceipts.commitTargetStockPrepare)
  val commitTargetStockCommitBinding =
    new ProbeCommitTargetStockCommitBinding(ProbeReceipts.commitTargetStockCommit)
  val commitTargetStockCompensateBinding =
    new ProbeCommitTargetStockCompensateBinding(ProbeReceipts.commitTargetStockCompensate)
  val transferStockRequestedTrigger = new ProbeTransferStockRequestedBinding
  val warehouseStockReceivedTrigger = new ProbeWarehouseStockReceivedBinding
  val succeededCompletion = new ProbeSucceededCompletionBinding
  def requireImplemented(requirements: StockTransferSagaModule.HostRequirements,
      types: Vector[StockTransferSagaModule.TypeContract],
      argsCodec: StockTransferSagaModule.ArgsCodecContract): Unit = {
    implementedCalls.record(s"${requirements.totalDeadlineMs}/${types.size}/${argsCodec.id}")
    if (failImplemented) throw new IllegalArgumentException("probe host implementation unavailable")
  }
  def requireIndependentNamespace(persistenceId: PersistenceId): Unit =
    namespaceChecks.record(persistenceId.id)
  def argsCodec: PayloadCodec[StockTransferSagaModule.Args] = probeArgsCodec
  def settings: StrictSagaCoordinator.Settings = probeSettings
  def sourceWarehouseResource(resource: java.util.UUID): String =
    "warehouse:" + resource.toString
  def targetWarehouseResource(resource: java.util.UUID): String =
    "warehouse:" + resource.toString
  def sourceWarehouseResourceContract: AddressContract =
    StockTransferSagaModule.sourceWarehouseResourceContract
  def targetWarehouseResourceContract: AddressContract =
    StockTransferSagaModule.targetWarehouseResourceContract
}

final class AddressDriftHost(codec: PayloadCodec[StockTransferSagaModule.Args],
    settings: StrictSagaCoordinator.Settings) extends ProbeHost(codec, settings) {
  override def sourceWarehouseResourceContract: AddressContract =
    StockTransferSagaModule.sourceWarehouseResourceContract.copy(aggregate = "drifted-warehouse")
}

final class ArgsPinDriftHost(settings: StrictSagaCoordinator.Settings)
  extends ProbeHost(new ProbeArgsCodec(CodecPin("stock-transfer-args", 9)), settings)
