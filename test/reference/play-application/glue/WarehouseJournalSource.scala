package example.inventory.infrastructure.web

import akka.actor.typed.ActorSystem
import akka.persistence.query.PersistenceQuery
import akka.persistence.query.journal.leveldb.scaladsl.LeveldbReadJournal
import akka.serialization.SerializationExtension
import akka.stream.{KillSwitches, Materializer, SystemMaterializer}
import akka.stream.scaladsl.{Sink, Source}
import example.inventory.infrastructure.persistence.{WarehousePersistence, WarehouseSerializer}
import example.inventory.infrastructure.readside.{WarehouseEnvelope, WarehouseEventSource}
import example.inventory.persistence.protobuf.Frame
import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._
import scala.util.control.NonFatal

final class WarehouseJournalSource(system: ActorSystem[_], directory: WarehouseDirectory) extends WarehouseEventSource {
  require(system != null && directory != null)
  private implicit val ec: ExecutionContext = system.executionContext
  private implicit val materializer: Materializer = SystemMaterializer(system).materializer
  private val journal = PersistenceQuery(system).readJournalFor[LeveldbReadJournal](LeveldbReadJournal.Identifier)
  private val serialization = SerializationExtension(system)
  private val registered = serialization.serializerFor(classOf[Frame])
  require(registered.getClass == classOf[WarehouseSerializer] && registered.identifier == WarehousePersistence.serializerId, "registered serializer required")
  private val switch = KillSwitches.shared("warehouse-journal-source")
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
    require(after != null && limit >= 1 && limit <= 64)
    read(journal.currentPersistenceIds().take(directory.bindings.size + 1L)).map { ids =>
      require(ids.size <= directory.bindings.size && ids.distinct.size == ids.size && ids.forall(pid => directory.byPid(pid).isDefined), "unregistered journal PID")
      ids.sorted.filter(pid => after.forall(pid > _)).take(limit)
    }
  }
  override def currentEvents(pid: String, after: Long, limit: Int): Future[Vector[WarehouseEnvelope]] = {
    require(pid != null && after >= 0L && limit >= 1 && limit <= 64)
    val binding = directory.byPid(pid).getOrElse(throw new IllegalArgumentException("unknown PID"))
    if (after == Long.MaxValue) return read(Source.empty[WarehouseEnvelope])
    read(journal.currentEventsByPersistenceId(pid, after + 1L, Long.MaxValue).take(limit.toLong).map { row =>
      require(row.persistenceId == pid && row.sequenceNr > after, "journal envelope identity")
      val frame = row.event match { case value: Frame => value; case _ => throw new IllegalArgumentException("journal Frame required") }
      WarehousePersistence.validate(frame)
      require(frame.role == "event", "event Frame required")
      val serializer = serialization.findSerializerFor(frame)
      require(serializer.getClass == classOf[WarehouseSerializer] && serializer.identifier == WarehousePersistence.serializerId, "registered serializer required")
      val bytes = serialization.serialize(frame).get
      WarehouseEnvelope.capture(pid, binding.resource, row.sequenceNr, WarehousePersistence.manifest(frame), bytes)
    })
  }
  def close(): Future[Unit] = synchronized {
    if (!closed) {
      closed = true
      switch.abort(new IllegalStateException("source closed"))
      if (active == 0) stopped.trySuccess(())
    }
    stopped.future
  }
}
