package example.inventory.aggregatecore.reference

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.{ActorRef, Behavior}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.PersistenceId
import com.typesafe.config.ConfigFactory
import example.inventory.application.aggregates.{WarehouseActorProtocol, WarehouseActorRepository}
import example.inventory.application.aggregates.WarehouseActorProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.values.TxId
import example.inventory.infrastructure.repositories.LocalWarehouseActorRepository
import java.util.concurrent.{CountDownLatch, TimeUnit}
import java.util.concurrent.atomic.AtomicReference
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.duration._

final class RepositorySpec extends AnyFunSuite {
  private def withKit(body: ActorTestKit => Unit): Unit = {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local\nakka.loglevel = WARNING"))
    try body(kit)
    finally kit.shutdownTestKit()
  }

  private def echo: Behavior[WarehouseActorProtocol.Command] = Behaviors.receiveMessage {
    case GetState(replyTo) =>
      replyTo ! WarehouseState(Map(TxId("alive") -> "caller-owned"))
      Behaviors.same
    case Execute(_, replyTo) =>
      replyTo ! Rejected("test-echo")
      Behaviors.same
  }

  test("same key caches the exact Handle, with identity/behavior/spawn called once in order") {
    withKit { kit =>
      var calls = Vector.empty[String]
      val repo: WarehouseActorRepository[String] = new LocalWarehouseActorRepository[String](
        key => { calls :+= ("identity:" + key); PersistenceId.ofUniqueId("pid-" + key) },
        (key, pid) => { calls :+= ("behavior:" + key + ":" + pid.id); echo },
        (key, pid, behavior) => { calls :+= ("spawn:" + key + ":" + pid.id); kit.spawn(behavior) }
      )
      val first = repo.get("left")
      assert(repo.get("left") eq first)
      val second = repo.get("right")
      assert(second.persistenceId.id == "pid-right" && second.ref != first.ref)
      assert(calls == Vector("identity:left", "behavior:left:pid-left", "spawn:left:pid-left",
        "identity:right", "behavior:right:pid-right", "spawn:right:pid-right"))
    }
  }

  test("different keys with the same PID reject before behavior/spawn without disturbing the first key") {
    withKit { kit =>
      var builds = 0
      var spawns = 0
      val repo = new LocalWarehouseActorRepository[String](
        _ => PersistenceId.ofUniqueId("collision"),
        (_, _) => { builds += 1; echo },
        (_, _, behavior) => { spawns += 1; kit.spawn(behavior) }
      )
      val first = repo.get("left")
      val collision = intercept[IllegalArgumentException](repo.get("right"))
      assert(collision.getMessage.contains("different key"))
      assert(builds == 1 && spawns == 1)
      assert(repo.get("left") eq first)
    }
  }

  for (phase <- Vector("identity", "behavior", "spawn")) {
    test(phase + " failure neither caches the key nor reserves its PID and same key can retry") {
      withKit { kit =>
        val failure = new IllegalStateException("failed-" + phase)
        var fail = true
        val repo = new LocalWarehouseActorRepository[String](
          key => { if (phase == "identity" && fail) throw failure; PersistenceId.ofUniqueId("retry-" + key) },
          (_, _) => { if (phase == "behavior" && fail) throw failure; echo },
          (_, _, behavior) => { if (phase == "spawn" && fail) throw failure; kit.spawn(behavior) }
        )
        assert(intercept[IllegalStateException](repo.get("same")) eq failure)
        fail = false
        val retried = repo.get("same")
        assert(retried.persistenceId.id == "retry-same")
        assert(repo.get("same") eq retried)
      }
    }
  }

  test("failed or null spawn does not reserve a PID against a different key") {
    withKit { kit =>
      for (returnNull <- Vector(false, true)) {
        var fail = true
        val repo = new LocalWarehouseActorRepository[String](
          _ => PersistenceId.ofUniqueId("shared-after-failure"),
          (_, _) => echo,
          (_, _, behavior) => {
            if (fail) {
              if (returnNull) null
              else throw new IllegalStateException("spawn unavailable")
            } else kit.spawn(behavior)
          }
        )
        if (returnNull) intercept[IllegalArgumentException](repo.get("failed"))
        else intercept[IllegalStateException](repo.get("failed"))
        fail = false
        assert(repo.get("replacement").persistenceId.id == "shared-after-failure")
      }
    }
  }

  test("null callbacks, key, identity, behavior and actor result plus blank PID reject explicitly") {
    withKit { kit =>
      val identity: String => PersistenceId = key => PersistenceId.ofUniqueId("null-test-" + key)
      val behavior: (String, PersistenceId) => Behavior[WarehouseActorProtocol.Command] = (_, _) => echo
      val spawn: (String, PersistenceId, Behavior[WarehouseActorProtocol.Command]) => ActorRef[WarehouseActorProtocol.Command] =
        (_, _, value) => kit.spawn(value)
      intercept[IllegalArgumentException](new LocalWarehouseActorRepository[String](null, behavior, spawn))
      intercept[IllegalArgumentException](new LocalWarehouseActorRepository[String](identity, null, spawn))
      intercept[IllegalArgumentException](new LocalWarehouseActorRepository[String](identity, behavior, null))
      val repo = new LocalWarehouseActorRepository[String](identity, behavior, spawn)
      intercept[IllegalArgumentException](repo.get(null))
      intercept[IllegalArgumentException](new LocalWarehouseActorRepository[String](_ => null, behavior, spawn).get("bad"))
      // PersistenceId rejects blank identity at construction, inside the callback.
      intercept[IllegalArgumentException](new LocalWarehouseActorRepository[String](_ => PersistenceId.ofUniqueId("   "), behavior, spawn).get("bad"))
      intercept[IllegalArgumentException](new LocalWarehouseActorRepository[String](identity, (_, _) => null, spawn).get("bad"))
      intercept[IllegalArgumentException](new LocalWarehouseActorRepository[String](identity, behavior, (_, _, _) => null).get("bad"))
      assert(repo.get("valid").persistenceId.id == "null-test-valid")
    }
  }

  for (phase <- Vector("identity", "behavior", "spawn"); operation <- Vector("get", "close")) {
    test(phase + " callback rejects reentrant " + operation + " and a failed outer lookup is retryable") {
      withKit { kit =>
        var repo: LocalWarehouseActorRepository[String] = null
        var reenter = true
        def callback(currentPhase: String): Unit = {
          if (reenter && phase == currentPhase) {
            if (operation == "get") repo.get("inner")
            else repo.close()
          }
        }
        repo = new LocalWarehouseActorRepository[String](
          key => { callback("identity"); PersistenceId.ofUniqueId("reentry-" + key) },
          (_, _) => { callback("behavior"); echo },
          (_, _, behavior) => { callback("spawn"); kit.spawn(behavior) }
        )
        val failure = intercept[IllegalStateException](repo.get("outer"))
        assert(failure.getMessage.contains("reentry"))
        reenter = false
        val retried = repo.get("outer")
        assert(repo.get("outer") eq retried)
        assert(repo.get("inner").persistenceId.id == "reentry-inner")
      }
    }
  }

  test("close is idempotent, disallows get and does not stop an already handed out actor") {
    withKit { kit =>
      val repo = new LocalWarehouseActorRepository[String](
        key => PersistenceId.ofUniqueId("close-" + key), (_, _) => echo, (_, _, behavior) => kit.spawn(behavior))
      val handle = repo.get("owned")
      repo.close()
      repo.close()
      intercept[IllegalStateException](repo.get("owned"))
      intercept[IllegalStateException](repo.get("new"))
      val state = kit.createTestProbe[WarehouseState]()
      handle.ref ! GetState(state.ref)
      state.expectMessage(WarehouseState(Map(TxId("alive") -> "caller-owned")))
      state.expectNoMessage(100.millis)
    }
  }

  test("close on another thread waits for a complete lookup rather than clearing partially built ownership") {
    withKit { kit =>
      val enteredSpawn = new CountDownLatch(1)
      val releaseSpawn = new CountDownLatch(1)
      val closeStarted = new CountDownLatch(1)
      val closeDone = new CountDownLatch(1)
      val failure = new AtomicReference[Throwable]()
      val delivered = new AtomicReference[WarehouseActorRepository.Handle]()
      val repo = new LocalWarehouseActorRepository[String](
        key => PersistenceId.ofUniqueId("serial-" + key),
        (_, _) => echo,
        (_, _, behavior) => {
          enteredSpawn.countDown()
          assert(releaseSpawn.await(5L, TimeUnit.SECONDS), "test did not release spawn")
          kit.spawn(behavior)
        }
      )
      val lookup = new Thread(new Runnable {
        def run(): Unit = try delivered.set(repo.get("key")) catch { case error: Throwable => failure.set(error) }
      })
      val closer = new Thread(new Runnable {
        def run(): Unit = {
          closeStarted.countDown()
          try repo.close() catch { case error: Throwable => failure.set(error) }
          finally closeDone.countDown()
        }
      })
      try {
        lookup.start()
        assert(enteredSpawn.await(5L, TimeUnit.SECONDS))
        closer.start()
        assert(closeStarted.await(5L, TimeUnit.SECONDS))
        assert(!closeDone.await(150L, TimeUnit.MILLISECONDS), "close raced through a callback")
        releaseSpawn.countDown()
        lookup.join(5000L)
        closer.join(5000L)
        assert(!lookup.isAlive && !closer.isAlive)
        assert(failure.get() == null)
        assert(delivered.get() != null && closeDone.getCount == 0L)
        intercept[IllegalStateException](repo.get("key"))
        val state = kit.createTestProbe[WarehouseState]()
        delivered.get().ref ! GetState(state.ref)
        state.expectMessage(WarehouseState(Map(TxId("alive") -> "caller-owned")))
      } finally {
        releaseSpawn.countDown()
        lookup.join(5000L)
        if (closer.getState != Thread.State.NEW) closer.join(5000L)
      }
    }
  }
}
