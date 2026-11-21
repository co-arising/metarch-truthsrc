package example.stockreservation.domain.entities

import example.stockreservation.domain.events.LotEvent
import example.stockreservation.domain.events.{WaferAdditionCommitted, WaferAdditionReserved,
  WaferAdditionRestored, WaferRemovalCommitted, WaferRemovalReserved, WaferRemovalRestored}

/** 手写业务供给（#42 composition-invocation-host）：wafer lot 的持久状态与纯
  * 事件应用。carried 的键是 wafer id、值是加入它的 txid（oracle 的 carriedOf
  * 断言键集合）；六张标记图按 txid 记录 TCC 相位账，供 fixture host 的
  * read-only-evidence-query 精确重读（#41 F10 同款证据语义）。 */
final case class LotState(
    lotId: String,
    carried: Map[String, String],
    removalReservations: Map[String, List[String]],
    additionReservations: Map[String, List[String]],
    committedRemovals: Map[String, Int],
    committedAdditions: Map[String, Int],
    restoredRemovals: Map[String, Int],
    restoredAdditions: Map[String, Int]) {
  require(lotId != null && lotId.nonEmpty, "lot id required")
}

object LotEntity {

  def empty(lotId: String): LotState =
    LotState(lotId, Map.empty, Map.empty, Map.empty, Map.empty, Map.empty, Map.empty, Map.empty)

  def applyEvent(state: LotState, event: LotEvent): LotState =
    if (isRemovalEvent(event)) applyRemovalEvent(state, event)
    else applyAdditionEvent(state, event)

  private def isRemovalEvent(event: LotEvent): Boolean = event match {
    case _: WaferRemovalReserved | _: WaferRemovalCommitted | _: WaferRemovalRestored => true
    case _ => false
  }

  private def applyRemovalEvent(state: LotState, event: LotEvent): LotState = event match {
    case WaferRemovalReserved(txid, wafers) =>
      state.copy(removalReservations = state.removalReservations + (txid -> wafers))
    case WaferRemovalCommitted(txid, wafers) => state.copy(
      carried = wafers.foldLeft(state.carried)((next, wafer) => next - wafer),
      removalReservations = state.removalReservations - txid,
      committedRemovals = state.committedRemovals + (txid -> wafers.size))
    case WaferRemovalRestored(txid, wafers) => state.copy(
      removalReservations = state.removalReservations - txid,
      restoredRemovals = state.restoredRemovals + (txid -> wafers.size))
    case _ => state
  }

  private def applyAdditionEvent(state: LotState, event: LotEvent): LotState = event match {
    case WaferAdditionReserved(txid, wafers) =>
      state.copy(additionReservations = state.additionReservations + (txid -> wafers))
    case WaferAdditionCommitted(txid, wafers) => state.copy(
      carried = wafers.foldLeft(state.carried)((next, wafer) => next + (wafer -> txid)),
      additionReservations = state.additionReservations - txid,
      committedAdditions = state.committedAdditions + (txid -> wafers.size))
    case WaferAdditionRestored(txid, wafers) => state.copy(
      additionReservations = state.additionReservations - txid,
      restoredAdditions = state.restoredAdditions + (txid -> wafers.size))
    case _ => state
  }
}
