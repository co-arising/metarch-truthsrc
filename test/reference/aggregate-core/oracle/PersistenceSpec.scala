package example.inventory.aggregatecore.reference

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.testkit.SnapshotMeta
import akka.persistence.testkit.scaladsl.{EventSourcedBehaviorTestKit, PersistenceTestKit, SnapshotTestKit}
import akka.persistence.typed.{EventAdapter, EventSeq, PersistenceId, SnapshotAdapter}
import com.typesafe.config.ConfigFactory
import example.inventory.application.aggregates.WarehouseActorProtocol
import example.inventory.application.aggregates.WarehouseActorProtocol._
import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._
import example.inventory.infrastructure.bootstrap.WarehouseBootstrap
import java.util.concurrent.atomic.AtomicInteger
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.duration._

final class PersistenceSpec extends AnyFunSuite {
  private val config = ConfigFactory.parseString("""
    akka.actor.provider = local
    akka.loglevel = WARNING
    akka.persistence.testkit.events.serialize = false
    akka.persistence.testkit.snapshots.serialize = false
  """).withFallback(EventSourcedBehaviorTestKit.config).withFallback(ConfigFactory.load())

  private def withKit(body: ActorTestKit => Unit): Unit = {
    val kit = ActorTestKit(config)
    try body(kit)
    finally kit.shutdownTestKit()
  }

  test("query, ordered quantity rejection and duplicate empty successes do not persist") {
    withKit { kit =>
      val tx = TxId("existing")
      val initial = WarehouseState(Map(tx -> "SkuReservationCommitted"))
      val behavior = WarehouseBootstrap.create(PersistenceId.ofUniqueId("aggregate-core-no-write"), initial,
        ReferenceSupport.forbiddenHost, ReferenceSupport.identityEvents, ReferenceSupport.identitySnapshots)
      val testkit = EventSourcedBehaviorTestKit[WarehouseActorProtocol.Command, WarehouseProtocol.Event, WarehouseState](
        kit.system, behavior, EventSourcedBehaviorTestKit.SerializationSettings.disabled)
      val query = testkit.runCommand[WarehouseState](reply => GetState(reply))
      assert(query.hasNoEvents && query.reply == initial)
      val rejected = testkit.runCommand[Reply](reply => Execute(
        ReserveSkuQuantity(tx, WarehouseId("w"), SkuId("s"), 0L), reply))
      assert(rejected.hasNoEvents && rejected.reply == Rejected("quantity-positive") && rejected.state == initial)
      for (command <- Vector[WarehouseProtocol.Command](
        ReserveSkuQuantity(tx, WarehouseId("w"), SkuId("s"), 1L),
        CommitSkuReservation(tx, WarehouseId("w"), SkuId("s"), ReservationId("r")))) {
        val empty = testkit.runCommand[Reply](reply => Execute(command, reply))
        assert(empty.hasNoEvents && empty.reply == Accepted(Vector.empty) && empty.state == initial)
      }
    }
  }

  test("reserve and commit retain journal order; same PID restart replays fold without invoking hosts") {
    withKit { kit =>
      val calls = new AtomicInteger(0)
      val hosts = new WarehouseComputations {
        def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId = {
          assert((txid, warehouseId, skuId, quantity) == (TxId("restart-tx"), WarehouseId("left-w"), SkuId("right-s"), 9L))
          calls.incrementAndGet()
          ReservationId("persisted-reservation")
        }
      }
      val pid = "aggregate-core-recovery"
      val initial = WarehouseState(Map(TxId("unrelated") -> "keep"))
      val behavior = WarehouseBootstrap.create(PersistenceId.ofUniqueId(pid), initial, hosts,
        ReferenceSupport.identityEvents, ReferenceSupport.identitySnapshots)
      val testkit = EventSourcedBehaviorTestKit[WarehouseActorProtocol.Command, WarehouseProtocol.Event, WarehouseState](
        kit.system, behavior, EventSourcedBehaviorTestKit.SerializationSettings.disabled)
      val tx = TxId("restart-tx")
      val reservedEvent = SkuQuantityReserved(ReservationId("persisted-reservation"))
      val reserved = testkit.runCommand[Reply](reply => Execute(
        ReserveSkuQuantity(tx, WarehouseId("left-w"), SkuId("right-s"), 9L), reply))
      assert(reserved.events == Seq(reservedEvent))
      assert(reserved.reply == Accepted(Vector(reservedEvent)) && reserved.state == initial)
      val committedEvent = SkuReservationCommitted(tx)
      val committed = testkit.runCommand[Reply](reply => Execute(
        CommitSkuReservation(tx, WarehouseId("left-w"), SkuId("right-s"), reservedEvent.reservationId), reply))
      val expected = WarehouseState(Map(TxId("unrelated") -> "keep", tx -> "SkuReservationCommitted"))
      assert(committed.events == Seq(committedEvent))
      assert(committed.reply == Accepted(Vector(committedEvent)) && committed.state == expected)
      assert(calls.get() == 1)
      val journal = PersistenceTestKit(kit.system)
      assert(journal.persistedInStorage(pid) == Seq(reservedEvent, committedEvent))
      testkit.restart()
      val recovered = testkit.runCommand[WarehouseState](reply => GetState(reply))
      assert(recovered.hasNoEvents && recovered.reply == expected)
      assert(calls.get() == 1, "recovery must not re-decide or re-run the host")
      val duplicate = testkit.runCommand[Reply](reply => Execute(
        ReserveSkuQuantity(tx, WarehouseId("left-w"), SkuId("right-s"), 9L), reply))
      assert(duplicate.hasNoEvents && duplicate.reply == Accepted(Vector.empty))
      assert(calls.get() == 1)
    }
  }

  test("factory refuses null/blank PID, state, host and both missing typed adapters") {
    val pid = PersistenceId.ofUniqueId("aggregate-core-input-contract")
    val state = WarehouseState()
    val hosts = ReferenceSupport.forbiddenHost
    val events = ReferenceSupport.identityEvents
    val snapshots = ReferenceSupport.identitySnapshots
    intercept[IllegalArgumentException](WarehouseBootstrap.create[WarehouseProtocol.Event](null, state, hosts, events, snapshots))
    intercept[IllegalArgumentException](WarehouseBootstrap.create(PersistenceId.ofUniqueId("   "), state, hosts, events, snapshots))
    intercept[IllegalArgumentException](WarehouseBootstrap.create(pid, null, hosts, events, snapshots))
    intercept[IllegalArgumentException](WarehouseBootstrap.create(pid, state, null, events, snapshots))
    intercept[IllegalArgumentException](WarehouseBootstrap.create[WarehouseProtocol.Event](pid, state, hosts, null, snapshots))
    intercept[IllegalArgumentException](WarehouseBootstrap.create(pid, state, hosts, events, null))
    assert(WarehouseBootstrap.create(pid, state, hosts, events, snapshots) != null)
  }

  test("generic String journal and adapted snapshot are actually injected and used during recovery") {
    withKit { kit =>
      val toJournalCalls = new AtomicInteger(0)
      val fromJournalCalls = new AtomicInteger(0)
      val fromSnapshotCalls = new AtomicInteger(0)
      val events = new EventAdapter[WarehouseProtocol.Event, String] {
        def manifest(event: WarehouseProtocol.Event): String = "adapted-test-v1"
        def toJournal(event: WarehouseProtocol.Event): String = {
          toJournalCalls.incrementAndGet()
          event match {
            case SkuReservationCommitted(tx) => "C:" + tx.value
            case SkuQuantityReserved(id) => "R:" + id.value
          }
        }
        def fromJournal(value: String, manifest: String): EventSeq[WarehouseProtocol.Event] = {
          assert(manifest == "adapted-test-v1")
          fromJournalCalls.incrementAndGet()
          if (value.startsWith("C:")) EventSeq.single(SkuReservationCommitted(TxId(value.substring(2))))
          else if (value.startsWith("R:")) EventSeq.single(SkuQuantityReserved(ReservationId(value.substring(2))))
          else throw new IllegalArgumentException("unknown adapted journal event")
        }
      }
      val snapshots = new SnapshotAdapter[WarehouseState] {
        def toJournal(state: WarehouseState): Any = state.receipts.map { case (key, value) => key.value -> value }
        def fromJournal(value: Any): WarehouseState = {
          fromSnapshotCalls.incrementAndGet()
          WarehouseState(value.asInstanceOf[Map[String, String]].map { case (key, receipt) => TxId(key) -> receipt })
        }
      }
      val pid = "aggregate-core-adapted-recovery"
      SnapshotTestKit(kit.system).persistForRecovery(pid, SnapshotMeta(0L) -> Map("seed" -> "snapshot-value"))
      val initial = WarehouseState(Map(TxId("not-snapshot") -> "initial-value"))
      def behavior = WarehouseBootstrap.create[String](PersistenceId.ofUniqueId(pid), initial,
        ReferenceSupport.forbiddenHost, events, snapshots)
      val ref = kit.spawn(behavior)
      val replies = kit.createTestProbe[Reply]()
      val tx = TxId("adapter-tx")
      ref ! Execute(CommitSkuReservation(tx, WarehouseId("w"), SkuId("s"), ReservationId("r")), replies.ref)
      replies.expectMessage(Accepted(Vector(SkuReservationCommitted(tx))))
      val expected = WarehouseState(Map(TxId("seed") -> "snapshot-value", tx -> "SkuReservationCommitted"))
      val state = kit.createTestProbe[WarehouseState]()
      ref ! GetState(state.ref)
      state.expectMessage(expected)
      assert(PersistenceTestKit(kit.system).persistedInStorage(pid) == Seq("C:adapter-tx"))
      assert(toJournalCalls.get() == 1 && fromJournalCalls.get() == 0 && fromSnapshotCalls.get() == 1)
      kit.stop(ref)
      val recovered = kit.spawn(behavior)
      recovered ! GetState(state.ref)
      state.expectMessage(expected)
      assert(toJournalCalls.get() == 1 && fromJournalCalls.get() == 1 && fromSnapshotCalls.get() == 2)
    }
  }

  test("throwing host stops the actor with no Accepted and no journal event") {
    withKit { kit =>
      val invoked = kit.createTestProbe[String]()
      val hosts = new WarehouseComputations {
        def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId = {
          invoked.ref ! "called"
          throw new IllegalStateException("identity unavailable")
        }
      }
      val pid = "aggregate-core-host-failure"
      val ref = kit.spawn(WarehouseBootstrap.create(PersistenceId.ofUniqueId(pid), WarehouseState(), hosts,
        ReferenceSupport.identityEvents, ReferenceSupport.identitySnapshots))
      val replies = kit.createTestProbe[Reply]()
      val termination = kit.createTestProbe[WarehouseActorProtocol.Command]()
      ref ! Execute(ReserveSkuQuantity(TxId("throw"), WarehouseId("w"), SkuId("s"), 1L), replies.ref)
      invoked.expectMessage("called")
      termination.expectTerminated(ref)
      PersistenceTestKit(kit.system).expectNothingPersisted(pid)
      replies.expectNoMessage(200.millis)
    }
  }
}
