export function sourceTemplate(m, out) {
  const n = m.names, p = m.persistence.names;
  out.append(`package ${n.journalSource.package}

import akka.actor.typed.ActorSystem
import akka.persistence.query.PersistenceQuery
import akka.persistence.query.journal.leveldb.scaladsl.LeveldbReadJournal
import akka.serialization.SerializationExtension
import akka.stream.{KillSwitches, Materializer, SystemMaterializer}
import akka.stream.scaladsl.{Sink, Source}
import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._
import scala.util.control.NonFatal

final class ${n.journalSource.identifier}(system: ActorSystem[_], directory: ${n.directory.identifier}) extends ${p.source.fqn} {
  require(system != null && directory != null)
  private implicit val ec: ExecutionContext = system.executionContext
  private implicit val materializer: Materializer = SystemMaterializer(system).materializer
  private val journal = PersistenceQuery(system).readJournalFor[LeveldbReadJournal](LeveldbReadJournal.Identifier)
  private val serialization = SerializationExtension(system)
  private val registered = serialization.serializerFor(classOf[${p.frame.fqn}])
  require(registered.getClass == classOf[${p.serializer.fqn}] && registered.identifier == ${p.persistence.fqn}.serializerId, "registered serializer required")
  private val switch = KillSwitches.shared("application-journal-source")
  private var closed = false
  private var active = 0
  private val stopped = Promise[Unit]()
  private def read[A](source: => Source[A, _]): Future[Vector[A]] = synchronized {
    if (closed) return Future.failed(new IllegalStateException("source closed"))
    active += 1
    val result = try source.via(switch.flow).completionTimeout(5000.millis).runWith(Sink.seq).map(_.toVector)
      catch { case NonFatal(error) => Future.failed(error) }
    result.onComplete { _ => synchronized { active -= 1; if (closed && active == 0) stopped.trySuccess(()) } }(ExecutionContext.parasitic)
    result
  }
  override def persistenceIds(after: Option[String], limit: Int): Future[Vector[String]] = {
    require(after != null && limit >= 1 && limit <= ${m.persistence.product.store.pageSize})
    read(journal.currentPersistenceIds().take(directory.bindings.size + 1L)).map { ids =>
      require(ids.size <= directory.bindings.size && ids.distinct.size == ids.size && ids.forall(pid => directory.byPid(pid).isDefined), "unregistered journal PID")
      ids.sorted.filter(pid => after.forall(pid > _)).take(limit)
    }
  }
  override def currentEvents(pid: String, after: Long, limit: Int): Future[Vector[${p.envelope.fqn}]] = {
    require(pid != null && after >= 0L && limit >= 1 && limit <= ${m.persistence.product.store.pageSize})
    val binding = directory.byPid(pid).getOrElse(throw new IllegalArgumentException("unknown PID"))
    if (after == Long.MaxValue) return read(Source.empty[${p.envelope.fqn}])
    read(journal.currentEventsByPersistenceId(pid, after + 1L, Long.MaxValue).take(limit.toLong).map { row =>
      require(row.persistenceId == pid && row.sequenceNr > after, "journal envelope identity")
      val frame = row.event match { case value: ${p.frame.fqn} => value; case _ => throw new IllegalArgumentException("journal Frame required") }
      ${p.persistence.fqn}.validate(frame)
      require(frame.role == "event", "event Frame required")
      val serializer = serialization.findSerializerFor(frame)
      require(serializer.getClass == classOf[${p.serializer.fqn}] && serializer.identifier == ${p.persistence.fqn}.serializerId, "registered serializer required")
      val bytes = serialization.serialize(frame).get
      ${p.envelope.fqn}.capture(pid, binding.envelopeResource, row.sequenceNr, ${p.persistence.fqn}.manifest(frame), bytes)
    })
  }
  def close(): Future[Unit] = synchronized {
    if (!closed) { closed = true; switch.abort(new IllegalStateException("source closed")); if (active == 0) stopped.trySuccess(()) }
    stopped.future
  }
}
`, [m.composition.source, m.persistence.product.source, m.persistence.product.wire.source]);
}
