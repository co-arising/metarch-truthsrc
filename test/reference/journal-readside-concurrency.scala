package example.tickets.infrastructure.projection

import akka.NotUsed
import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import akka.stream.scaladsl.Source
import com.typesafe.config.ConfigFactory
import org.h2.jdbcx.JdbcDataSource
import org.scalatest.funsuite.AnyFunSuite
import scala.collection.mutable
import scala.concurrent.{Await, ExecutionContext, Future, Promise}
import scala.concurrent.duration._

// All projection Future continuations are driven explicitly; no sleep, timer race,
// patched production method or mock SQL. Akka is real, local and owned by each test.
private[projection] final class ConcurrencyExecutor extends ExecutionContext {
  private val queue = mutable.Queue.empty[Runnable]
  def execute(runnable: Runnable): Unit = synchronized { queue.enqueue(runnable) }
  def reportFailure(error: Throwable): Unit = throw new AssertionError("executor failure", error)
  def pending: Int = synchronized { queue.size }
  def step(): Boolean = {
    val work = synchronized { if (queue.isEmpty) None else Some(queue.dequeue()) }
    work.foreach(_.run())
    work.nonEmpty
  }
  def drain(): Unit = {
    var count = 0
    while (step()) {
      count += 1
      require(count <= 10000, "unbounded projection continuation loop")
    }
  }
}

// Only connection acquisition is fault-injected. Successful operations execute the
// unmodified repository SQL on real H2, including failed-sample invalidation.
private[projection] final class ConcurrencyDataSource(delegate: javax.sql.DataSource) extends javax.sql.DataSource {
  private val failures = mutable.Queue.empty[Throwable]
  var connections = 0
  def failNext(errors: Throwable*): Unit = failures.enqueueAll(errors)
  private def acquire(open: => java.sql.Connection): java.sql.Connection = {
    connections += 1
    if (failures.nonEmpty) throw failures.dequeue()
    open
  }
  def getConnection(): java.sql.Connection = acquire(delegate.getConnection())
  def getConnection(user: String, password: String): java.sql.Connection = acquire(delegate.getConnection(user, password))
  def getLogWriter(): java.io.PrintWriter = delegate.getLogWriter()
  def setLogWriter(writer: java.io.PrintWriter): Unit = delegate.setLogWriter(writer)
  def getLoginTimeout(): Int = delegate.getLoginTimeout()
  def setLoginTimeout(seconds: Int): Unit = delegate.setLoginTimeout(seconds)
  def getParentLogger(): java.util.logging.Logger = delegate.getParentLogger()
  def unwrap[T](kind: Class[T]): T = delegate.unwrap(kind)
  def isWrapperFor(kind: Class[_]): Boolean = delegate.isWrapperFor(kind)
}

private[projection] final class ConcurrencyJournal(val namespace: String) extends TicketReadsideProjection.Journal {
  import TicketReadsideProjection.Envelope
  final case class Sample(pid: String, after: Long, reply: Promise[Vector[Envelope]])
  val samples = mutable.ArrayBuffer.empty[Sample]
  var throwNext = false
  def persistenceIds(): Source[String, NotUsed] = Source.empty
  def events(pid: String, after: Long): Source[Envelope, NotUsed] = Source.empty
  def currentEvents(pid: String, after: Long): Future[Vector[Envelope]] = {
    if (throwNext) { throwNext = false; throw new IllegalStateException("synchronous journal failure") }
    val sample = Sample(pid, after, Promise[Vector[Envelope]]())
    samples += sample
    sample.reply.future
  }
  def release(): Unit = samples.foreach(_.reply.trySuccess(Vector.empty))
}

private[projection] final class ConcurrencyFixture {
  import TicketReadsideProjection.Envelope
  import TicketReadsideRepository.{Row, State}
  implicit val ec: ConcurrencyExecutor = new ConcurrencyExecutor
  implicit val system: ActorSystem[Nothing] = ActorSystem[Nothing](Behaviors.empty[Nothing], "concurrency-" + java.util.UUID.randomUUID().toString,
    ConfigFactory.parseString("""
      akka.actor.provider = local
      akka.loglevel = OFF
      akka.stdout-loglevel = OFF
      akka.coordinated-shutdown.run-by-jvm-shutdown-hook = off
      akka.jvm-shutdown-hooks = off
    """))
  private val h2 = new JdbcDataSource
  h2.setURL("jdbc:h2:mem:" + java.util.UUID.randomUUID().toString + ";MODE=MySQL;DB_CLOSE_ON_EXIT=FALSE")
  private val anchor = h2.getConnection
  val ds = new ConcurrencyDataSource(h2)
  val namespace = "owned-concurrency"
  val repository = new TicketReadsideRepository(namespace, ds)
  var folds = 0
  var identities = 0
  val bindings = new TicketReadsideProjection.Bindings {
    def identity(pid: String): (String, String) = {
      identities += 1
      if (pid.startsWith("booking|")) "booking" -> pid.stripPrefix("booking|") else "foreign" -> pid
    }
    def fold(row: Row, event: Any): State = { folds += 1; State(Some(event.asInstanceOf[String].getBytes("UTF-8")), None, None) }
    def indexes(session: TicketReadsideRepository#Session, row: Row): Unit = ()
  }
  private val owned = mutable.ArrayBuffer.empty[(ConcurrencyJournal, TicketReadsideProjection, Option[Throwable])]
  def another(dataSource: javax.sql.DataSource = ds, shutdownFailure: Option[Throwable] = None): (ConcurrencyJournal, TicketReadsideProjection) = {
    val journal = new ConcurrencyJournal(namespace)
    val projection = new TicketReadsideProjection(journal, bindings, dataSource)
    owned += ((journal, projection, shutdownFailure))
    journal -> projection
  }
  val (journal, projection) = another()
  val pid = "booking|one"
  def done[A](future: Future[A]): A = { ec.drain(); future.value.getOrElse(throw new AssertionError("future is not settled")).get }
  def failed(future: Future[_]): Throwable = {
    ec.drain()
    future.value.getOrElse(throw new AssertionError("failure is not settled")).failed.get
  }
  def row: Row = repository.read(_.row(pid).get)
  def append(sequence: Long, value: String): Unit = done(projection.project(Envelope(pid, sequence, value)))
  def observe(): Unit = {
    val pending = projection.catchUp(pid); ec.drain()
    journal.samples.last.reply.success(Vector.empty)
    done(pending)
  }
  done(projection.initialize())
  def close(): Unit = {
    try {
      owned.foreach(_._1.release()); ec.drain()
      val shutdowns = owned.map { case (_, projection, expected) => projection.shutdown() -> expected }; ec.drain()
      shutdowns.foreach {
        case (future, Some(error)) => assert(failed(future) eq error, "failed initialization must retain its shutdown failure contract")
        case (future, None) => done(future)
      }
      assert(!system.whenTerminated.isCompleted, "projection must not terminate caller actor runtime")
      assert(!anchor.isClosed, "projection must not close caller JDBC resource")
    } finally {
      anchor.close()
      system.terminate()
      Await.result(system.whenTerminated, 10.seconds)
    }
  }
}

private[projection] abstract class ConcurrencySpec extends AnyFunSuite {
  def withFixture(body: ConcurrencyFixture => Unit): Unit = {
    val fixture = new ConcurrencyFixture
    try body(fixture) finally fixture.close()
  }
}

final class OverlapSpec extends ConcurrencySpec {
  test("same PID catchups share one in-flight sample and different PIDs proceed") {
    withFixture { f =>
      val first = f.projection.catchUp(f.pid)
      f.ec.drain() // first currentEvents is suspended on its Promise
      val second = f.projection.catchUp(f.pid)
      val third = f.projection.catchUp(f.pid)
      val other = f.projection.catchUp("booking|two")
      f.ec.drain() // models later asynchronous scheduler ticks while first is pending
      val samePidSamples = f.journal.samples.count(_.pid == f.pid)
      assert(f.journal.samples.exists(_.pid == "booking|two"), "different PID must proceed independently")
      f.journal.release()
      Seq(first, second, third, other).foreach(f.done(_))
      assert(f.row.observed.contains(0L))
      val next = f.projection.catchUp(f.pid); f.ec.drain()
      assert(!next.isCompleted, "successful completion must remove in-flight entry")
      f.journal.samples.last.reply.success(Vector.empty); f.done(next)
      println("CONTROLLED_OVERLAP samePidSamples=" + samePidSamples + " sharedFuture=" + ((first eq second) && (second eq third)))
      assert((first eq second) && (second eq third), "same PID must share the in-flight Future")
      assert(samePidSamples == 1, "same PID must issue one journal sample")
    }
  }
}

final class ObservationSpec extends ConcurrencySpec {
  test("late successful low observation preserves a newer valid frontier") {
    withFixture { f =>
      f.append(1L, "one")
      val low = f.projection.catchUp(f.pid); f.ec.drain()
      assert(f.journal.samples.last.after == 1L)
      f.append(2L, "two")
      // Independent owner of the same namespace establishes the higher sample.
      // Coalescing is deliberately per projection, not a global SQL/locking redesign.
      val (higherJournal, higherProjection) = f.another()
      val high = higherProjection.catchUp(f.pid); f.ec.drain()
      assert(higherJournal.samples.last.after == 2L)
      higherJournal.samples.last.reply.success(Vector.empty); f.done(high)
      assert(f.row.last == 2L && f.row.observed.contains(2L))
      f.journal.samples.last.reply.success(Vector.empty); f.done(low)
      println("LATE_SAMPLE last=" + f.row.last + " observed=" + f.row.observed)
      assert(f.row.last == 2L && f.row.observed.contains(2L), "late successful observation must preserve frontier 2")
    }
  }
}

final class FailureInvalidationSpec extends ConcurrencySpec {
  test("one failed shared sample invalidates prior freshness before retry is admitted") {
    withFixture { f =>
      f.append(1L, "one"); f.observe()
      val first = f.projection.catchUp(f.pid); f.ec.drain()
      val joined = f.projection.catchUp(f.pid); f.ec.drain()
      f.journal.samples.foreach(_.reply.tryFailure(new IllegalStateException("freshness failure")))
      assert(f.failed(first).getMessage == "freshness failure")
      assert(f.failed(joined).getMessage == "freshness failure")
      val afterFailure = f.row.observed
      f.observe()
      assert(f.row.observed.contains(1L), "retry must establish a fresh observation")
      assert(afterFailure.isEmpty, "failed sample must invalidate prior freshness")
    }
  }
}

final class LifecycleSpec extends ConcurrencySpec {
  test("append and explicit invalidation still clear freshness and stale success cannot restore it") {
    withFixture { f =>
      f.append(1L, "one"); f.observe()
      assert(f.row.observed.contains(1L))
      f.append(2L, "two")
      assert(f.row.observed.isEmpty)
      f.repository.write(_.observe(f.pid, 1L))
      assert(f.row.observed.isEmpty)
      f.observe(); assert(f.row.observed.contains(2L))
      f.repository.write(_.invalidate(f.pid))
      f.repository.write(_.observe(f.pid, 1L))
      assert(f.row.observed.isEmpty)
      intercept[IllegalArgumentException](f.repository.write(_.observe(f.pid, 3L)))
      assert(f.row.last == 2L && f.row.observed.isEmpty)
    }
  }
  test("watch-style replay keeps exact duplicate verification and rejects conflicting bytes") {
    withFixture { f =>
      f.append(1L, "one"); f.observe()
      f.append(1L, "one") // watch starts at zero: duplicate still checks the serialized body
      assert(f.folds == 1 && f.row.observed.contains(1L))
      val error = f.failed(f.projection.project(TicketReadsideProjection.Envelope(f.pid, 1L, "different")))
      assert(error.getMessage.contains("conflicting journal sequence/payload"))
      assert(f.folds == 1 && f.row.last == 1L && f.row.observed.contains(1L))
    }
  }
  test("failed journal sample releases all joiners and permits retry") {
    withFixture { f =>
      f.append(1L, "one")
      val first = f.projection.catchUp(f.pid); f.ec.drain()
      val joined = f.projection.catchUp(f.pid); f.ec.drain()
      f.journal.samples.foreach(_.reply.tryFailure(new IllegalStateException("sample failure")))
      assert(f.failed(first).getMessage == "sample failure")
      assert(f.failed(joined).getMessage == "sample failure")
      assert(f.row.observed.isEmpty)
      val count = f.journal.samples.size
      val retry = f.projection.catchUp(f.pid); f.ec.drain()
      assert(f.journal.samples.size == count + 1)
      f.journal.samples.last.reply.success(Vector.empty); f.done(retry)
      assert(f.row.observed.contains(1L))
    }
  }
  test("synchronous failures cannot leave a poisoned in-flight entry") {
    withFixture { f =>
      val identities = f.identities
      val firstBad = f.projection.catchUp("bad")
      assert(f.failed(firstBad).getMessage.contains("unrecognized persistence kind"))
      val secondBad = f.projection.catchUp("bad")
      assert(f.failed(secondBad).getMessage.contains("unrecognized persistence kind"))
      assert(firstBad ne secondBad, "invalid identity retry must not reuse a poisoned in-flight Future")
      assert(f.identities == identities + 2, "invalid identity retry must re-evaluate identity")
      assert(f.repository.read(_.row("bad")).isEmpty)
      f.journal.throwNext = true
      assert(f.failed(f.projection.catchUp(f.pid)).getMessage == "synchronous journal failure")
      val retry = f.projection.catchUp(f.pid); f.ec.drain()
      f.journal.samples.last.reply.success(Vector.empty); f.done(retry)
      assert(f.row.last == 0L && f.row.observed.contains(0L))
    }
  }
  test("shutdown drains the accepted shared sample rejects new joins and clears final observation") {
    withFixture { f =>
      f.append(1L, "one"); f.observe()
      val pending = f.projection.catchUp(f.pid); f.ec.drain()
      val joined = f.projection.catchUp(f.pid); f.ec.drain()
      val shutdown = f.projection.shutdown(); f.ec.drain()
      assert(shutdown eq f.projection.shutdown())
      assert(!shutdown.isCompleted, "shutdown cannot finish before accepted sample")
      assert(f.failed(f.projection.catchUp(f.pid)).getMessage.contains("readside is closed"))
      f.journal.release(); f.done(pending); f.done(joined); f.done(shutdown)
      assert(f.row.last == 1L && f.row.observed.isEmpty)
      assert(!f.system.whenTerminated.isCompleted)
    }
  }
}

// Kept separate from LifecycleSpec: the historical baseline did not invalidate a
// failed catchUp at all, so its old drain-all assertion was not this boundary proof.
final class CleanupBoundarySpec extends ConcurrencySpec {
  test("shutdown and all joiners remain pending until failed sample cleanup runs") {
    withFixture { f =>
      f.append(1L, "one"); f.observe()
      val pending = f.projection.catchUp(f.pid); f.ec.drain()
      val joined = f.projection.catchUp(f.pid); f.ec.drain()
      assert(pending eq joined)
      val shutdown = f.projection.shutdown(); f.ec.drain()
      assert(!shutdown.isCompleted)
      val beforeCleanup = f.ds.connections
      val error = new IllegalStateException("drain failure")
      f.journal.samples.last.reply.failure(error)
      // The failed journal continuation propagates to recoverWith; recoverWith
      // queues the JDBC invalidation. Stop before that Future body is executed.
      assert(f.ec.step(), "failed journal continuation must be queued")
      assert(f.ec.step(), "failed sample recovery must be queued")
      assert(f.ec.pending == 1, "exactly the cleanup continuation must remain queued")
      assert(f.ds.connections == beforeCleanup, "failure cleanup JDBC must not have run")
      assert(!pending.isCompleted && !joined.isCompleted, "joiners must remain pending before failure cleanup")
      assert(!shutdown.isCompleted, "shutdown must remain pending before failure cleanup")
      assert(f.row.observed.contains(1L), "freshness must still be present at the cleanup boundary")
      val atBoundary = f.ds.connections // the assertion above used its own real read
      assert(f.ec.step(), "failure cleanup must be queued")
      assert(f.ds.connections == atBoundary + 1, "one real JDBC cleanup must execute")
      assert(f.row.observed.isEmpty, "failure cleanup must invalidate before joiners settle")
      assert(!shutdown.isCompleted, "shutdown finalization must still await cleanup continuations")
      assert(f.failed(pending) eq error)
      assert(f.failed(joined) eq error)
      f.done(shutdown)
      assert(f.row.observed.isEmpty)
      assert(!f.system.whenTerminated.isCompleted)
      println("CLEANUP_BOUNDARY joinersPending=true shutdownPending=true cleanupRan=false thenInvalidated=true")
    }
  }
}

final class ErrorPreservationSpec extends ConcurrencySpec {
  test("initialization and cleanup failure retain the original exception and suppress cleanup") {
    withFixture { f =>
      val original = new java.sql.SQLException("injected initialization failure")
      val cleanup = new java.sql.SQLException("injected cleanup failure")
      val ds = new ConcurrencyDataSource(f.ds)
      ds.failNext(original, cleanup)
      val (journal, projection) = f.another(ds, Some(original))
      val ready = projection.initialize()
      assert(ready eq projection.initialize(), "initialization Future must be cached")
      val pending = projection.catchUp(f.pid)
      val joined = projection.catchUp(f.pid)
      val caught = f.failed(pending)
      assert(caught eq original, "catchUp must retain original initialization exception identity when cleanup fails")
      assert(f.failed(joined) eq original)
      assert(original.getSuppressed.toVector == Vector(cleanup), "exact cleanup exception must be suppressed on the original")
      assert(ds.connections == 2, "initialization and cleanup must both be attempted")
      assert(f.failed(ready) eq original)
      assert(ready eq projection.initialize(), "failed initialization Future must remain cached")
      val retry = projection.catchUp(f.pid)
      assert(retry ne pending, "catchUp failure must release the per-PID entry")
      assert(f.failed(retry) eq original, "retry must not replace the failed initialization contract")
      assert(ds.connections == 3, "retry must perform cleanup only, not retry initialization")
      assert(original.getSuppressed.toVector == Vector(cleanup))
      assert(journal.samples.isEmpty, "failed initialization must prevent journal sampling")
      assert(f.failed(projection.shutdown()) eq original)
      println("ERROR_PRESERVATION originalIdentity=true cleanupSuppressed=true initializedFutureCached=true")
    }
  }
  test("the same initialization and cleanup exception is never self-suppressed") {
    withFixture { f =>
      val original = new java.sql.SQLException("shared injected JDBC failure")
      val ds = new ConcurrencyDataSource(f.ds)
      ds.failNext(original, original)
      val (journal, projection) = f.another(ds, Some(original))
      val ready = projection.initialize()
      assert(f.failed(projection.catchUp(f.pid)) eq original, "self-cleanup must retain original exception identity")
      assert(original.getSuppressed.isEmpty, "the original exception must not suppress itself")
      assert(ds.connections == 2)
      assert(ready eq projection.initialize())
      assert(f.failed(ready) eq original)
      assert(journal.samples.isEmpty)
      assert(f.failed(projection.shutdown()) eq original)
    }
  }
}
