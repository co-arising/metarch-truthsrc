package example.stockreservation.application.services.transactor

import example.stockreservation.application.aggregates.TransferStockCommand
import example.stockreservation.domain.events.{StockReceivedEvent, StockTransferCompletedEvent}
import example.stockreservation.application.services.transactor.StockTransferSagaModule
import net.imadz.infra.saga.strict._
import org.scalacheck.Gen
import java.util.UUID

/** 输入形状（Support 层）：随机合法面＋completion 身份构造。非法面（护栏负测）
  * 走武装位与漂移 codec，不经生成器污染。 */
object SagaModuleCases {
  val genWarehouseId: Gen[UUID] = Gen.uuid
  val genSku: Gen[String] =
    Gen.nonEmptyListOf(Gen.alphaNumChar).map(chars => chars.take(12).mkString)
  val genQuantity: Gen[Int] = Gen.chooseNum(1, 1000)
  val genTransferMode: Gen[String] = Gen.oneOf("STANDARD", "URGENT")
  val genWarehousePair: Gen[(UUID, UUID)] =
    for { source <- genWarehouseId; target <- genWarehouseId } yield (source, target)
  val genArgs: Gen[StockTransferSagaModule.Args] = for {
    pair <- genWarehousePair
    sku <- genSku
    quantity <- genQuantity
    mode <- genTransferMode
  } yield StockTransferSagaModule.Args(pair._1, pair._2, sku, quantity, mode)
  val genCommand: Gen[TransferStockCommand] = for {
    transferId <- genWarehouseId
    args <- genArgs
  } yield TransferStockCommand(transferId, args.sourceWarehouseId, args.targetWarehouseId,
    args.sku, args.quantity, args.transferMode)
  val genEvent: Gen[StockReceivedEvent] = for {
    warehouseId <- genWarehouseId
    sku <- genSku
    quantity <- genQuantity
  } yield StockReceivedEvent(warehouseId, sku, quantity)
  val genTransactionId: Gen[String] =
    Gen.nonEmptyListOf(Gen.alphaNumChar).map(chars => chars.take(24).mkString)

  /** completion 身份构造：定义三元组可注入漂移（负测），digest/pin 位为探针占位
    * （memberEvent 只核 definitionName/Version/Digest 三分量）。 */
  def completionIdentity(transactionId: String, definitionName: String,
      definitionVersion: Int, definitionDigest: String): TransactionIdentity =
    TransactionIdentity(transactionId, definitionName, definitionVersion, "args-digest-probe",
      definitionDigest, CodecPin("stock-transfer-args", 1), "plan-digest-probe")

  def moduleIdentity(transactionId: String): TransactionIdentity =
    completionIdentity(transactionId, StockTransferSagaModule.name,
      StockTransferSagaModule.version, StockTransferSagaModule.definitionDigest)
}
