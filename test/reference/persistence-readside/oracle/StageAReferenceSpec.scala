package example.inventory.persistencereadside.reference

import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.entities.behaviors.WarehouseEventHandler
import example.inventory.domain.invariant.WarehouseRules
import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._
import example.inventory.infrastructure.serialization.DomainConverters
import example.inventory.infrastructure.readside.WarehouseEnvelope
import example.inventory.persistence.protobuf.Frame
import example.inventory.{protobuf => pb}
import org.scalatest.funsuite.AnyFunSuite
import scala.jdk.CollectionConverters._

/** Independent expected business facts; no generator model, output, or expected-data import. */
final class StageAReferenceSpec extends AnyFunSuite {
  test("envelope captures caller bytes before async work and never exposes the retained array") {
    val input = Array[Byte](1, 2, -1)
    val value = WarehouseEnvelope.capture("pid/opaque", " resource opaque ", 1L, "unvalidated-frame-manifest", input)
    input(0) = 99
    val first = value.bytes
    assert(first.toVector == Vector[Byte](1, 2, -1))
    first(1) = 88
    assert(value.bytes.toVector == Vector[Byte](1, 2, -1))
    assert(value.resource == " resource opaque ")
    assert(value.pid == "pid/opaque")
  }
  test("envelope rejects malformed strings invalid sequence and payload bounds synchronously") {
    def make(pid: String = "pid", resource: String = "resource", seq: Long = 1L,
      bytes: Array[Byte] = Array[Byte](1)): WarehouseEnvelope =
      WarehouseEnvelope.capture(pid, resource, seq, "manifest", bytes)
    assertThrows[IllegalArgumentException](make(pid = ""))
    assertThrows[IllegalArgumentException](make(pid = null))
    assertThrows[IllegalArgumentException](make(pid = "x\n"))
    assertThrows[IllegalArgumentException](make(resource = "\uD800"))
    assertThrows[IllegalArgumentException](make(resource = "界" * 86))
    assertThrows[IllegalArgumentException](make(seq = 0L))
    assertThrows[IllegalArgumentException](make(seq = -1L))
    assertThrows[IllegalArgumentException](make(bytes = null))
    assertThrows[IllegalArgumentException](make(bytes = Array.emptyByteArray))
    assertThrows[IllegalArgumentException](make(bytes = new Array[Byte](1048577)))
    assert(make(pid = "界" * 85, bytes = new Array[Byte](1048576)).bytes.length == 1048576)
  }
  test("original reserve fold is identity and commit writes only the existing receipt rule") {
    val tx = TxId("tx-A")
    val state = WarehouseState(Map(TxId("unrelated") -> "unchanged"))
    var calls = 0
    val hosts = new WarehouseComputations {
      def reservationIdentity(t: TxId, w: WarehouseId, s: SkuId, q: Long): ReservationId = {
        assert((t, w, s, q) == ((tx, WarehouseId("W"), SkuId("S"), 7L)))
        calls += 1
        ReservationId("caller-port-answer")
      }
    }
    val reserved = WarehouseRules.decide(state, ReserveSkuQuantity(tx, WarehouseId("W"), SkuId("S"), 7L), hosts)
    assert(reserved == Right(Vector(SkuQuantityReserved(ReservationId("caller-port-answer")))))
    assert(calls == 1)
    assert(reserved.toOption.get.foldLeft(state)(WarehouseEventHandler.apply) == state)
    val committed = WarehouseRules.decide(state, CommitSkuReservation(tx, WarehouseId("W"), SkuId("S"), ReservationId("caller-port-answer")), hosts)
    assert(committed == Right(Vector(SkuReservationCommitted(tx))))
    val after = committed.toOption.get.foldLeft(state)(WarehouseEventHandler.apply)
    assert(after.receipts == Map(TxId("unrelated") -> "unchanged", tx -> "SkuReservationCommitted"))
    assert(calls == 1)
    assert(WarehouseRules.decide(after, ReserveSkuQuantity(tx, WarehouseId("W"), SkuId("S"), 7L), hosts) == Right(Vector.empty))
    assert(WarehouseRules.decide(after, CommitSkuReservation(tx, WarehouseId("W"), SkuId("S"), ReservationId("caller-port-answer")), hosts) == Right(Vector.empty))
    assert(calls == 1)
  }
  test("original domain protobuf bytes preserve both events and a genuinely nonempty state") {
    val reserve = SkuQuantityReserved(ReservationId("R-界"))
    val commit = SkuReservationCommitted(TxId("tx-界"))
    val state = WarehouseState(Map(TxId("tx-界") -> "SkuReservationCommitted", TxId("keep") -> "other"))
    val rb = DomainConverters.encodeWarehouseSkuQuantityReserved(reserve).toByteArray
    val cb = DomainConverters.encodeWarehouseSkuReservationCommitted(commit).toByteArray
    val sb = DomainConverters.encodeWarehouseState(state).toByteArray
    assert(rb.nonEmpty && cb.nonEmpty && sb.nonEmpty)
    assert(DomainConverters.decodeWarehouseSkuQuantityReserved(pb.WarehouseSkuQuantityReserved.parseFrom(rb)) == reserve)
    assert(DomainConverters.decodeWarehouseSkuReservationCommitted(pb.WarehouseSkuReservationCommitted.parseFrom(cb)) == commit)
    assert(DomainConverters.decodeWarehouseState(pb.WarehouseSnapshot.parseFrom(sb)) == state)
  }
  test("independent technical proto has the six fixed fields without certifying a wire registry") {
    val fields = Frame.javaDescriptor.getFields.asScala.toVector
    assert(fields.map(f => (f.getName, f.getNumber, f.getType.toString)) == Vector(
      ("envelope_version", 1, "UINT32"), ("role", 2, "STRING"), ("type_id", 3, "STRING"),
      ("wire_version", 4, "UINT32"), ("layout_sha256", 5, "STRING"), ("payload", 6, "BYTES")))
    // Parsing the proto is not registry/version admission; no placeholder SHA is accepted here.
    assert(Frame.defaultInstance.layoutSha256.isEmpty)
  }
}
