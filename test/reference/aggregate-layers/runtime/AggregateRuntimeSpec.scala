package example.inventory.reference

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.ActorRef
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.testkit.scaladsl.{EventSourcedBehaviorTestKit, PersistenceTestKit}
import com.typesafe.config.ConfigFactory
import example.inventory.application.aggregates.{AllocationOrderProtocol => Allocation, WarehouseProtocol => Protocol, WarehouseRepository}
import example.inventory.domain.{AllocationOrderComputations, AllocationOrderProtocol => AllocationPayload, AllocationOrderState, WarehouseComputations, WarehouseProtocol => Payload, WarehouseState}
import example.inventory.domain.values._
import example.inventory.infrastructure.bootstrap.{AllocationOrderBootstrap, WarehouseBootstrap}
import org.scalatest.funsuite.AnyFunSuite

import scala.concurrent.duration._

final class AggregateRuntimeSpec extends AnyFunSuite {
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

  private val hosts = new WarehouseComputations {
    def ReservationIdentity(state: WarehouseState, command: Payload.ReserveSkuQuantity): ReservationId =
      ReservationId("reservation-" + command.txid.value)
  }

  test("queries and refusals do not persist; accepted commands persist before reply and survive restart") {
    withKit { kit =>
      val behavior = WarehouseBootstrap.create("reference-warehouse", WarehouseState.empty, hosts)
      val testkit = EventSourcedBehaviorTestKit[Protocol.Command, Payload.Event, WarehouseState](
        kit.system, behavior, EventSourcedBehaviorTestKit.SerializationSettings.disabled)
      val query = testkit.runCommand[WarehouseState](reply => Protocol.GetState(reply))
      assert(query.hasNoEvents && query.reply == WarehouseState.empty)
      val txid = TxId("tx-actor")
      val rejected = testkit.runCommand[Protocol.Reply](reply => Protocol.Execute(
        Payload.ReserveSkuQuantity(txid, WarehouseId("w"), SkuId("s"), 0L), reply))
      assert(rejected.hasNoEvents && rejected.reply == Protocol.Refused("quantity-positive"))
      val accepted = testkit.runCommand[Protocol.Reply](reply => Protocol.Execute(
        Payload.CommitSkuReservation(txid, WarehouseId("w"), SkuId("s"), ReservationId("r")), reply))
      val expected = Payload.SkuReservationCommitted(txid)
      assert(accepted.events == Seq(expected))
      assert(accepted.reply == Protocol.Accepted(Vector(expected)))
      assert(accepted.state.receipts == Map(txid -> "SkuReservationCommitted"))
      testkit.restart()
      val recovered = testkit.runCommand[WarehouseState](reply => Protocol.GetState(reply))
      assert(recovered.reply.receipts == Map(txid -> "SkuReservationCommitted"))
      assert(recovered.hasNoEvents)
    }
  }

  test("all command variants dispatch to their own rule and event") {
    withKit { kit =>
      val testkit = EventSourcedBehaviorTestKit[Protocol.Command, Payload.Event, WarehouseState](
        kit.system, WarehouseBootstrap.create("reference-dispatch", WarehouseState.empty, hosts),
        EventSourcedBehaviorTestKit.SerializationSettings.disabled)
      val txid = TxId("dispatch")
      val reserve = testkit.runCommand[Protocol.Reply](reply => Protocol.Execute(
        Payload.ReserveSkuQuantity(txid, WarehouseId("w"), SkuId("s"), 2L), reply))
      assert(reserve.events == Seq(Payload.SkuQuantityReserved(ReservationId("reservation-dispatch"))))
      val released = testkit.runCommand[Protocol.Reply](reply => Protocol.Execute(
        Payload.ReleaseSkuReservation(txid, WarehouseId("w"), SkuId("s"), ReservationId("r")), reply))
      assert(released.events == Seq(Payload.SkuReservationReleased(txid)))
      val request = Payload.RequestSkuReservation(ReservationRequestId("req"), WarehouseId("w"), SkuId("s"),
        2L, AllocationId("a"), WarehouseId("destination"))
      val requested = testkit.runCommand[Protocol.Reply](reply => Protocol.Execute(request, reply))
      assert(requested.events == Seq(Payload.SkuReservationRequested(request.requestId, request.warehouse,
        request.sku, request.quantity, request.allocation, request.destination)))
    }
  }

  private final case class ExternalIngress(
      producer: String,
      result: String,
      event: TxId => AllocationPayload.Event,
      command: (TxId, String, ActorRef[Allocation.Reply]) => Allocation.Command)

  // Fixed fixture outcomes, not inferred from the generated external-event mapper.
  private val externalIngresses = Vector(
    ExternalIngress("reservationCompletion0", "ReservationSucceeded", txid => AllocationPayload.ReservationSucceeded(txid),
      (txid, authorization, reply) => Allocation.IngestreservationCompletion0(CompletionRecord0(txid), authorization, reply)),
    ExternalIngress("reservationCompletion1", "ReservationRejected", txid => AllocationPayload.ReservationRejected(txid),
      (txid, authorization, reply) => Allocation.IngestreservationCompletion1(CompletionRecord1(txid), authorization, reply)),
    ExternalIngress("reservationCompletion2", "ReservationCompensated", txid => AllocationPayload.ReservationCompensated(txid),
      (txid, authorization, reply) => Allocation.IngestreservationCompletion2(CompletionRecord2(txid), authorization, reply)),
    ExternalIngress("reservationCompletion3", "ReservationRecoveryRequired", txid => AllocationPayload.ReservationRecoveryRequired(txid),
      (txid, authorization, reply) => Allocation.IngestreservationCompletion3(CompletionRecord3(txid), authorization, reply)),
    ExternalIngress("reservationCompletion4", "ReservationOutcomeUnknown", txid => AllocationPayload.ReservationOutcomeUnknown(txid),
      (txid, authorization, reply) => Allocation.IngestreservationCompletion4(CompletionRecord4(txid), authorization, reply))
  )

  for (ingress <- externalIngresses) {
    test(s"external ingress ${ingress.producer} denies without persistence and accepts only its exact outcome") {
      withKit { kit =>
        var observed = Vector.empty[(String, String, Vector[String])]
        val authority = new Allocation.ExternalAuthority {
          def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = {
            observed :+= ((producer, authorization, identity))
            authorization == "allowed"
          }
        }
        val behavior = AllocationOrderBootstrap.create("reference-external-" + ingress.producer,
          AllocationOrderState.empty, AllocationOrderComputations.none, authority)
        val testkit = EventSourcedBehaviorTestKit[Allocation.Command, AllocationPayload.Event, AllocationOrderState](
          kit.system, behavior, EventSourcedBehaviorTestKit.SerializationSettings.disabled)
        val deniedTxid = TxId("denied-" + ingress.producer)
        val rejected = testkit.runCommand[Allocation.Reply](reply => ingress.command(deniedTxid, "denied", reply))
        assert(rejected.hasNoEvents)
        assert(rejected.reply == Allocation.Refused("external-authority-denied"))
        assert(rejected.state == AllocationOrderState.empty)

        val txid = TxId("accepted-" + ingress.producer)
        val expected = ingress.event(txid)
        val accepted = testkit.runCommand[Allocation.Reply](reply => ingress.command(txid, "allowed", reply))
        assert(accepted.events == Seq(expected))
        assert(accepted.reply == Allocation.Accepted(Vector(expected)))
        val expectedState = AllocationOrderState("new", ingress.result)
        assert(accepted.state == expectedState)
        assert(observed == Vector(
          (ingress.producer, "denied", Vector(deniedTxid.value)),
          (ingress.producer, "allowed", Vector(txid.value))))
        testkit.restart()
        val state = testkit.runCommand[AllocationOrderState](reply => Allocation.GetState(reply))
        assert(state.hasNoEvents && state.reply == expectedState)
        assert(observed.size == 2, "recovery and queries must not call external authority")
      }
    }

    test(s"throwing authority for ${ingress.producer} stops without a journal event or an accepted reply") {
      withKit { kit =>
        val persistenceId = "reference-throwing-" + ingress.producer
        val journal = PersistenceTestKit(kit.system)
        val observed = kit.createTestProbe[(String, String, Vector[String])]()
        val replies = kit.createTestProbe[Allocation.Reply]()
        val termination = kit.createTestProbe[Allocation.Command]()
        val authority = new Allocation.ExternalAuthority {
          def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = {
            observed.ref ! ((producer, authorization, identity))
            throw new IllegalStateException("authority unavailable")
          }
        }
        val ref = kit.spawn(AllocationOrderBootstrap.create(persistenceId, AllocationOrderState.empty,
          AllocationOrderComputations.none, authority))
        val txid = TxId("throwing-" + ingress.producer)
        ref ! ingress.command(txid, "token", replies.ref)
        observed.expectMessage((ingress.producer, "token", Vector(txid.value)))
        // The existing bootstrap has no exception-to-refusal or restart policy.
        // Wait for termination instead of runCommand, which would await a reply.
        termination.expectTerminated(ref)
        journal.expectNothingPersisted(persistenceId)
        replies.expectNoMessage(200.millis)
      }
    }
  }

  test("local repository caches successful spawns, rejects PID collisions and does not stop actors on close") {
    withKit { kit =>
      var spawns = 0
      val ref = kit.spawn(Behaviors.receiveMessage[Protocol.Command] {
        case Protocol.GetState(reply) =>
          reply ! WarehouseState.empty
          Behaviors.same
        case _ => Behaviors.same
      })
      var behaviorCalls = 0
      val createdBehavior = Behaviors.receiveMessage[Protocol.Command](_ => Behaviors.same)
      val repository = new WarehouseRepository[String](_ => "same-pid",
        (id, pid) => {
          assert(id == "one" && pid == "same-pid")
          behaviorCalls += 1
          createdBehavior
        },
        (pid, behavior) => {
          assert(pid == "same-pid" && (behavior eq createdBehavior))
          spawns += 1
          ref
        })
      val handle = repository.get("one")
      assert(handle.persistenceId == "same-pid" && handle.ref == ref)
      assert(repository.get("one") eq handle)
      intercept[IllegalArgumentException](repository.get("two"))
      assert(repository.get("one") eq handle)
      assert(spawns == 1 && behaviorCalls == 1, "collisions and cache hits must not build or spawn")
      repository.close()
      repository.close()
      intercept[IllegalArgumentException](repository.get("one"))
      intercept[IllegalArgumentException](repository.get("new"))
      assert(spawns == 1 && behaviorCalls == 1)
      val probe = kit.createTestProbe[WarehouseState]()
      ref ! Protocol.GetState(probe.ref)
      probe.expectMessage(WarehouseState.empty)
      kit.stop(ref)
    }
  }

  for (failure <- Vector("throw", "null")) {
    test(s"repository $failure spawn result is not cached and the same key can retry") {
      withKit { kit =>
        var attempts = 0
        val ref = kit.spawn(Behaviors.ignore[Protocol.Command])
        val repository = new WarehouseRepository[String](identity, (_, _) => Behaviors.ignore,
          (_, _) => {
            attempts += 1
            if (attempts == 1) {
              if (failure == "throw") throw new IllegalStateException("spawn failed")
              else null
            } else ref
          })
        if (failure == "throw") intercept[IllegalStateException](repository.get("one"))
        else intercept[IllegalArgumentException](repository.get("one"))
        assert(attempts == 1)
        val recovered = repository.get("one")
        assert(recovered == WarehouseRepository.Handle("one", ref))
        assert(repository.get("one") eq recovered)
        assert(attempts == 2)
        repository.close()
      }
    }

    test(s"repository $failure spawn result does not reserve the PID against another key") {
      withKit { kit =>
        var attempts = 0
        val ref = kit.spawn(Behaviors.ignore[Protocol.Command])
        val repository = new WarehouseRepository[String](_ => "reusable-pid", (_, _) => Behaviors.ignore,
          (_, _) => {
            attempts += 1
            if (attempts == 1) {
              if (failure == "throw") throw new IllegalStateException("spawn failed")
              else null
            } else ref
          })
        if (failure == "throw") intercept[IllegalStateException](repository.get("first"))
        else intercept[IllegalArgumentException](repository.get("first"))
        val recovered = repository.get("second")
        assert(recovered == WarehouseRepository.Handle("reusable-pid", ref))
        assert(repository.get("second") eq recovered)
        intercept[IllegalArgumentException](repository.get("first"))
        assert(attempts == 2, "only successful spawns reserve a PID")
        repository.close()
      }
    }
  }

  test("repository rejects null and empty persistence identities before building or spawning") {
    for (pid <- Vector[String](null, "")) {
      var identityCalls = 0
      var behaviorCalls = 0
      var spawnCalls = 0
      val repository = new WarehouseRepository[String](
        _ => { identityCalls += 1; pid },
        (_, _) => { behaviorCalls += 1; Behaviors.ignore },
        (_, _) => { spawnCalls += 1; null })
      intercept[IllegalArgumentException](repository.get("one"))
      intercept[IllegalArgumentException](repository.get("one"))
      assert(identityCalls == 2, "an invalid identity must not leave a cached handle")
      assert(behaviorCalls == 0 && spawnCalls == 0)
      repository.close()
    }
  }

  test("bootstrap preserves explicit admission and existing companion identities") {
    intercept[IllegalArgumentException](WarehouseBootstrap.create(null, WarehouseState.empty, hosts))
    intercept[IllegalArgumentException](WarehouseBootstrap.create("", WarehouseState.empty, hosts))
    intercept[IllegalArgumentException](WarehouseBootstrap.create("valid", WarehouseState.empty, null))
    intercept[IllegalArgumentException](AllocationOrderBootstrap.create("valid", AllocationOrderState.empty,
      AllocationOrderComputations.none, null))
    assert(Protocol.Execute eq example.inventory.domain.WarehouseAggregate.Execute)
    assert(Protocol.GetState eq example.inventory.domain.WarehouseAggregate.GetState)
    assert(Protocol.Accepted eq example.inventory.domain.WarehouseAggregate.Accepted)
    assert(Protocol.Refused eq example.inventory.domain.WarehouseAggregate.Refused)
    assert(Allocation.IngestreservationCompletion0 eq example.inventory.domain.AllocationOrderAggregate.IngestreservationCompletion0)
    assert(Allocation.IngestreservationCompletion1 eq example.inventory.domain.AllocationOrderAggregate.IngestreservationCompletion1)
    assert(Allocation.IngestreservationCompletion2 eq example.inventory.domain.AllocationOrderAggregate.IngestreservationCompletion2)
    assert(Allocation.IngestreservationCompletion3 eq example.inventory.domain.AllocationOrderAggregate.IngestreservationCompletion3)
    assert(Allocation.IngestreservationCompletion4 eq example.inventory.domain.AllocationOrderAggregate.IngestreservationCompletion4)
  }
}
