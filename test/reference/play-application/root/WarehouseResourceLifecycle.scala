package example.inventory.composition

import akka.actor.typed.ActorSystem
import java.util.concurrent.{ExecutorService, Executors, ThreadFactory}
import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._
import scala.util.control.NonFatal

final class WarehouseResourceLifecycle(system: ActorSystem[_]) {
  require(system != null)
  private implicit val ec: ExecutionContext = system.executionContext
  private var actions = Vector.empty[(String, Deadline => Future[Unit])]
  private var result: Option[Future[WarehouseCloseReport]] = None
  def register(name: String)(release: Deadline => Future[Unit]): Unit = synchronized {
    require(result.isEmpty && actions.size < 16 && name != null && name.nonEmpty && release != null && !actions.exists(_._1 == name), "resource already closing or registered")
    actions :+= name -> release
  }
  def close(): Future[WarehouseCloseReport] = synchronized {
    result.getOrElse {
      val promise = Promise[WarehouseCloseReport]()
      result = Some(promise.future)
      val fixed = actions.reverse
      val end = 10.seconds.fromNow
      val cleanup = Executors.newFixedThreadPool(fixed.size.max(1), new ThreadFactory {
        def newThread(work: Runnable): Thread = {
          val thread = new Thread(work, "application-resource-cleanup")
          thread.setDaemon(true)
          thread
        }
      })
      val cleanupEc = ExecutionContext.fromExecutorService(cleanup)
      def release(index: Int, errors: Vector[String]): Unit = {
        if (index == fixed.size) {
          awaitExecutor(cleanup, end, interrupt = false).onComplete { stopped =>
            val failures = if (stopped.isFailure) errors :+ "cleanup-executor" else errors
            promise.trySuccess(WarehouseCloseReport(failures.isEmpty, failures))
          }
        } else {
          val (name, action) = fixed(index)
          val settled = Promise[Unit]()
          val future = Future {
            Option(action(end)).getOrElse(Future.failed(new IllegalStateException("null release Future")))
          }(cleanupEc).flatMap(identity)(ExecutionContext.parasitic)
          val timeout = system.scheduler.scheduleOnce(end.timeLeft.max(Duration.Zero), new Runnable {
            def run(): Unit = settled.tryFailure(new java.util.concurrent.TimeoutException("resource close deadline"))
          })
          future.onComplete { value => if (settled.tryComplete(value)) timeout.cancel() }(ExecutionContext.parasitic)
          settled.future.onComplete { value => release(index + 1, if (value.isFailure) errors :+ name else errors) }
        }
      }
      release(0, Vector.empty)
      promise.future
    }
  }
  def stopExecutor(executor: ExecutorService, end: Deadline): Future[Unit] = awaitExecutor(executor, end, interrupt = true)
  private def awaitExecutor(executor: ExecutorService, end: Deadline, interrupt: Boolean): Future[Unit] = {
    executor.shutdown()
    val stopped = Promise[Unit]()
    val poll = system.scheduler.scheduleAtFixedRate(Duration.Zero, 20.millis)(new Runnable {
      def run(): Unit = {
        if (executor.isTerminated) stopped.trySuccess(())
        else if (end.isOverdue()) {
          if (interrupt) executor.shutdownNow()
          stopped.tryFailure(new IllegalStateException("executor close deadline"))
        }
      }
    })
    stopped.future.onComplete(_ => poll.cancel())(ExecutionContext.parasitic)
    stopped.future
  }
}
