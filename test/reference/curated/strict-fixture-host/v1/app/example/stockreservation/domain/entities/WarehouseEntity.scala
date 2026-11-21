package example.stockreservation.domain.entities

import example.stockreservation.domain.events._
import net.imadz.common.CommonTypes.Id

/** 手写业务供给（#41 strict-fixture-host）：warehouse 参与聚合的持久状态——
  * 每张相位标记图 keyed by txid（宿主精确重读证据面，F10 裁定）＋可用库存
  * （拒绝规则面：预订时锁定库存、提交结转、补偿/入库返还）。纯记录＋纯事件
  * 应用，零 akka/strict-runtime import（domain 层）。 */
final case class WarehouseReservationMark(reservationId: Id, sku: String, quantity: Int) {
  require(reservationId != null, "reservation id required")
  require(sku != null && sku.nonEmpty, "sku required")
  require(quantity > 0, "positive quantity required")
}

final case class WarehouseOrderMark(orderId: Id, sku: String, quantity: Int) {
  require(orderId != null, "order id required")
  require(sku != null && sku.nonEmpty, "sku required")
  require(quantity > 0, "positive quantity required")
}

final case class WarehouseState(
    warehouseId: Id,
    available: Map[String, Int],
    reserved: Map[String, WarehouseReservationMark],
    committed: Map[String, Int],
    released: Map[String, Int],
    orders: Map[String, WarehouseOrderMark],
    settled: Map[String, Int],
    cancelled: Map[String, Int],
    completedTransfers: Vector[String]) {
  require(warehouseId != null, "warehouse id required")
  require(available.values.forall(_ >= 0), "non-negative availability required")
}

object WarehouseEntity {

  def empty(warehouseId: Id): WarehouseState =
    WarehouseState(warehouseId, Map.empty, Map.empty, Map.empty, Map.empty, Map.empty,
      Map.empty, Map.empty, Vector.empty)

  /** Pure journal application: no ports, codecs, actor refs, registry or I/O. */
  def applyEvent(state: WarehouseState, event: WarehouseEvent): WarehouseState =
    event match {
      case reservation: WarehouseReservationEvent => applyReservation(state, reservation)
      case order: WarehouseOrderEvent => applyOrder(state, order)
      case StockRestocked(sku, quantity) =>
        state.copy(available = increase(state.available, sku, quantity))
      case TransferCompletedRecorded(transactionId, _) =>
        state.copy(completedTransfers = appendOnce(state.completedTransfers, transactionId))
    }

  private def applyReservation(state: WarehouseState,
                               event: WarehouseReservationEvent): WarehouseState =
    event match {
      case StockReserved(transactionId, reservationId, sku, quantity) =>
        state.copy(
          available = decrease(state.available, sku, quantity),
          reserved = state.reserved.updated(transactionId,
            WarehouseReservationMark(reservationId, sku, quantity)))
      case StockCommitted(transactionId, _, _, quantity) =>
        state.copy(committed = markCount(state.committed, transactionId, quantity))
      case StockReleased(transactionId, _, sku, quantity) =>
        state.copy(
          available = increase(state.available, sku, quantity),
          released = markCount(state.released, transactionId, quantity))
    }

  private def applyOrder(state: WarehouseState, event: WarehouseOrderEvent): WarehouseState =
    event match {
      case StockOrderPlaced(transactionId, orderId, sku, quantity) =>
        state.copy(orders = state.orders.updated(transactionId,
          WarehouseOrderMark(orderId, sku, quantity)))
      case StockOrderSettled(transactionId, _, sku, quantity) =>
        state.copy(
          available = increase(state.available, sku, quantity),
          settled = markCount(state.settled, transactionId, quantity))
      case StockOrderCancelled(transactionId, _, _, quantity) =>
        state.copy(cancelled = markCount(state.cancelled, transactionId, quantity))
    }

  private def increase(available: Map[String, Int], sku: String, quantity: Int): Map[String, Int] =
    available.updated(sku, available.getOrElse(sku, 0) + quantity)

  private def decrease(available: Map[String, Int], sku: String, quantity: Int): Map[String, Int] =
    available.updated(sku, available.getOrElse(sku, 0) - quantity)

  private def markCount(counts: Map[String, Int], key: String, value: Int): Map[String, Int] =
    counts.updated(key, value)

  private def appendOnce(entries: Vector[String], value: String): Vector[String] =
    if (entries.contains(value)) entries else entries :+ value
}
