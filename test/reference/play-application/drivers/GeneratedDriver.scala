package example.inventory.playreference.oracle

import example.inventory.composition.{WarehouseComponents, WarehouseSettings}
import example.inventory.extensions.{ConfiguredWarehouseAuthority, ReservationIdentity}
import example.inventory.application.api.WarehouseApi._
import play.api.{Application, ApplicationLoader, Configuration, Environment, Mode}
import java.nio.file.Path
import scala.concurrent.Future

final class GeneratedDriver extends OracleDriver {
  def open(data: Path, phase: String, mode: String): OracleApplication = {
    val settings = WarehouseSettings(data.resolve("journal"), data.resolve(if (phase == "fresh") "new-readside" else "readside"),
      "warehouse-app-v1", phase == "write", phase != "reopen")
    val authority = new ConfiguredWarehouseAuthority(Vector(
      Configuration("token" -> "local-operator-token-0000000001", "csrf" -> "local-csrf-token-0000000000001", "id" -> "operator", "roles" -> Seq("operator"), "resources" -> Seq("east", "west")),
      Configuration("token" -> "local-reader-token-00000000001", "csrf" -> "local-csrf-token-0000000000001", "id" -> "reader", "roles" -> Seq("reader"), "resources" -> Seq("east"))))
    val context = ApplicationLoader.createContext(new Environment(data.toFile, getClass.getClassLoader, Mode.Test), initialSettings = Map(
      "play.http.secret.key" -> "independent-oracle-local-only-secret", "akka.actor.provider" -> "local"))
    val invocations = new java.util.concurrent.atomic.AtomicInteger()
    val components = new WarehouseComponents(context, settings, FaultFixtures.computations(new ReservationIdentity, mode, invocations),
      FaultFixtures.authority(authority, mode))
    new OracleApplication {
      implicit private val ec = components.executionContext
      val application: Application = components.application
      val ready = components.service.ready
      def persistenceIds = components.service.source.persistenceIds(None, 64)
      def sequences(pid: String) = components.service.source.currentEvents(pid, 0L, 64).map(_.map(_.sequenceNr))
      private lazy val closed = components.service.close().map(_.drained)
      def close(): Future[Boolean] = closed
      def terminated = components.actorSystem.whenTerminated.map(_ => ())(scala.concurrent.ExecutionContext.parasitic)
      def accepting = components.service.accepting
      def hold(release: Future[Unit]): Future[Boolean] = components.service.admit(release.map(_ => Right(()): Outcome[Unit])).map(_.isRight)
      def failSource(): Future[Unit] = components.service.source.close().flatMap(_ => components.service.runner.failure.map(_ => ()))
      def commandInvocations = invocations.get()
    }
  }
  def validateStorage(journal: Path, readside: Path, freshJournal: Boolean, freshReadside: Boolean): Unit =
    WarehouseSettings(journal, readside, "warehouse-app-v1", freshJournal, freshReadside).validate()
  def rejectInitialization(data: Path): Unit = {
    val context = ApplicationLoader.createContext(new Environment(data.toFile, getClass.getClassLoader, Mode.Test), initialSettings = Map(
      "play.http.secret.key" -> "independent-oracle-local-only-secret", "akka.actor.provider" -> "local"))
    val settings = WarehouseSettings(data.resolve("journal"), data.resolve("readside"), "界" * 100, true, true)
    val authority = new ConfiguredWarehouseAuthority(Vector(Configuration("token" -> "local-operator-token-0000000001",
      "csrf" -> "local-csrf-token-0000000000001", "id" -> "operator", "roles" -> Seq("operator"), "resources" -> Seq("east"))))
    val failure = scala.util.Try(new WarehouseComponents(context, settings, new ReservationIdentity, authority)).failed.get
    assert(failure.isInstanceOf[IllegalArgumentException] && failure.getCause != null, "initialization-failure-preserved")
    assert(failure.getCause.getMessage.contains("identity"), "partial-initialization-rejection")
  }
}
