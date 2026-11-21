package example.stockreservation.domain.events

import net.imadz.common.CborSerializable

/** 手写业务供给（#42 composition-invocation-host，domain 层零机制）：wafer lot
  * 聚合的 TCC 相位事件族。六个事件覆盖两向 TCC（remove/add × reserve/commit）
  * 加 restore（补偿释放）；事件第一参数都是 txid，测试 oracle 以 productPrefix
  * + 首元素过滤逐 saga 效果（F9 裁定：逐 saga 恰四事件 = 两 participant 的
  * prepare/commit）。事件经 CborSerializable 标记走 jackson-cbor 真实序列化链
  * （saga-core reference.conf 绑定，persistence-testkit journal 同链）。 */
sealed trait LotEvent extends CborSerializable

final case class WaferRemovalReserved(txid: String, wafers: List[String]) extends LotEvent {
  require(txid != null && txid.nonEmpty, "transaction id required")
  require(wafers != null && wafers.nonEmpty, "wafers required")
}

final case class WaferRemovalCommitted(txid: String, wafers: List[String]) extends LotEvent {
  require(txid != null && txid.nonEmpty, "transaction id required")
  require(wafers != null && wafers.nonEmpty, "wafers required")
}

final case class WaferRemovalRestored(txid: String, wafers: List[String]) extends LotEvent {
  require(txid != null && txid.nonEmpty, "transaction id required")
  require(wafers != null && wafers.nonEmpty, "wafers required")
}

final case class WaferAdditionReserved(txid: String, wafers: List[String]) extends LotEvent {
  require(txid != null && txid.nonEmpty, "transaction id required")
  require(wafers != null && wafers.nonEmpty, "wafers required")
}

final case class WaferAdditionCommitted(txid: String, wafers: List[String]) extends LotEvent {
  require(txid != null && txid.nonEmpty, "transaction id required")
  require(wafers != null && wafers.nonEmpty, "wafers required")
}

final case class WaferAdditionRestored(txid: String, wafers: List[String]) extends LotEvent {
  require(txid != null && txid.nonEmpty, "transaction id required")
  require(wafers != null && wafers.nonEmpty, "wafers required")
}

/** saga 完成事件的映射目标（#40 StockTransferCompletedEvent 同位）：不进 journal，
  * 是模块 succeededCompletion mapper 的产物类型。 */
final case class LotTransferCompletedEvent(txid: String, from: String, to: String)
  extends CborSerializable {
  require(txid != null && txid.nonEmpty, "transaction id required")
  require(from != null && from.nonEmpty, "from lot required")
  require(to != null && to.nonEmpty, "to lot required")
}
