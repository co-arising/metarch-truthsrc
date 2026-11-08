package example.inventory.aggregatecore.reference

import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.values._
import example.inventory.infrastructure.serialization.DomainConverters
import example.inventory.{protobuf => pb}
import org.scalatest.funsuite.AnyFunSuite

final class PbRoundtripSpec extends AnyFunSuite {
  test("all four scalar VOs traverse actual protobuf bytes with exact text, including empty and unicode") {
    for (text <- Vector("", "tx-left", "仓库/sku/予約" + 0.toChar)) {
      val tx = pb.TxIdValue.parseFrom(DomainConverters.encodeTxId(TxId(text)).toByteArray)
      assert(tx.f0 == text && DomainConverters.decodeTxId(tx) == TxId(text))
      val warehouse = pb.WarehouseIdValue.parseFrom(DomainConverters.encodeWarehouseId(WarehouseId(text)).toByteArray)
      assert(warehouse.f0 == text && DomainConverters.decodeWarehouseId(warehouse) == WarehouseId(text))
      val sku = pb.SkuIdValue.parseFrom(DomainConverters.encodeSkuId(SkuId(text)).toByteArray)
      assert(sku.f0 == text && DomainConverters.decodeSkuId(sku) == SkuId(text))
      val reservation = pb.ReservationIdValue.parseFrom(DomainConverters.encodeReservationId(ReservationId(text)).toByteArray)
      assert(reservation.f0 == text && DomainConverters.decodeReservationId(reservation) == ReservationId(text))
    }
  }

  test("state default encodes a present empty map, not a silently missing snapshot field") {
    assert(WarehouseState.empty == WarehouseState())
    val parsed = pb.WarehouseSnapshot.parseFrom(DomainConverters.encodeWarehouseState(WarehouseState()).toByteArray)
    assert(parsed == pb.WarehouseSnapshot(f0 = Some(pb.WarehouseSnapshotField0(present = true))))
    assert(DomainConverters.decodeWarehouseState(parsed) == WarehouseState())
  }

  test("nonempty receipt state roundtrips real bytes with nominal keys, literal values and deterministic ordering") {
    val state = WarehouseState(Map(TxId("z-last") -> "right-value", TxId("a-first") -> "SkuReservationCommitted"))
    val bytes = DomainConverters.encodeWarehouseState(state).toByteArray
    val parsed = pb.WarehouseSnapshot.parseFrom(bytes)
    val expected = pb.WarehouseSnapshot(f0 = Some(pb.WarehouseSnapshotField0(
      present = true,
      f0 = Vector(
        pb.WarehouseSnapshotField0Entry(f0 = Some(pb.TxIdValue(f0 = "z-last")), f1 = "right-value"),
        pb.WarehouseSnapshotField0Entry(f0 = Some(pb.TxIdValue(f0 = "a-first")), f1 = "SkuReservationCommitted")
      )
    )))
    assert(parsed == expected)
    assert(DomainConverters.decodeWarehouseState(parsed) == state)
    val reverseInsertion = WarehouseState(Vector(TxId("z-last") -> "right-value",
      TxId("a-first") -> "SkuReservationCommitted").reverse.toMap)
    assert(DomainConverters.encodeWarehouseState(reverseInsertion).toByteArray.toVector == bytes.toVector)
  }

  test("nominal map keys order by value-free protobuf bytes, not text or receipt values") {
    val state = WarehouseState(Map(TxId("aa") -> "m", TxId("b") -> "a", TxId("a") -> "z"))
    val bytes = DomainConverters.encodeWarehouseState(state).toByteArray
    val parsed = pb.WarehouseSnapshot.parseFrom(bytes)
    val entries = parsed.f0.get.f0
    // PB length prefixes put the one-byte keys before "aa": text order would be a, aa, b.
    assert(entries.map(_.f0.get.f0).toVector == Vector("a", "b", "aa"))
    val expectedKeyBytes = Vector(
      Vector(0x0a, 0x03, 0x0a, 0x01, 0x61),
      Vector(0x0a, 0x03, 0x0a, 0x01, 0x62),
      Vector(0x0a, 0x04, 0x0a, 0x02, 0x61, 0x61)
    )
    assert(entries.map(_.copy(f1 = "").toByteArray.map(_ & 0xff).toVector).toVector == expectedKeyBytes)
    val expectedBytes = Vector(
      0x0a, 0x21, 0x08, 0x01,
      0x12, 0x08, 0x0a, 0x03, 0x0a, 0x01, 0x61, 0x12, 0x01, 0x7a,
      0x12, 0x08, 0x0a, 0x03, 0x0a, 0x01, 0x62, 0x12, 0x01, 0x61,
      0x12, 0x09, 0x0a, 0x04, 0x0a, 0x02, 0x61, 0x61, 0x12, 0x01, 0x6d
    )
    assert(bytes.map(_ & 0xff).toVector == expectedBytes)
    assert(DomainConverters.decodeWarehouseState(parsed) == state)
    // Changing only receipts must leave the actual key-only PB bytes and their order unchanged.
    val otherReceipts = WarehouseState(Map(TxId("a") -> "x", TxId("aa") -> "longer-receipt", TxId("b") -> ""))
    val otherParsed = pb.WarehouseSnapshot.parseFrom(DomainConverters.encodeWarehouseState(otherReceipts).toByteArray)
    assert(otherParsed.f0.get.f0.map(_.copy(f1 = "").toByteArray.map(_ & 0xff).toVector).toVector == expectedKeyBytes)
    assert(DomainConverters.decodeWarehouseState(otherParsed) == otherReceipts)
  }

  test("both declared events use distinct required nominal payloads through actual protobuf bytes") {
    val reserved = SkuQuantityReserved(ReservationId("reservation-only"))
    val reservedPb = pb.WarehouseSkuQuantityReserved.parseFrom(
      DomainConverters.encodeWarehouseSkuQuantityReserved(reserved).toByteArray)
    assert(reservedPb == pb.WarehouseSkuQuantityReserved(f0 = Some(pb.ReservationIdValue(f0 = "reservation-only"))))
    assert(DomainConverters.decodeWarehouseSkuQuantityReserved(reservedPb) == reserved)
    val committed = SkuReservationCommitted(TxId("transaction-only"))
    val committedPb = pb.WarehouseSkuReservationCommitted.parseFrom(
      DomainConverters.encodeWarehouseSkuReservationCommitted(committed).toByteArray)
    assert(committedPb == pb.WarehouseSkuReservationCommitted(f0 = Some(pb.TxIdValue(f0 = "transaction-only"))))
    assert(DomainConverters.decodeWarehouseSkuReservationCommitted(committedPb) == committed)
  }

  test("missing snapshot/map/key, absent map and duplicate keys are rejected after wire parsing") {
    val invalid = Vector(
      pb.WarehouseSnapshot(),
      pb.WarehouseSnapshot(f0 = Some(pb.WarehouseSnapshotField0(present = false))),
      pb.WarehouseSnapshot(f0 = Some(pb.WarehouseSnapshotField0(present = true,
        f0 = Vector(pb.WarehouseSnapshotField0Entry(f1 = "missing-key"))))),
      pb.WarehouseSnapshot(f0 = Some(pb.WarehouseSnapshotField0(present = true,
        f0 = Vector(
          pb.WarehouseSnapshotField0Entry(f0 = Some(pb.TxIdValue(f0 = "duplicate")), f1 = "left"),
          pb.WarehouseSnapshotField0Entry(f0 = Some(pb.TxIdValue(f0 = "duplicate")), f1 = "right")
        ))))
    )
    for (snapshot <- invalid) {
      intercept[IllegalArgumentException] {
        DomainConverters.decodeWarehouseState(pb.WarehouseSnapshot.parseFrom(snapshot.toByteArray))
      }
    }
    intercept[IllegalArgumentException] {
      DomainConverters.decodeWarehouseSkuQuantityReserved(
        pb.WarehouseSkuQuantityReserved.parseFrom(pb.WarehouseSkuQuantityReserved().toByteArray))
    }
    intercept[IllegalArgumentException] {
      DomainConverters.decodeWarehouseSkuReservationCommitted(
        pb.WarehouseSkuReservationCommitted.parseFrom(pb.WarehouseSkuReservationCommitted().toByteArray))
    }
  }
}
