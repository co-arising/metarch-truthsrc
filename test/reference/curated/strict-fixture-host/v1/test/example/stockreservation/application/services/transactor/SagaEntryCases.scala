package example.stockreservation.application.services.transactor

import example.stockreservation.application.aggregates.TransferStockCommand
import example.stockreservation.domain.events.StockReceivedEvent
import java.util.UUID

/** 输入形状（Support 层）：固定确定性 UUID 与最小生成器。所有身份确定性——
  * 无随机面；Gen 只驱动文本/数量域，UUID 全部来自固定字面量或
  * nameUUIDFromBytes 派生。 */
object SagaEntryCases {

  val warehouseOne: UUID = UUID.fromString("00000000-0000-0000-0000-000000000011")
  val warehouseTwo: UUID = UUID.fromString("00000000-0000-0000-0000-000000000012")
  val warehouseThree: UUID = UUID.fromString("00000000-0000-0000-0000-000000000013")
  val reservationOne: UUID = UUID.fromString("00000000-0000-0000-0000-000000000001")
  val orderTwo: UUID = UUID.fromString("00000000-0000-0000-0000-000000000002")
  val transferZero: UUID = UUID.fromString("00000000-0000-0000-0000-0000000000aa")

  val skuAlpha: String = "sku-alpha-001"
  val skuBeta: String = "sku-beta-002"
  val modeStandard: String = "STANDARD"
  val modeUrgent: String = "URGENT"

  def argsOf(source: UUID, target: UUID, sku: String, quantity: Int,
      mode: String): StockTransferSagaModule.Args =
    StockTransferSagaModule.Args(source, target, sku, quantity, mode)

  val standardArgs: StockTransferSagaModule.Args =
    argsOf(warehouseOne, warehouseTwo, skuAlpha, 30, modeStandard)

  def commandOf(transferId: UUID, source: UUID, target: UUID, sku: String, quantity: Int,
      mode: String): TransferStockCommand =
    TransferStockCommand(transferId, source, target, sku, quantity, mode)

  val standardCommand: TransferStockCommand =
    commandOf(transferZero, warehouseOne, warehouseTwo, skuAlpha, 30, modeStandard)

  def receivedOf(warehouse: UUID, sku: String, quantity: Int): StockReceivedEvent =
    StockReceivedEvent(warehouse, sku, quantity)

  /** 确定性 warehouse 实体 id 集（避免同性质间互踩共享 journal 键）。 */
  private val seqCounter = new java.util.concurrent.atomic.AtomicInteger(400)
  def nextWarehouseId: UUID =
    UUID.nameUUIDFromBytes(
      s"warehouse-${seqCounter.incrementAndGet()}".
        getBytes(java.nio.charset.StandardCharsets.UTF_8))

  /** 直接驱动宿主 binding 用的相位身份（模块常量 + 指定资源）。 */
  def hostIdentity(transactionId: String, resource: String,
      phase: net.imadz.infra.saga.strict.Phase = net.imadz.infra.saga.strict.Phase.Prepare
  ): net.imadz.infra.saga.strict.OperationIdentity =
    net.imadz.infra.saga.strict.OperationIdentity(
      net.imadz.infra.saga.strict.TransactionIdentity(transactionId,
        StockTransferSagaModule.name, StockTransferSagaModule.version,
        "args-digest-fixture", StockTransferSagaModule.definitionDigest,
        StockTransferSagaModule.argsPin, "plan-digest-fixture"),
      "source-warehouse", resource, "reserve-source-stock", phase)
}
