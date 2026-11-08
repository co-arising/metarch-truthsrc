package example.inventory.aggregatecore.reference

import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.command.WarehouseCommandHelpers
import example.inventory.domain.entities.behaviors.WarehouseEventHandler
import example.inventory.domain.invariant.WarehouseRules
import example.inventory.domain.invariant.params.WarehouseRuleParams._
import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._
import org.scalatest.funsuite.AnyFunSuite

final class PureDecisionSpec extends AnyFunSuite {
  private val tx = TxId("tx-left")
  private val warehouse = WarehouseId("warehouse-middle")
  private val sku = SkuId("sku-right")
  private val reservation = ReservationId("host-output")
  private val reserve = ReserveSkuQuantity(tx, warehouse, sku, 17L)
  private val commit = CommitSkuReservation(tx, warehouse, sku, reservation)

  private val forbiddenHost = new WarehouseComputations {
    def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId =
      throw new AssertionError("host must not be evaluated on this path")
  }

  test("quantity rejection precedes both receipt access and any host call") {
    val unreadableLaterState = WarehouseState(receipts = null)
    for (quantity <- Vector(Long.MinValue, -1L, 0L)) {
      assert(WarehouseRules.decide(unreadableLaterState, reserve.copy(quantity = quantity), forbiddenHost) ==
        Left("quantity-positive"))
    }
    val receipted = WarehouseState(Map(tx -> "already-committed"))
    assert(WarehouseRules.decide(receipted, reserve.copy(quantity = 0L), forbiddenHost) == Left("quantity-positive"))
  }

  test("receipt guard is a new sample design and stops reserve and commit with empty success") {
    val state = WarehouseState(Map(tx -> "any-existing-receipt", TxId("other") -> "unrelated"))
    assert(WarehouseRules.decide(state, reserve, forbiddenHost) == Right(Vector.empty))
    assert(WarehouseRules.decide(state, commit, forbiddenHost) == Right(Vector.empty))
    assert(WarehouseRules.reserveSkuQuantity(ReserveSkuQuantityParams(state, reserve, null)) == Right(Vector.empty))
    assert(WarehouseRules.commitSkuReservation(CommitSkuReservationParams(state, commit, null)) == Right(Vector.empty))
    assert(state.receipts(tx) == "any-existing-receipt")
  }

  test("successful reserve invokes exactly one host with the declared four input arguments in order") {
    var calls = Vector.empty[(TxId, WarehouseId, SkuId, Long)]
    val hosts = new WarehouseComputations {
      def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId = {
        calls :+= ((txid, warehouseId, skuId, quantity))
        reservation
      }
    }
    val state = WarehouseState(Map(TxId("untouched") -> "keep"))
    assert(WarehouseRules.decide(state, reserve, hosts) == Right(Vector(SkuQuantityReserved(reservation))))
    assert(calls == Vector((tx, warehouse, sku, 17L)))
    assert(state == WarehouseState(Map(TxId("untouched") -> "keep")))
    assert(WarehouseRules.reserveSkuQuantity(ReserveSkuQuantityParams(state, reserve.copy(quantity = Long.MaxValue), hosts)) ==
      Right(Vector(SkuQuantityReserved(reservation))))
    assert(calls == Vector((tx, warehouse, sku, 17L), (tx, warehouse, sku, Long.MaxValue)))
  }

  test("host exceptions propagate rather than being converted to business rejection or empty success") {
    val unavailable = new IllegalStateException("identity unavailable")
    val hosts = new WarehouseComputations {
      def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId =
        throw unavailable
    }
    val caught = intercept[IllegalStateException] {
      WarehouseRules.decide(WarehouseState(), reserve, hosts)
    }
    assert(caught eq unavailable)
  }

  test("helpers bind declared event slots only; commit neither reads irrelevant fields nor calls hosts") {
    assert(WarehouseCommandHelpers.emitCommitSkuReservation(null, commit.copy(warehouseId = null, skuId = null,
      reservationId = null), forbiddenHost) == Vector(SkuReservationCommitted(tx)))
    assert(WarehouseRules.decide(WarehouseState(), commit, forbiddenHost) == Right(Vector(SkuReservationCommitted(tx))))
    var quantitySeen = 1L
    val hosts = new WarehouseComputations {
      def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId = {
        quantitySeen = quantity
        reservation
      }
    }
    // Helpers do not repeat guards; the rules layer owns admission.
    assert(WarehouseCommandHelpers.emitReserveSkuQuantity(null, reserve.copy(quantity = 0L), hosts) ==
      Vector(SkuQuantityReserved(reservation)))
    assert(quantitySeen == 0L)
  }

  test("reserve event has no fold, commit fold uses the event txid and preserves unrelated receipts") {
    val state = WarehouseState(Map(TxId("other") -> "unchanged", tx -> "pre-event"))
    assert(WarehouseEventHandler(state, SkuQuantityReserved(reservation)) eq state)
    val next = WarehouseEventHandler(state, SkuReservationCommitted(tx))
    assert(next == WarehouseState(Map(TxId("other") -> "unchanged", tx -> "SkuReservationCommitted")))
    assert(state == WarehouseState(Map(TxId("other") -> "unchanged", tx -> "pre-event")))
    val orderedEvents = Vector(SkuQuantityReserved(reservation), SkuReservationCommitted(tx),
      SkuReservationCommitted(TxId("second")))
    val finalState = orderedEvents.foldLeft(state)(WarehouseEventHandler.apply)
    assert(finalState == WarehouseState(Map(TxId("other") -> "unchanged", tx -> "SkuReservationCommitted",
      TxId("second") -> "SkuReservationCommitted")))
  }
}
