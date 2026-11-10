package example.inventory.playreference.oracle

import example.inventory.composition.{WarehouseComponents, WarehouseSettings}
import example.inventory.extensions.{ConfiguredWarehouseAuthority, LocalCredential, ReservationIdentity}
import example.inventory.application.api.WarehouseApi._
import example.inventory.infrastructure.web.{ApiPrincipal, ResourceBinding}
import play.api.{Application, ApplicationLoader, Environment, Mode}
import java.nio.file.Path
import scala.concurrent.Future

final class ReferenceDriver extends OracleDriver {
  def open(data: Path, phase: String, mode: String): OracleApplication = {
    val resources = Vector(ResourceBinding("east", "warehouse-east-v1", "east"), ResourceBinding("west", "warehouse-west-v1", "west"))
    val settings = WarehouseSettings(data.resolve("journal"), data.resolve(if (phase == "fresh") "new-readside" else "readside"),
      "warehouse-app-v1", phase == "write", phase != "reopen", resources)
    val authority = new ConfiguredWarehouseAuthority(Vector(
      LocalCredential("local-operator-token-0000000001", "local-csrf-token-0000000000001", ApiPrincipal("operator", Set("operator"), Set("east", "west"))),
      LocalCredential("local-reader-token-00000000001", "local-csrf-token-0000000000001", ApiPrincipal("reader", Set("reader"), Set("east")))))
    val context = ApplicationLoader.createContext(new Environment(data.toFile, getClass.getClassLoader, Mode.Test), initialSettings = Map(
      "play.http.secret.key" -> "independent-oracle-local-only-secret", "akka.actor.provider" -> "local"))
    val invocations = new java.util.concurrent.atomic.AtomicInteger()
    val components = new WarehouseComponents(context, settings, FaultFixtures.authority(authority, mode),
      FaultFixtures.computations(new ReservationIdentity, mode, invocations))
    new OracleApplication {
      implicit private val ec = components.executionContext
      val application: Application = components.application
      val ready = components.warehouse.ready
      def persistenceIds = components.warehouse.source.persistenceIds(None, 64)
      def sequences(pid: String) = components.warehouse.source.currentEvents(pid, 0L, 64).map(_.map(_.sequenceNr))
      private lazy val closed = components.warehouse.close().map(_.drained)
      def close(): Future[Boolean] = closed
      def terminated = components.actorSystem.whenTerminated.map(_ => ())(scala.concurrent.ExecutionContext.parasitic)
      def accepting = components.warehouse.accepting
      def hold(release: Future[Unit]): Future[Boolean] = components.warehouse.admit(release.map(_ => Right(()): Outcome[Unit])).map(_.isRight)
      def failSource(): Future[Unit] = components.warehouse.source.close().flatMap(_ => components.warehouse.runner.failure.map(_ => ()))
      def commandInvocations = invocations.get()
    }
  }
  def validateStorage(journal: Path, readside: Path, freshJournal: Boolean, freshReadside: Boolean): Unit =
    WarehouseSettings(journal, readside, "warehouse-app-v1", freshJournal, freshReadside,
      Vector(ResourceBinding("east", "warehouse-east-v1", "east"))).validate()
  def rejectInitialization(data: Path): Unit = {
    val context = ApplicationLoader.createContext(new Environment(data.toFile, getClass.getClassLoader, Mode.Test), initialSettings = Map(
      "play.http.secret.key" -> "independent-oracle-local-only-secret", "akka.actor.provider" -> "local"))
    val settings = WarehouseSettings(data.resolve("journal"), data.resolve("readside"), "界" * 100, true, true,
      Vector(ResourceBinding("east", "warehouse-east-v1", "east")))
    val authority = new ConfiguredWarehouseAuthority(Vector(LocalCredential("local-operator-token-0000000001", "local-csrf-token-0000000000001",
      ApiPrincipal("operator", Set("operator"), Set("east")))))
    val failure = scala.util.Try(new WarehouseComponents(context, settings, authority)).failed.get
    assert(failure.isInstanceOf[IllegalArgumentException] && failure.getCause != null, "initialization-failure-preserved")
    assert(failure.getCause.getMessage.contains("identifier bound"), "partial-initialization-rejection")
  }
}
