package example.stockreservation.domain.events

import net.imadz.common.CommonTypes.Id

/** 手写业务供给（#40 strict-saga-module，domain 层零机制）：
  * StockReceivedEvent＝warehouse-stock-received（event trigger）的 sourceType；
  * StockTransferCompletedEvent＝succeeded completion 的映射目标事件类型
  * （completion 只做显式 map，发布/幂等是宿主义务，本样不发事件）。 */
final case class StockReceivedEvent(warehouseId: Id, sku: String, receivedQuantity: Int) {
  require(warehouseId != null, "warehouse id required")
  require(receivedQuantity > 0, "positive received quantity required")
}

final case class StockTransferCompletedEvent(transactionId: String, sourceWarehouseId: Id) {
  require(transactionId != null && transactionId.nonEmpty, "transaction id required")
  require(sourceWarehouseId != null, "source warehouse id required")
}
