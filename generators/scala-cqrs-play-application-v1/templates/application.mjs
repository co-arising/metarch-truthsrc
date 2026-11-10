import { q } from './syntax.mjs';

export function settingsTemplate(m, out) {
  const n = m.names;
  out.append(`package ${n.settings.package}

import java.nio.file.{Files, Path, Paths}

final case class ${n.settings.identifier}(journal: Path, readside: Path, namespace: String, freshJournal: Boolean, freshReadside: Boolean) {
  def validate(): Unit = {
    def location(file: Path): Unit = {
      require(file != null && file.isAbsolute && file.normalize() == file && !file.toString.exists(c => c == ';' || c == '\\\\' || Character.isISOControl(c)), "explicit local storage path")
      var current = file
      while (current != null) { require(!Files.isSymbolicLink(current), "storage symlink"); current = current.getParent }
      require(Files.isDirectory(file.getParent), "storage parent required")
    }
    location(journal); location(readside)
    require(!journal.startsWith(readside) && !readside.startsWith(journal), "storage paths overlap")
    require(namespace != null && namespace.nonEmpty && namespace.length <= 128 && !namespace.exists(Character.isISOControl))
    val readFile = Paths.get(readside.toString + ".mv.db")
    require(if (freshJournal) Files.notExists(journal) else Files.isDirectory(journal), "journal open mode mismatch")
    if (!freshJournal) {
      val current = journal.resolve("CURRENT")
      require(Files.isRegularFile(current) && !Files.isSymbolicLink(current) && Files.size(current) <= 64, "existing journal CURRENT required")
      val manifest = new String(Files.readAllBytes(current), java.nio.charset.StandardCharsets.US_ASCII)
      require(manifest.matches("MANIFEST-[0-9]+\\n"), "journal manifest reference required")
      val file = journal.resolve(manifest.dropRight(1))
      require(Files.isRegularFile(file) && !Files.isSymbolicLink(file) && Files.size(file) > 0, "existing journal manifest required")
    }
    require(if (freshReadside) Files.notExists(readFile) else Files.isRegularFile(readFile), "readside open mode mismatch")
    require(!Files.isSymbolicLink(readFile), "readside symlink")
  }
}
`, [m.composition.source]);
}
export function applicationTemplate(m, out) {
  const n = m.names, p = m.persistence, limit = m.composition.limits;
  out.append(`package ${n.application.package}

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import com.typesafe.config.{ConfigFactory, ConfigValueFactory}
import ${n.api.fqn}._
import java.util.concurrent.{Executors, ExecutorService}
import org.h2.jdbcx.JdbcConnectionPool
import scala.concurrent.{ExecutionContext, Future, Promise, blocking}
import scala.concurrent.duration._
import scala.util.{Failure => Failed, Success, Try}
import scala.util.control.NonFatal

final class ${n.application.identifier} private (val settings: ${n.settings.identifier}, val directory: ${n.directory.fqn},
    val authority: ${n.authority.fqn}, val domainSystem: ActorSystem[Nothing], private val executor: ExecutorService,
    private val pool: JdbcConnectionPool, private val repository: ${p.aggregate.repositoryImplementation.fqn}[String],
    val readside: ${p.names.repository.fqn}, val source: ${n.journalSource.fqn}, val runner: ${p.names.runner.fqn},
    val commands: ${n.commands.fqn}, val queries: ${n.queries.fqn}, lifecycleSystem: ActorSystem[_], resources: ${n.lifecycle.identifier}) {
  private implicit val ec: ExecutionContext = lifecycleSystem.executionContext
  private var readyFlag = false
  private var closing = false
  private var failure = false
  private var admitted = 0
  private val empty = Promise[Unit]()
  private var closingResult: Option[Future[${n.closeReport.identifier}]] = None
  private def safe[A](work: => Future[A]): Future[A] = try Option(work).getOrElse(Future.failed(new IllegalStateException("null Future")))
    catch { case NonFatal(error) => Future.failed(error) }
  resources.register("requests") { _ => synchronized {
    closing = true
    readyFlag = false
    if (admitted == 0) empty.trySuccess(())
    empty.future
  } }
  private val startup = runner.start().flatMap(_ => source.persistenceIds(None, ${p.product.store.pageSize})).flatMap { ids =>
    ids.foldLeft(Future.successful(()))((previous, pid) => previous.flatMap(_ => runner.catchUp(pid).map(_ => ())))
  }
  val ready: Future[Unit] = startup.transform {
    case Success(_) => synchronized {
      if (closing || failure) Failed(new IllegalStateException("application no longer starting"))
      else { readyFlag = true; Success(()) }
    }
    case Failed(error) => synchronized { failure = true; close(); Failed(error) }
  }
  runner.failure.foreach { _ => synchronized { failure = true; readyFlag = false } }
  def accepting: Boolean = synchronized { readyFlag && !closing && !failure }
  def admit[A](work: => Future[Outcome[A]]): Future[Outcome[A]] = {
    synchronized {
      if (!accepting || admitted >= ${limit.maxPending}) return Future.successful(Left(Unavailable))
      admitted += 1
    }
    val result = safe(work)
    result.onComplete { _ => synchronized { admitted -= 1; if (closing && admitted == 0) empty.trySuccess(()) } }(ExecutionContext.parasitic)
    result
  }
  def close(): Future[${n.closeReport.identifier}] = synchronized {
    closingResult.getOrElse {
      closing = true
      readyFlag = false
      if (admitted == 0) empty.trySuccess(())
      val result = resources.close()
      closingResult = Some(result)
      result
    }
  }
}
object ${n.application.identifier} {
  def open(settings: ${n.settings.identifier}, hosts: ${p.aggregate.base.computations.fqn}, authority: ${n.authority.fqn},
      lifecycleSystem: ActorSystem[_]): ${n.application.identifier} = {
    settings.validate()
    require(hosts != null && authority != null && lifecycleSystem != null)
    val directory = new ${n.directory.fqn}(${n.directory.fqn}.declared)
    val resources = new ${n.lifecycle.identifier}(lifecycleSystem)
    val executor = Executors.newFixedThreadPool(${limit.blockingThreads})
    resources.register("executor")(end => resources.stopExecutor(executor, end))
    val blockingEc = ExecutionContext.fromExecutorService(executor)
    implicit val lifecycleEc: ExecutionContext = lifecycleSystem.executionContext
    try {
      val pool = JdbcConnectionPool.create("jdbc:h2:file:" + settings.readside + ";DB_CLOSE_ON_EXIT=FALSE;IGNORECASE=FALSE" +
        (if (settings.freshReadside) "" else ";IFEXISTS=TRUE"), "sa", "")
      resources.register("readside-pool") { _ => pool.dispose(); Future.successful(()) }
      pool.setMaxConnections(4)
      val config = ConfigFactory.parseString("""
        akka.actor.provider = local
        akka.loglevel = WARNING
        akka.actor.allow-java-serialization = off
        akka.persistence.journal.plugin = "akka.persistence.journal.leveldb"
        akka.persistence.journal.leveldb.native = off
        akka.persistence.snapshot-store.plugin = "akka.persistence.snapshot-store.local"
      """).withValue("akka.persistence.journal.leveldb.dir", ConfigValueFactory.fromAnyRef(settings.journal.toString))
        .withValue("akka.persistence.snapshot-store.local.dir", ConfigValueFactory.fromAnyRef(settings.journal.toString + "-snapshots"))
        .withFallback(ConfigFactory.load())
      val owned = ActorSystem[Nothing](Behaviors.empty, ${q(m.composition.root.actorSystem)}, config)
      resources.register("actors") { _ => owned.terminate(); owned.whenTerminated.map(_ => ()) }
      val repo = new ${p.aggregate.repositoryImplementation.fqn}[String](
        id => akka.persistence.typed.PersistenceId.ofUniqueId(directory.find(id).get.persistenceId),
        (_, pid) => ${p.names.factory.fqn}.create(pid, ${p.aggregate.base.state.fqn}.empty, hosts),
        (id, _, behavior) => owned.systemActorOf(behavior, "resource-" + directory.bindings.indexWhere(_.resourceId == id)))
      resources.register("repository") { _ => repo.close(); Future.successful(()) }
      val readside = new ${p.names.repository.fqn}(pool, settings.namespace)
      val source = new ${n.journalSource.fqn}(owned, directory)
      resources.register("source")(_ => source.close())
      val runner = new ${p.names.runner.fqn}(readside, new ${p.names.handler.fqn}(readside, ${p.aggregate.base.state.fqn}.empty), source, blockingEc, owned)
      resources.register("readside")(_ => runner.shutdown().map { report => require(report.drained && !report.timedOut && report.failure.isEmpty, "readside not drained") })
      new ${n.application.identifier}(settings, directory, authority, owned, executor, pool, repo, readside, source, runner,
        new ${n.commandService.fqn}(repo, directory, owned, ${limit.askMillis}), new ${n.queryService.fqn}(readside, directory, blockingEc), lifecycleSystem, resources)
    } catch { case NonFatal(error) =>
      try {
        val report = scala.concurrent.Await.result(resources.close(), ${limit.closeMillis + 1000}.millis)
        report.failures.foreach(name => error.addSuppressed(new IllegalStateException("cleanup failed: " + name)))
      } catch { case NonFatal(cleanup) => error.addSuppressed(cleanup) }
      throw error
    }
  }
}
`, [m.composition.source, m.api.source, p.product.source]);
}
export function closeReportTemplate(m, out) {
  out.append(`package ${m.names.closeReport.package}

final case class ${m.names.closeReport.identifier}(drained: Boolean, failures: Vector[String])
`, [m.composition.source]);
}
