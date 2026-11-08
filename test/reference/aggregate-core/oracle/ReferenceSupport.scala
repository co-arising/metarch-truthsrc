package example.inventory.aggregatecore.reference

import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseState
import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._

object ReferenceSupport {
  // Explicit test-only identity adapters. They do not supply production
  // serializers, protobuf conversion, durable storage or evolution guarantees.
  val identityEvents: EventAdapter[WarehouseProtocol.Event, WarehouseProtocol.Event] =
    new EventAdapter[WarehouseProtocol.Event, WarehouseProtocol.Event] {
      def manifest(event: WarehouseProtocol.Event): String = "aggregate-core-test-identity-v1"
      def toJournal(event: WarehouseProtocol.Event): WarehouseProtocol.Event = event
      def fromJournal(event: WarehouseProtocol.Event, manifest: String): EventSeq[WarehouseProtocol.Event] =
        EventSeq.single(event)
    }

  val identitySnapshots: SnapshotAdapter[WarehouseState] = new SnapshotAdapter[WarehouseState] {
    def toJournal(state: WarehouseState): Any = state
    def fromJournal(value: Any): WarehouseState = value.asInstanceOf[WarehouseState]
  }

  val forbiddenHost: WarehouseComputations = new WarehouseComputations {
    def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId =
      throw new AssertionError("unexpected reservation host call")
  }
}
