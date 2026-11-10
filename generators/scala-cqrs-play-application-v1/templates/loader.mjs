import { q } from './syntax.mjs';

export function loaderTemplate(m, out) {
  const n = m.names, implementations = m.composition.implementations;
  const host = implementations.find(i => i.role === 'computations'), authority = implementations.find(i => i.role === 'authority');
  const config = m.composition.config;
  out.append(`package ${n.loader.package}

import akka.actor.typed.scaladsl.adapter._
import play.api.{Application, ApplicationLoader, BuiltInComponentsFromContext, Configuration}
import play.api.mvc.EssentialFilter
import java.nio.file.Paths
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal

final class ${n.loader.identifier} extends ApplicationLoader {
  override def load(context: ApplicationLoader.Context): Application = {
    val config = context.initialConfiguration
    val settings = ${n.settings.identifier}(Paths.get(config.get[String](${q(config.journalPath)})), Paths.get(config.get[String](${q(config.readsidePath)})),
      config.get[String](${q(config.namespace)}), config.get[Boolean](${q(config.freshJournal)}), config.get[Boolean](${q(config.freshReadside)}))
    settings.validate()
    val authority = new ${authority.symbol}(config.get[Seq[Configuration]](${q(config.credentials)}).toVector)
    val components = new ${n.components.identifier}(context, settings, new ${host.symbol}, authority)
    try components.application
    catch { case NonFatal(error) => components.initializationFailed(error) }
  }
}
`, [m.composition.source, host.source, authority.source]);
}
export function componentsTemplate(m, out) {
  const n = m.names;
  out.append(`package ${n.components.package}

import akka.actor.typed.scaladsl.adapter._
import play.api.{ApplicationLoader, BuiltInComponentsFromContext}
import play.api.mvc.EssentialFilter
import scala.concurrent.{Await, ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.control.NonFatal

final class ${n.components.identifier}(context: ApplicationLoader.Context, settings: ${n.settings.identifier},
    hosts: ${m.persistence.aggregate.base.computations.fqn}, authority: ${n.authority.fqn}) extends BuiltInComponentsFromContext(context) {
  private implicit val ec: ExecutionContext = executionContext
  override lazy val httpFilters = Seq.empty[EssentialFilter]
  override lazy val httpErrorHandler = new ${n.errors.fqn}
  def initializationFailed(error: Throwable): Nothing = {
    val end = ${m.composition.limits.closeMillis + 1000}.millis.fromNow
    def cleanup(work: => Future[_]): Unit = try { Await.result(work, end.timeLeft.max(1.millis)); () }
      catch { case NonFatal(failure) => error.addSuppressed(failure) }
    cleanup(applicationLifecycle.stop())
    cleanup(actorSystem.terminate())
    throw new IllegalArgumentException("application initialization failed", error)
  }
  val service = try ${n.application.identifier}.open(settings, hosts, authority, actorSystem.toTyped)
    catch { case NonFatal(error) => initializationFailed(error) }
  applicationLifecycle.addStopHook(() => service.close().flatMap { report =>
    if (report.drained) Future.successful(()) else Future.failed(new IllegalStateException("application close incomplete"))
  })
  override lazy val router = new _root_.router.Routes(httpErrorHandler, new ${n.controller.fqn}(controllerComponents, service))
}
`, [m.composition.source, m.api.source]);
}
export function configTemplate(m, out) {
  out.append(`play.application.loader = ${q(m.names.loader.fqn)}
play.http.secret.key = \${?PLAY_SECRET}
# Explicit local paths and credentials are required at application startup.
${m.composition.config.journalPath} = \${?APPLICATION_JOURNAL_PATH}
${m.composition.config.readsidePath} = \${?APPLICATION_READSIDE_PATH}
${m.composition.config.namespace} = \${?APPLICATION_NAMESPACE}
${m.composition.config.freshJournal} = false
${m.composition.config.freshReadside} = false
`, [m.composition.source]);
}
