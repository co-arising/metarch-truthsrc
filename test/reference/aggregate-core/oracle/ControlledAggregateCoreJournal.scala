package example.inventory.aggregatecore.reference

import akka.persistence.{AtomicWrite, PersistentRepr}
import akka.persistence.journal.AsyncWriteJournal
import java.util.concurrent.LinkedBlockingQueue
import scala.concurrent.{Future, Promise}
import scala.util.Try

object ControlledAggregateCoreJournal {
  final case class Pending(
    events: Vector[Any],
    persistenceIds: Vector[String],
    completion: Promise[Seq[Try[Unit]]],
    batches: Int
  )
  val writes = new LinkedBlockingQueue[Pending]()
}

// Controls journal acknowledgement only. No durability, read replay, database
// or cross-JVM recovery is claimed by this deliberately empty journal.
final class ControlledAggregateCoreJournal extends AsyncWriteJournal {
  override def asyncWriteMessages(messages: Seq[AtomicWrite]): Future[Seq[Try[Unit]]] = {
    val completion = Promise[Seq[Try[Unit]]]()
    ControlledAggregateCoreJournal.writes.put(ControlledAggregateCoreJournal.Pending(
      messages.flatMap(_.payload.map(_.payload)).toVector,
      messages.flatMap(_.payload.map(_.persistenceId)).toVector,
      completion,
      messages.size
    ))
    completion.future
  }

  override def asyncDeleteMessagesTo(persistenceId: String, toSequenceNr: Long): Future[Unit] = Future.successful(())
  override def asyncReadHighestSequenceNr(persistenceId: String, fromSequenceNr: Long): Future[Long] = Future.successful(0L)
  override def asyncReplayMessages(persistenceId: String, fromSequenceNr: Long, toSequenceNr: Long,
    max: Long)(recoveryCallback: PersistentRepr => Unit): Future[Unit] = Future.successful(())
}
