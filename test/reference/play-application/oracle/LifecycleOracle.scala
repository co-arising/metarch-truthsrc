package example.inventory.playreference.oracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import com.typesafe.config.ConfigFactory
import example.inventory.composition.WarehouseResourceLifecycle
import java.util.concurrent.{CountDownLatch, Executors, TimeUnit}
import java.util.concurrent.atomic.AtomicBoolean
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.{Await, ExecutionContext, Future, Promise, blocking}
import scala.concurrent.duration._

object LifecycleOracle {
  private val ids = ArrayBuffer.empty[String]
  private def check(value: Boolean, id: String): Unit = { assert(value, id); ids += id; println("CASE " + id) }
  def main(args: Array[String]): Unit = {
    require(args.isEmpty)
    val system = ActorSystem[Nothing](Behaviors.empty, "LifecycleOracle", ConfigFactory.parseString("akka.actor.provider=local\nakka.loglevel=WARNING"))
    implicit val ec: ExecutionContext = system.executionContext
    try {
      val order = ArrayBuffer.empty[String]
      val lifecycle = new WarehouseResourceLifecycle(system)
      lifecycle.register("first") { _ => order += "first"; Future.successful(()) }
      lifecycle.register("second") { _ => order += "second"; throw new IllegalStateException("second-cleanup-failed") }
      lifecycle.register("third") { _ => order += "third"; Future.failed(new IllegalStateException("first-cleanup-failed")) }
      val report = lifecycle.close()
      check(lifecycle.close() eq report, "lifecycle-same-future")
      val closed = Await.result(report, 2.seconds)
      check(order.toVector == Vector("third", "second", "first"), "cleanup-continues-in-reverse-order")
      check(!closed.drained && closed.failures == Vector("third", "second"), "cleanup-failures-retained")
      val lateRegistration = scala.util.Try(lifecycle.register("late")(_ => Future.successful(())))
      check(lateRegistration.isFailure, "closing-registration-rejected")

      val blocked = new WarehouseResourceLifecycle(system)
      val executor = Executors.newFixedThreadPool(2)
      val blockingEc = ExecutionContext.fromExecutorService(executor)
      val occupied = new CountDownLatch(2)
      val workUnblock = new CountDownLatch(1)
      (1 to 2).foreach { _ => Future(blocking { occupied.countDown(); workUnblock.await() })(blockingEc) }
      check(occupied.await(2, TimeUnit.SECONDS), "workload-executor-saturated")
      val entered = new CountDownLatch(1)
      val disposed = new CountDownLatch(1)
      val unblock = new CountDownLatch(1)
      val remaining = new AtomicBoolean(false)
      blocked.register("executor")(end => blocked.stopExecutor(executor, end))
      blocked.register("remaining") { _ => remaining.set(true); Future.successful(()) }
      blocked.register("readside-pool") { _ =>
        entered.countDown()
        unblock.await()
        disposed.countDown()
        Future.successful(())
      }
      val start = System.nanoTime()
      val closing = blocked.close()
      check((System.nanoTime() - start) < 1000000000L, "synchronous-release-does-not-block-close")
      try {
        check(entered.await(2, TimeUnit.SECONDS), "blocking-release-entered")
        val responsive = Promise[Unit]()
        system.scheduler.scheduleOnce(20.millis, new Runnable { def run(): Unit = responsive.success(()) })
        Await.result(responsive.future, 1.second)
        check(true, "play-dispatcher-progresses-during-release")
        val result = Await.result(closing, 11.seconds)
        val elapsedMillis = (System.nanoTime() - start) / 1000000L
        check(elapsedMillis >= 9500 && elapsedMillis < 11000, "one-absolute-close-deadline")
        check(!result.drained && result.failures.contains("readside-pool"), "blocked-release-not-drained")
        check(remaining.get(), "deadline-continues-remaining-cleanup")
      } finally {
        unblock.countDown()
        workUnblock.countDown()
        executor.shutdownNow()
        check(executor.awaitTermination(2, TimeUnit.SECONDS), "blocked-executor-eventually-terminated")
        check(disposed.await(2, TimeUnit.SECONDS), "mandatory-disposal-not-discarded")
      }
      println("PLAY_LIFECYCLE_ORACLE_PASSED assertions=" + ids.size)
    } finally {
      system.terminate()
      Await.result(system.whenTerminated, 8.seconds)
    }
  }
}
