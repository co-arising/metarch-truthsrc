export function sourceTemplate(m, out) {
  const n = m.names;
  out.append(`package ${n.source.package}

import scala.concurrent.{ExecutionContext, Future, blocking}

trait ${n.source.identifier} {
  def persistenceIds(after: Option[String], limit: Int): Future[Vector[String]]
  def currentEvents(pid: String, after: Long, limit: Int): Future[Vector[${n.envelope.identifier}]]
}
final class ${n.jdbcSource.identifier}(repository: ${n.repository.identifier}, blockingEc: ExecutionContext) extends ${n.source.identifier} {
  require(repository != null && blockingEc != null, "source repository and blocking EC required")
  override def persistenceIds(after: Option[String], limit: Int): Future[Vector[String]] = {
    require(after != null, "PID cursor option required"); after.foreach(${n.envelope.identifier}.identity)
    require(limit > 0 && limit <= ${m.product.store.pageSize}, "bounded page required")
    Future(blocking(repository.persistenceIds(after, limit)))(blockingEc)
  }
  override def currentEvents(pid: String, after: Long, limit: Int): Future[Vector[${n.envelope.identifier}]] = {
    ${n.envelope.identifier}.identity(pid)
    require(after >= 0L && limit > 0 && limit <= ${m.product.store.pageSize}, "bounded event page required")
    Future(blocking(repository.currentEvents(pid, after, limit)))(blockingEc)
  }
}
`, [m.product.store.bindingSource]);
}

export function runnerTemplate(m, out) {
  const n = m.names, p = m.product.store;
  out.append(`package ${n.runner.package}

import akka.Done
import akka.actor.Cancellable
import akka.actor.typed.ActorSystem
import scala.collection.mutable
import scala.concurrent.{ExecutionContext, Future, Promise, blocking}
import scala.concurrent.duration._
import scala.util.{Try, Success, Failure}
import scala.util.control.NonFatal

final class ${n.runner.identifier}(repository: ${n.repository.identifier}, handler: ${n.handler.identifier},
    source: ${n.source.identifier}, blockingEc: ExecutionContext, system: ActorSystem[_]) {
  require(repository != null && handler != null && source != null && blockingEc != null && system != null,
    "runner repository, handler, source, blocking EC and system required")
  private implicit val ec: ExecutionContext = blockingEc
  private val gate = new AnyRef
  private var closed = false
  private var pending = 0
  private var accepted = 0L
  private var completed = 0L
  private var firstFailure: Option[Throwable] = None
  private val failed = Promise[Throwable]()
  private val catchUps = mutable.Map.empty[String, Future[${n.catchUpResult.identifier}]]
  private var initializationWork: Option[Future[Done]] = None
  private var initializationResult: Option[Future[Done]] = None
  private var startResult: Option[Future[Done]] = None
  private var shutdownResult: Option[Promise[${n.shutdownResult.identifier}]] = None
  private var pollTimer: Option[Cancellable] = None
  private var shutdownTimer: Option[Cancellable] = None

  def failure: Future[Throwable] = failed.future
  private def observe(error: Throwable): Unit = gate.synchronized {
    if (firstFailure.isEmpty) { firstFailure = Some(error); failed.trySuccess(error) }
  }
  private def finishShutdown(): Unit = {
    if (closed && pending == 0) shutdownResult.foreach { promise =>
      if (promise.trySuccess(${n.shutdownResult.identifier}(drained = true, accepted, completed, firstFailure, timedOut = false))) {
        shutdownTimer.foreach(_.cancel()); shutdownTimer = None
      }
    }
  }
  private def safely[A](work: => Future[A]): Future[A] = try {
    val result = work
    if (result == null) Future.failed(new IllegalArgumentException("source returned null Future")) else result
  } catch { case NonFatal(error) => Future.failed(error) }

  // One admission owns its entire continuation, including pages accepted before
  // close. No continuation calls a public admission method during draining.
  private def admit[A](work: => Future[A], register: Future[A] => Unit = (_: Future[A]) => (),
      settled: () => Unit = () => ()): Future[A] = gate.synchronized {
    if (closed) Future.failed(new IllegalStateException("runner is closed"))
    else if (pending >= ${p.maxPending}) Future.failed(new IllegalStateException("runner capacity exceeded"))
    else {
      val promise = Promise[A]()
      pending += 1; accepted = Math.addExact(accepted, 1L)
      register(promise.future)
      safely(work).onComplete { result => gate.synchronized {
        result.failed.foreach(observe)
        settled()
        pending -= 1; completed = Math.addExact(completed, 1L)
        promise.tryComplete(result)
        finishShutdown()
      }}(ExecutionContext.parasitic)
      promise.future
    }
  }
  private def initialized(): Future[Done] = gate.synchronized {
    initializationWork.getOrElse {
      val result = Future(blocking { repository.initialize(); Done })
      initializationWork = Some(result)
      result
    }
  }
  def initialize(): Future[Done] = gate.synchronized {
    initializationResult.getOrElse {
      val result = admit(initialized())
      initializationResult = Some(result)
      result
    }
  }
  def project(envelope: ${n.envelope.identifier}): Future[${n.projectResult.identifier}] = {
    require(envelope != null, "envelope required")
    val fixed = ${n.envelope.identifier}.capture(envelope.pid, envelope.resource, envelope.sequenceNr, envelope.manifest, envelope.bytes)
    admit(initialized().flatMap(_ => Future(blocking(handler.project(fixed)))))
  }
  private def consume(pid: String): Future[${n.catchUpResult.identifier}] = {
    def loop(after: Long): Future[${n.catchUpResult.identifier}] = safely(source.currentEvents(pid, after, ${p.pageSize})).flatMap { page =>
      require(page != null && page.size <= ${p.pageSize}, "oversized or null event page")
      if (page.isEmpty) Future.successful(${n.catchUpResult.identifier}(pid, after, after))
      else {
        var expected = after
        val fixed = page.map { envelope =>
          require(envelope != null && envelope.pid == pid, "foreign PID or null source event")
          expected = Math.addExact(expected, 1L)
          require(envelope.sequenceNr == expected, "source page gap/duplicate/non-progress")
          ${n.envelope.identifier}.capture(envelope.pid, envelope.resource, envelope.sequenceNr, envelope.manifest, envelope.bytes)
        }
        val projected = fixed.foldLeft(Future.successful(())) { (previous, envelope) =>
          previous.flatMap(_ => Future(blocking { handler.project(envelope); () }))
        }
        projected.flatMap(_ => loop(fixed.last.sequenceNr))
      }
    }
    initialized().flatMap(_ => Future(blocking(repository.lastSequenceNr(pid)))).flatMap(loop)
  }
  def catchUp(pid: String): Future[${n.catchUpResult.identifier}] = {
    ${n.envelope.identifier}.identity(pid)
    gate.synchronized {
      if (closed) Future.failed(new IllegalStateException("runner is closed"))
      else catchUps.getOrElse(pid, admit(consume(pid),
        (future: Future[${n.catchUpResult.identifier}]) => { catchUps.put(pid, future); () },
        () => { catchUps.remove(pid); () }))
    }
  }
  // A discovery operation already owns admission. Its single sequential child
  // shares the same PID future with public catchUp without re-admission or an
  // extra unbounded queue. The parent cannot settle until this child settles.
  private def discoveredCatchUp(pid: String): Future[${n.catchUpResult.identifier}] = gate.synchronized {
    catchUps.getOrElse(pid, {
      val promise = Promise[${n.catchUpResult.identifier}]()
      catchUps.put(pid, promise.future)
      safely(consume(pid)).onComplete { result => gate.synchronized {
        catchUps.remove(pid)
        result.failed.foreach(observe)
        promise.tryComplete(result)
      }}(ExecutionContext.parasitic)
      promise.future
    })
  }
  private def discover(after: Option[String]): Future[Done] = safely(source.persistenceIds(after, ${p.pageSize})).flatMap { page =>
    require(page != null && page.size <= ${p.pageSize}, "oversized or null discovery page")
    var previous = after
    page.foreach { pid =>
      ${n.envelope.identifier}.identity(pid)
      require(previous.forall(_ < pid), "discovery duplicate/out-of-order/non-progress")
      previous = Some(pid)
    }
    if (page.isEmpty) Future.successful(Done)
    else page.foldLeft(Future.successful(())) { (before, pid) =>
      before.flatMap(_ => discoveredCatchUp(pid).map(_ => ()))
    }.flatMap(_ => discover(Some(page.last)))
  }
  private def schedulePoll(): Unit = gate.synchronized {
    if (!closed && pollTimer.isEmpty) pollTimer = Some(system.scheduler.scheduleOnce(${p.pollIntervalMillis}.millis, new Runnable {
      override def run(): Unit = gate.synchronized {
        pollTimer = None
        if (!closed) {
          val result = admit(initialized().flatMap(_ => discover(None)))
          result.onComplete {
            case Success(_) => schedulePoll()
            case Failure(error) => observe(error)
          }(ExecutionContext.parasitic)
        }
      }
    })(system.executionContext))
  }
  def start(): Future[Done] = gate.synchronized {
    startResult.getOrElse {
      val result = admit(initialized().flatMap(_ => discover(None)))
      startResult = Some(result)
      result.onComplete {
        case Success(_) => schedulePoll()
        case Failure(error) => observe(error)
      }(ExecutionContext.parasitic)
      result
    }
  }
  def shutdown(): Future[${n.shutdownResult.identifier}] = gate.synchronized {
    shutdownResult.getOrElse {
      val promise = Promise[${n.shutdownResult.identifier}]()
      shutdownResult = Some(promise)
      closed = true
      pollTimer.foreach(_.cancel()); pollTimer = None
      finishShutdown()
      if (!promise.isCompleted) shutdownTimer = Some(system.scheduler.scheduleOnce(${p.closeTimeoutMillis}.millis, new Runnable {
        override def run(): Unit = gate.synchronized {
          if (!promise.isCompleted) {
            observe(new java.util.concurrent.TimeoutException("readside shutdown drain timed out"))
            promise.trySuccess(${n.shutdownResult.identifier}(drained = false, accepted, completed, firstFailure, timedOut = true))
          }
        }
      })(system.executionContext))
      promise
    }.future
  }
}
`, [m.product.store.bindingSource, m.product.source]);
}
