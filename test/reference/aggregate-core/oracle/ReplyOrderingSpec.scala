package example.inventory.aggregatecore.reference

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.testkit.scaladsl.EventSourcedBehaviorTestKit
import akka.persistence.typed.PersistenceId
import com.typesafe.config.ConfigFactory
import example.inventory.application.aggregates.WarehouseActorProtocol
import example.inventory.application.aggregates.WarehouseActorProtocol._
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.values._
import example.inventory.infrastructure.bootstrap.WarehouseBootstrap
import java.util.concurrent.TimeUnit
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.duration._
import scala.util.{Failure, Success}

final class ReplyOrderingSpec extends AnyFunSuite {
  private val config = ConfigFactory.parseString("""
    akka.actor.provider = local
    akka.loglevel = WARNING
    akka.persistence.journal.plugin = "aggregate-core-controlled-journal"
    aggregate-core-controlled-journal.class = "example.inventory.aggregatecore.reference.ControlledAggregateCoreJournal"
    aggregate-core-controlled-journal.plugin-dispatcher = "akka.actor.default-dispatcher"
    akka.persistence.testkit.snapshots.serialize = false
  """).withFallback(EventSourcedBehaviorTestKit.config).withFallback(ConfigFactory.load())

  private def pendingFor(pid: String): ControlledAggregateCoreJournal.Pending = {
    val pending = ControlledAggregateCoreJournal.writes.poll(5L, TimeUnit.SECONDS)
    assert(pending != null, "actor did not submit a journal write")
    assert(pending.persistenceIds == Vector(pid))
    assert(pending.batches == 1, "one command must submit its events in one persist")
    pending
  }

  test("nonempty Accepted waits for the controlled ACK, then state matches the acknowledged fold") {
    val kit = ActorTestKit(config)
    var pending: ControlledAggregateCoreJournal.Pending = null
    try {
      assert(ControlledAggregateCoreJournal.writes.isEmpty)
      val pid = "aggregate-core-delayed-ack"
      val ref = kit.spawn(WarehouseBootstrap.create(PersistenceId.ofUniqueId(pid), WarehouseState(),
        ReferenceSupport.forbiddenHost, ReferenceSupport.identityEvents, ReferenceSupport.identitySnapshots))
      val replies = kit.createTestProbe[Reply]()
      val tx = TxId("delayed")
      ref ! Execute(CommitSkuReservation(tx, WarehouseId("w"), SkuId("s"), ReservationId("r")), replies.ref)
      pending = pendingFor(pid)
      assert(pending.events == Vector(SkuReservationCommitted(tx)))
      replies.expectNoMessage(200.millis)
      pending.completion.success(Vector.fill(pending.batches)(Success(())))
      replies.expectMessage(Accepted(Vector(SkuReservationCommitted(tx))))
      val query = kit.createTestProbe[WarehouseState]()
      ref ! GetState(query.ref)
      query.expectMessage(WarehouseState(Map(tx -> "SkuReservationCommitted")))
      replies.expectNoMessage(100.millis)
    } finally {
      if (pending != null) pending.completion.tryFailure(new IllegalStateException("test ended before ACK"))
      kit.shutdownTestKit()
    }
  }

  test("journal per-write rejection terminates without producing Accepted") {
    val kit = ActorTestKit(config)
    var pending: ControlledAggregateCoreJournal.Pending = null
    try {
      assert(ControlledAggregateCoreJournal.writes.isEmpty)
      val pid = "aggregate-core-write-rejected"
      val ref = kit.spawn(WarehouseBootstrap.create(PersistenceId.ofUniqueId(pid), WarehouseState(),
        ReferenceSupport.forbiddenHost, ReferenceSupport.identityEvents, ReferenceSupport.identitySnapshots))
      val replies = kit.createTestProbe[Reply]()
      val termination = kit.createTestProbe[WarehouseActorProtocol.Command]()
      val tx = TxId("rejected")
      ref ! Execute(CommitSkuReservation(tx, WarehouseId("w"), SkuId("s"), ReservationId("r")), replies.ref)
      pending = pendingFor(pid)
      assert(pending.events == Vector(SkuReservationCommitted(tx)))
      replies.expectNoMessage(200.millis)
      pending.completion.success(Vector.fill(pending.batches)(Failure(new IllegalArgumentException("journal refused write"))))
      termination.expectTerminated(ref)
      replies.expectNoMessage(200.millis)
    } finally {
      if (pending != null) pending.completion.tryFailure(new IllegalStateException("test ended before rejection"))
      kit.shutdownTestKit()
    }
  }

  test("failed journal Future terminates without producing Accepted or hidden retries") {
    val kit = ActorTestKit(config)
    var pending: ControlledAggregateCoreJournal.Pending = null
    try {
      assert(ControlledAggregateCoreJournal.writes.isEmpty)
      val pid = "aggregate-core-write-failed"
      val ref = kit.spawn(WarehouseBootstrap.create(PersistenceId.ofUniqueId(pid), WarehouseState(),
        ReferenceSupport.forbiddenHost, ReferenceSupport.identityEvents, ReferenceSupport.identitySnapshots))
      val replies = kit.createTestProbe[Reply]()
      val termination = kit.createTestProbe[WarehouseActorProtocol.Command]()
      val tx = TxId("failed")
      ref ! Execute(CommitSkuReservation(tx, WarehouseId("w"), SkuId("s"), ReservationId("r")), replies.ref)
      pending = pendingFor(pid)
      assert(pending.events == Vector(SkuReservationCommitted(tx)))
      replies.expectNoMessage(200.millis)
      pending.completion.failure(new IllegalStateException("journal unavailable"))
      termination.expectTerminated(ref)
      replies.expectNoMessage(200.millis)
      assert(ControlledAggregateCoreJournal.writes.isEmpty, "no restart/backoff retry is configured")
    } finally {
      if (pending != null) pending.completion.tryFailure(new IllegalStateException("test ended before failure"))
      kit.shutdownTestKit()
    }
  }
}
