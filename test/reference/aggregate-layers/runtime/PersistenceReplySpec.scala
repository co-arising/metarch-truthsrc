package example.inventory.reference

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.{AtomicWrite, PersistentRepr}
import akka.persistence.journal.AsyncWriteJournal
import com.typesafe.config.ConfigFactory
import example.inventory.application.aggregates.WarehouseProtocol
import example.inventory.domain.{WarehouseComputations, WarehouseProtocol => Payload, WarehouseState}
import example.inventory.domain.values._
import example.inventory.infrastructure.bootstrap.WarehouseBootstrap
import java.util.concurrent.{LinkedBlockingQueue, TimeUnit}
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.{Future, Promise}
import scala.concurrent.duration._
import scala.util.{Success, Try}

object ControlledReferenceJournal {
  final case class Pending(events: Vector[Any], complete: Promise[Seq[Try[Unit]]], batches: Int)
  val writes = new LinkedBlockingQueue[Pending]()
}

// This journal controls write acknowledgement only; it does not model durable storage or replay.
final class ControlledReferenceJournal extends AsyncWriteJournal {
  override def asyncWriteMessages(messages: Seq[AtomicWrite]): Future[Seq[Try[Unit]]] = {
    val completion = Promise[Seq[Try[Unit]]]()
    ControlledReferenceJournal.writes.put(ControlledReferenceJournal.Pending(
      messages.flatMap(_.payload.map(_.payload)).toVector, completion, messages.size))
    completion.future
  }
  override def asyncDeleteMessagesTo(persistenceId: String, toSequenceNr: Long): Future[Unit] = Future.successful(())
  override def asyncReadHighestSequenceNr(persistenceId: String, fromSequenceNr: Long): Future[Long] = Future.successful(0L)
  override def asyncReplayMessages(persistenceId: String, fromSequenceNr: Long, toSequenceNr: Long,
      max: Long)(recoveryCallback: PersistentRepr => Unit): Future[Unit] = Future.successful(())
}

final class PersistenceReplySpec extends AnyFunSuite {
  test("successful command cannot reply before its journal write has been acknowledged") {
    val config = ConfigFactory.parseString("""
      akka.actor.provider = local
      akka.loglevel = WARNING
      akka.persistence.journal.plugin = "reference-controlled-journal"
      reference-controlled-journal.class = "example.inventory.reference.ControlledReferenceJournal"
      reference-controlled-journal.plugin-dispatcher = "akka.actor.default-dispatcher"
    """).withFallback(ConfigFactory.load())
    val kit = ActorTestKit(config)
    var pending: ControlledReferenceJournal.Pending = null
    try {
      assert(ControlledReferenceJournal.writes.isEmpty)
      val hosts = new WarehouseComputations {
        def ReservationIdentity(state: WarehouseState, command: Payload.ReserveSkuQuantity): ReservationId =
          ReservationId("unused")
      }
      val ref = kit.spawn(WarehouseBootstrap.create("reference-controlled", WarehouseState.empty, hosts))
      val reply = kit.createTestProbe[WarehouseProtocol.Reply]()
      val txid = TxId("delayed-write")
      ref ! WarehouseProtocol.Execute(Payload.CommitSkuReservation(txid, WarehouseId("w"), SkuId("s"), ReservationId("r")), reply.ref)
      pending = ControlledReferenceJournal.writes.poll(5L, TimeUnit.SECONDS)
      assert(pending != null, "command never submitted a journal write")
      assert(pending.events == Vector(Payload.SkuReservationCommitted(txid)))
      reply.expectNoMessage(200.millis)
      pending.complete.success(Vector.fill(pending.batches)(Success(())))
      reply.expectMessage(WarehouseProtocol.Accepted(Vector(Payload.SkuReservationCommitted(txid))))
      val state = kit.createTestProbe[WarehouseState]()
      ref ! WarehouseProtocol.GetState(state.ref)
      state.expectMessage(WarehouseState(Map(txid -> "SkuReservationCommitted")))
    } finally {
      if (pending != null) pending.complete.trySuccess(Vector.fill(pending.batches)(Success(())))
      kit.shutdownTestKit()
    }
  }
}
