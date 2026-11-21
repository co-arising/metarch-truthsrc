package example.stockreservation.domain.events

import net.imadz.common.CborSerializable
import net.imadz.common.CommonTypes.Id

/** 手写业务供给（#41 strict-fixture-host，domain 层零机制）：warehouse 参与聚合的
  * 相位事件族。6 个相位事件逐字对齐模块 PhaseContract.confirmation.event
  * （stock-reserved / stock-committed / stock-released / stock-order-placed /
  * stock-settled / stock-cancelled）；StockRestocked 是 fixture 蓄库事件
  * （事件触发源的 journal 实账投影不在本样：installEventSource 仅编译面覆盖，
  * F12 裁定）；TransferCompletedRecorded 是发布命令的落库记录，承载与模块
  * succeededCompletion mapper 产出的 StockTransferCompletedEvent 相同的
  * (transactionId, sourceWarehouseId) 载荷——事件类型本身是模块级合同（#40 已测），
  * 上游冻结记录无共享标记 trait，故 journal 记录用本族自有事件（裁定 F11/F5 记档）。
  * 事件经 CborSerializable 标记走 jackson-cbor 真实序列化链（saga-core
  * reference.conf 绑定），journal 序列化由此非 Java serialization。 */
sealed trait WarehouseEvent extends CborSerializable

sealed trait WarehouseReservationEvent extends WarehouseEvent

final case class StockReserved(transactionId: String, reservationId: Id, sku: String,
                               quantity: Int) extends WarehouseReservationEvent {
  require(transactionId != null && transactionId.nonEmpty, "transaction id required")
  require(reservationId != null, "reservation id required")
  require(sku != null && sku.nonEmpty, "sku required")
  require(quantity > 0, "positive quantity required")
}

final case class StockCommitted(transactionId: String, reservationId: Id, sku: String,
                                quantity: Int) extends WarehouseReservationEvent {
  require(transactionId != null && transactionId.nonEmpty, "transaction id required")
  require(reservationId != null, "reservation id required")
  require(sku != null && sku.nonEmpty, "sku required")
  require(quantity > 0, "positive quantity required")
}

final case class StockReleased(transactionId: String, reservationId: Id, sku: String,
                               quantity: Int) extends WarehouseReservationEvent {
  require(transactionId != null && transactionId.nonEmpty, "transaction id required")
  require(reservationId != null, "reservation id required")
  require(sku != null && sku.nonEmpty, "sku required")
  require(quantity > 0, "positive quantity required")
}

sealed trait WarehouseOrderEvent extends WarehouseEvent

final case class StockOrderPlaced(transactionId: String, orderId: Id, sku: String,
                                  quantity: Int) extends WarehouseOrderEvent {
  require(transactionId != null && transactionId.nonEmpty, "transaction id required")
  require(orderId != null, "order id required")
  require(sku != null && sku.nonEmpty, "sku required")
  require(quantity > 0, "positive quantity required")
}

final case class StockOrderSettled(transactionId: String, orderId: Id, sku: String,
                                   quantity: Int) extends WarehouseOrderEvent {
  require(transactionId != null && transactionId.nonEmpty, "transaction id required")
  require(orderId != null, "order id required")
  require(sku != null && sku.nonEmpty, "sku required")
  require(quantity > 0, "positive quantity required")
}

final case class StockOrderCancelled(transactionId: String, orderId: Id, sku: String,
                                     quantity: Int) extends WarehouseOrderEvent {
  require(transactionId != null && transactionId.nonEmpty, "transaction id required")
  require(orderId != null, "order id required")
  require(sku != null && sku.nonEmpty, "sku required")
  require(quantity > 0, "positive quantity required")
}

final case class StockRestocked(sku: String, quantity: Int) extends WarehouseEvent {
  require(sku != null && sku.nonEmpty, "sku required")
  require(quantity > 0, "positive quantity required")
}

final case class TransferCompletedRecorded(transactionId: String,
                                           sourceWarehouseId: Id) extends WarehouseEvent {
  require(transactionId != null && transactionId.nonEmpty, "transaction id required")
  require(sourceWarehouseId != null, "source warehouse id required")
}
