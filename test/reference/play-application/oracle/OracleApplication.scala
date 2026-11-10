package example.inventory.playreference.oracle

import java.nio.file.Path
import play.api.Application
import scala.concurrent.Future

trait OracleApplication {
  def application: Application
  def ready: Future[Unit]
  def persistenceIds: Future[Vector[String]]
  def sequences(pid: String): Future[Vector[Long]]
  def close(): Future[Boolean]
  def terminated: Future[Unit]
  def accepting: Boolean
  def hold(release: Future[Unit]): Future[Boolean]
  def failSource(): Future[Unit]
  def commandInvocations: Int
}
trait OracleDriver {
  def open(data: Path, phase: String, mode: String = "normal"): OracleApplication
  def rejectInitialization(data: Path): Unit
  def validateStorage(journal: Path, readside: Path, freshJournal: Boolean, freshReadside: Boolean): Unit
}
