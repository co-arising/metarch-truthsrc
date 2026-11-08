package example.inventory.aggregatecore.reference.positive

import akka.actor.typed.{ActorRef, Behavior}
import akka.persistence.typed.{EventAdapter, EventSeq, PersistenceId, SnapshotAdapter}
import example.inventory.application.aggregates.WarehouseActorProtocol
import example.inventory.application.factories.WarehouseAggregateFactory
import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.values._
import example.inventory.infrastructure.bootstrap.WarehouseBootstrap

object ValidAdapters {
  val events: EventAdapter[WarehouseProtocol.Event, String] = new EventAdapter[WarehouseProtocol.Event, String] {
    def manifest(event: WarehouseProtocol.Event): String = "test-text-v1"
    def toJournal(event: WarehouseProtocol.Event): String = event match {
      case SkuQuantityReserved(id) => "R:" + id.value
      case SkuReservationCommitted(id) => "C:" + id.value
    }
    def fromJournal(value: String, manifest: String): EventSeq[WarehouseProtocol.Event] = {
      require(manifest == "test-text-v1")
      if (value.startsWith("R:")) EventSeq.single(SkuQuantityReserved(ReservationId(value.substring(2))))
      else if (value.startsWith("C:")) EventSeq.single(SkuReservationCommitted(TxId(value.substring(2))))
      else throw new IllegalArgumentException("unknown test journal event")
    }
  }
  val snapshots: SnapshotAdapter[WarehouseState] = new SnapshotAdapter[WarehouseState] {
    def toJournal(state: WarehouseState): Any = state.receipts
    def fromJournal(value: Any): WarehouseState = WarehouseState(value.asInstanceOf[Map[TxId, String]])
  }

  // J is String, not Event: demonstrates the factory's genuine generic adapter
  // seam rather than depending on test identity adapters or implicit defaults.
  def create(factory: WarehouseAggregateFactory, pid: PersistenceId): Behavior[WarehouseActorProtocol.Command] =
    factory.create[String](pid, WarehouseState(), ValidHost, events, snapshots)

  def bootstrap(pid: PersistenceId): Behavior[WarehouseActorProtocol.Command] =
    WarehouseBootstrap.create[String](pid, WarehouseState(), ValidHost, events, snapshots)

  def execute(command: WarehouseProtocol.Command, replyTo: ActorRef[WarehouseActorProtocol.Reply]): WarehouseActorProtocol.Command =
    WarehouseActorProtocol.Execute(command, replyTo)
}
