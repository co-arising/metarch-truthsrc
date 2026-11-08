package example.inventory.infrastructure.serialization

import example.inventory.domain.WarehouseProtocol.SkuQuantityReserved
import example.inventory.domain.WarehouseProtocol.SkuReservationCommitted
import example.inventory.domain.WarehouseState
import example.inventory.domain.values._
import example.inventory.{protobuf => pb}

object DomainConverters {
  private def required[A](value: Option[A], path: String): A =
    value.getOrElse(throw new IllegalArgumentException("missing required message: " + path))

  private def compareBytes(left: Array[Byte], right: Array[Byte]): Int = {
    var index = 0
    while (index < left.length && index < right.length) {
      val difference = (left(index) & 0xff) - (right(index) & 0xff)
      if (difference != 0) return difference
      index += 1
    }
    java.lang.Integer.compare(left.length, right.length)
  }

  def encodeTxId(value: TxId): pb.TxIdValue =
    pb.TxIdValue(f0 = value.value)

  def decodeTxId(value: pb.TxIdValue): TxId =
    TxId(value.f0)

  def encodeWarehouseId(value: WarehouseId): pb.WarehouseIdValue =
    pb.WarehouseIdValue(f0 = value.value)

  def decodeWarehouseId(value: pb.WarehouseIdValue): WarehouseId =
    WarehouseId(value.f0)

  def encodeSkuId(value: SkuId): pb.SkuIdValue =
    pb.SkuIdValue(f0 = value.value)

  def decodeSkuId(value: pb.SkuIdValue): SkuId =
    SkuId(value.f0)

  def encodeReservationId(value: ReservationId): pb.ReservationIdValue =
    pb.ReservationIdValue(f0 = value.value)

  def decodeReservationId(value: pb.ReservationIdValue): ReservationId =
    ReservationId(value.f0)

  private def encodeWarehouseSnapshotField0Entry(key: TxId, value: String): pb.WarehouseSnapshotField0Entry =
    pb.WarehouseSnapshotField0Entry(f0 = Some(encodeTxId(key)), f1 = value)

  private def decodeWarehouseSnapshotField0Entry(value: pb.WarehouseSnapshotField0Entry): (TxId, String) =
    decodeTxId(required(value.f0, "WarehouseSnapshotField0Entry.f0")) -> value.f1

  private def encodeWarehouseSnapshotField0(value: Map[TxId, String]): pb.WarehouseSnapshotField0 = {
    val entries = value.toVector.map {
      case (key, item) =>
        val encoded = encodeWarehouseSnapshotField0Entry(key, item)
        val keyBytes = encoded.copy(f1 = "").toByteArray
        keyBytes -> encoded
    }
    val sorted = entries.sortWith { case ((left, _), (right, _)) => compareBytes(left, right) < 0 }
    require(sorted.sliding(2).forall(pair => pair.size < 2 || compareBytes(pair(0)._1, pair(1)._1) != 0), "ambiguous encoded map key: WarehouseSnapshotField0")
    pb.WarehouseSnapshotField0(present = true, f0 = sorted.map(_._2))
  }

  private def decodeWarehouseSnapshotField0(value: pb.WarehouseSnapshotField0): Map[TxId, String] = {
    require(value.present, "required map is absent: WarehouseSnapshotField0")
    val entries = value.f0.map(decodeWarehouseSnapshotField0Entry)
    require(entries.map(_._1).distinct.size == entries.size, "duplicate map key: WarehouseSnapshotField0")
    entries.toMap
  }

  def encodeWarehouseState(value: WarehouseState): pb.WarehouseSnapshot =
    pb.WarehouseSnapshot(
      f0 = Some(encodeWarehouseSnapshotField0(value.receipts))
    )

  def decodeWarehouseState(value: pb.WarehouseSnapshot): WarehouseState =
    WarehouseState(
      receipts = decodeWarehouseSnapshotField0(required(value.f0, "WarehouseSnapshot.f0"))
    )

  def encodeWarehouseSkuQuantityReserved(value: SkuQuantityReserved): pb.WarehouseSkuQuantityReserved =
    pb.WarehouseSkuQuantityReserved(
      f0 = Some(encodeReservationId(value.reservationId))
    )

  def decodeWarehouseSkuQuantityReserved(value: pb.WarehouseSkuQuantityReserved): SkuQuantityReserved =
    SkuQuantityReserved(
      reservationId = decodeReservationId(required(value.f0, "WarehouseSkuQuantityReserved.f0"))
    )

  def encodeWarehouseSkuReservationCommitted(value: SkuReservationCommitted): pb.WarehouseSkuReservationCommitted =
    pb.WarehouseSkuReservationCommitted(
      f0 = Some(encodeTxId(value.txid))
    )

  def decodeWarehouseSkuReservationCommitted(value: pb.WarehouseSkuReservationCommitted): SkuReservationCommitted =
    SkuReservationCommitted(
      txid = decodeTxId(required(value.f0, "WarehouseSkuReservationCommitted.f0"))
    )
}
