package example.inventory.composition

import akka.actor.typed.scaladsl.adapter._
import example.inventory.controllers.{WarehouseController, WarehouseHttpErrors}
import example.inventory.extensions.{ConfiguredWarehouseAuthority, LocalCredential, ReservationIdentity}
import example.inventory.infrastructure.web.{ApiPrincipal, ResourceBinding, WarehouseAuthority}
import play.api.{Application, ApplicationLoader, BuiltInComponentsFromContext, Configuration}
import play.api.mvc.EssentialFilter
import java.nio.file.Paths
import scala.concurrent.{Await, ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.control.NonFatal

final class WarehouseComponents(context: ApplicationLoader.Context, settings: WarehouseSettings, authority: WarehouseAuthority,
    hosts: example.inventory.domain.ports.WarehouseComputations = new ReservationIdentity)
    extends BuiltInComponentsFromContext(context) {
  private implicit val ec: ExecutionContext = executionContext
  override lazy val httpFilters = Seq.empty[EssentialFilter]
  override lazy val httpErrorHandler = new WarehouseHttpErrors
  def initializationFailed(error: Throwable): Nothing = {
    val end = 11.seconds.fromNow
    def cleanup(work: => Future[_]): Unit = try { Await.result(work, end.timeLeft.max(1.millis)); () }
      catch { case NonFatal(failure) => error.addSuppressed(failure) }
    cleanup(applicationLifecycle.stop())
    cleanup(actorSystem.terminate())
    throw new IllegalArgumentException("warehouse initialization failed", error)
  }
  val warehouse = try WarehouseApplication.open(settings, hosts, authority, actorSystem.toTyped)
    catch { case NonFatal(error) => initializationFailed(error) }
  applicationLifecycle.addStopHook(() => warehouse.close().flatMap { report =>
    if (report.drained) Future.successful(()) else Future.failed(new IllegalStateException("warehouse close incomplete"))
  })
  override lazy val router = new _root_.router.Routes(httpErrorHandler, new WarehouseController(controllerComponents, warehouse))
}
final class WarehouseLoader extends ApplicationLoader {
  override def load(context: ApplicationLoader.Context): Application = {
    val config = context.initialConfiguration
    val values = config.get[Seq[Configuration]]("warehouse.resources").map(c => ResourceBinding(
      c.get[String]("warehouseId"), c.get[String]("persistenceId"), c.get[String]("resource"))).toVector
    val settings = WarehouseSettings(Paths.get(config.get[String]("warehouse.journal")), Paths.get(config.get[String]("warehouse.readside")),
      config.get[String]("warehouse.namespace"), config.get[Boolean]("warehouse.freshJournal"), config.get[Boolean]("warehouse.freshReadside"), values)
    val credentials = config.get[Seq[Configuration]]("warehouse.credentials").map { c =>
      LocalCredential(c.get[String]("token"), c.get[String]("csrf"), ApiPrincipal(c.get[String]("id"),
        c.get[Seq[String]]("roles").toSet, c.get[Seq[String]]("resources").toSet))
    }.toVector
    settings.validate()
    val authority = new ConfiguredWarehouseAuthority(credentials)
    val components = new WarehouseComponents(context, settings, authority)
    try components.application
    catch { case NonFatal(error) => components.initializationFailed(error) }
  }
}
