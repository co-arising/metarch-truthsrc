package example.inventory.reference

import example.inventory.domain.{WarehouseComputations, WarehouseProtocol => Payload, WarehouseRules, WarehouseState}
import example.inventory.domain.entities.WarehouseEntity
import example.inventory.domain.entities.behaviors.WarehouseEventHandler
import example.inventory.domain.values._
import org.scalatest.funsuite.AnyFunSuite

final class WarehouseDecisionSpec extends AnyFunSuite {
  private val txid = TxId("tx-1")
  private val warehouse = WarehouseId("warehouse-1")
  private val sku = SkuId("sku-1")
  private val reservation = ReservationId("reservation-1")

  test("reject non-positive quantities before invoking the open computation port") {
    val forbidden = new WarehouseComputations {
      def ReservationIdentity(state: WarehouseState, command: Payload.ReserveSkuQuantity): ReservationId =
        throw new AssertionError("rejected command invoked a computation")
    }
    for (quantity <- Vector(0L, -1L)) {
      val command = Payload.ReserveSkuQuantity(txid, warehouse, sku, quantity)
      assert(WarehouseRules.ReserveSkuQuantity(WarehouseState.empty, command, forbidden) == Left("quantity-positive"))
    }
  }

  test("an accepted decision emits the explicit computed reservation without changing state") {
    var calls = 0
    val initial = WarehouseState.empty
    val command = Payload.ReserveSkuQuantity(txid, warehouse, sku, 3L)
    val hosts = new WarehouseComputations {
      def ReservationIdentity(state: WarehouseState, input: Payload.ReserveSkuQuantity): ReservationId = {
        assert(state == initial && input == command)
        calls += 1
        reservation
      }
    }
    assert(WarehouseRules.ReserveSkuQuantity(initial, command, hosts) == Right(Vector(Payload.SkuQuantityReserved(reservation))))
    assert(calls == 1)
    assert(initial.receipts.isEmpty)
  }

  test("event application owns receipt changes and preserves unrelated entries") {
    val other = TxId("other")
    val initial = WarehouseState(Map(other -> "retained"))
    val committed = WarehouseEventHandler(initial, Payload.SkuReservationCommitted(txid))
    assert(committed.receipts == Map(other -> "retained", txid -> "SkuReservationCommitted"))
    assert(initial.receipts == Map(other -> "retained"))
    val released = WarehouseEventHandler(committed, Payload.SkuReservationReleased(txid))
    assert(released.receipts == Map(other -> "retained", txid -> "SkuReservationReleased"))
    assert(WarehouseEventHandler(released, Payload.SkuQuantityReserved(reservation)) == released)
  }

  test("compatible Entity aliases retain the original JVM state and event carriers") {
    val state: WarehouseEntity.State = WarehouseState.empty
    val event: WarehouseEntity.Event = Payload.SkuReservationCommitted(txid)
    assert(state.getClass == classOf[WarehouseState])
    assert(event.getClass == classOf[Payload.SkuReservationCommitted])
    assert(WarehouseEntity.State eq WarehouseState)
    assert(WarehouseEntity.Events.SkuReservationCommitted eq Payload.SkuReservationCommitted)
  }
}
