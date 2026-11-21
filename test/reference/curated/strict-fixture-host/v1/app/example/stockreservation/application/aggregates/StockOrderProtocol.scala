package example.stockreservation.application.aggregates

import net.imadz.common.CommonTypes.Id

/** 手写业务供给（#40 strict-saga-module）：Saga 触发源命令——
  * transfer-stock-requested（command trigger）的 sourceType 消费面。
  * 聚合行为命令面（typed replyTo/CommandHelper）归相邻聚合族，不在本族；
  * 本样只声明 trigger args mapper 消费的类型形状。 */
final case class TransferStockCommand(transferId: Id, sourceWarehouseId: Id,
                                      targetWarehouseId: Id, sku: String,
                                      quantity: Int, transferMode: String) {
  require(transferId != null, "transfer id required")
  require(quantity > 0, "positive transfer quantity required")
}
