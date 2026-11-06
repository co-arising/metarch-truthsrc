import { entry, packageFor, pathFor, symbol } from '../scala-cqrs-domain/naming.mjs';
import { fail } from '../../lib/products/request.mjs';
import { validateJournalReadside } from '../../lib/products/journal-readside.mjs';
import { journalStatements, renderJournalRepository } from './render-journal-repository.mjs';
import { renderJournalDomain } from './render-journal-domain.mjs';

const q = JSON.stringify;

function renderProjection(pkg, store) {
  const name = symbol(store.id);
  return `package ${pkg}.infrastructure.projection

import akka.{Done, NotUsed}
import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.adapter._
import akka.serialization.{SerializationExtension, Serializers}
import akka.stream.{KillSwitches, Materializer, SharedKillSwitch, SystemMaterializer}
import akka.stream.scaladsl.{Sink, Source}
import javax.sql.DataSource
import scalapb.GeneratedMessage
import scala.collection.mutable
import scala.concurrent.{Await, ExecutionContext, Future, Promise}
import scala.concurrent.duration._
import scala.util.control.NonFatal

object ${name}Projection {
  final case class Envelope(pid: String, sequenceNr: Long, event: Any) {
    require(pid != null && pid.nonEmpty && sequenceNr > 0L && event != null, "valid journal envelope required")
  }
  trait Journal {
    def namespace: String
    def persistenceIds(): Source[String, NotUsed]
    def currentEvents(pid: String, after: Long): Future[Vector[Envelope]]
    def events(pid: String, after: Long): Source[Envelope, NotUsed]
  }
  trait Bindings {
    def identity(pid: String): (String, String)
    def fold(row: ${name}Repository.Row, event: Any): ${name}Repository.State
    def indexes(session: ${name}Repository#Session, row: ${name}Repository.Row): Unit
  }
}

/** Disposable derived state. Supply a blocking JDBC execution context. This owner closes
  * its subscriptions only, never the journal, DataSource or ActorSystem. A frontier is
  * an observed per-PID sample, not proof that discovery or a whole index is current.
  */
final class ${name}Projection(journal: ${name}Projection.Journal, bindings: ${name}Projection.Bindings, dataSource: DataSource)
    (implicit system: ActorSystem[_], ec: ExecutionContext) extends AutoCloseable {
  import ${name}Projection._
  import ${name}Repository.Payload
  require(journal != null && bindings != null && dataSource != null, "complete journal projection bindings required")
  private val namespace = journal.namespace
  private val repository = new ${name}Repository(namespace, dataSource)
  private implicit val materializer: Materializer = SystemMaterializer(system).materializer
  private val serialization = SerializationExtension(system.toClassic)
  private val stop: SharedKillSwitch = KillSwitches.shared(${q(store.id + '-')} + namespace)
  private val allowedKinds: Set[String] = Set(${[...store.streams.map(s => s.kind), ...store.technicalKinds].map(q).join(', ')})
  private val watches = mutable.Map.empty[String, Future[Done]]
  private var discovery: Option[Future[Done]] = None
  private var poll: Option[akka.actor.Cancellable] = None
  private var closed = false
  private var initialized: Option[Future[Unit]] = None
  private var pendingWork = 0
  private val drained = Promise[Unit]()
  private var shutdownResult = Option.empty[Future[Unit]]

  private def tracked[A]()(work: => Future[A]): Future[A] = synchronized {
    if (closed) Future.failed(new IllegalStateException("readside is closed"))
    else {
      pendingWork += 1
      val result = try work catch { case NonFatal(error) => Future.failed(error) }
      result.transform { outcome =>
        synchronized {
          pendingWork -= 1
          if (closed && pendingWork == 0) drained.trySuccess(())
        }
        outcome
      }(ExecutionContext.parasitic)
    }
  }
  private def identity(pid: String): (String, String) = {
    require(pid != null && pid.nonEmpty && pid.length <= 2048, "bounded persistence identity required")
    val (kind, resource) = bindings.identity(pid)
    require(allowedKinds.contains(kind), "unrecognized persistence kind")
    require(kind.length <= 32 && resource != null && resource.length <= 2048, "bounded persistence identity required")
    kind -> resource
  }
  private def payload(event: Any): Payload = event match {
    case message: GeneratedMessage => Payload(message.getClass.getName, message.getClass.getSimpleName, message.toByteArray)
    case ref: AnyRef =>
      val serializer = serialization.findSerializerFor(ref)
      Payload(ref.getClass.getName, serializer.identifier.toString + ":" + Serializers.manifestFor(serializer, ref), serializer.toBinary(ref))
    case _ => throw new IllegalArgumentException("journal event must be serializable")
  }
  def initialize(): Future[Unit] = synchronized {
    require(!closed, "readside is closed")
    initialized.getOrElse {
      val ready = tracked() { Future(repository.initialize()) }
      initialized = Some(ready)
      ready
    }
  }
  def project(envelope: Envelope): Future[Unit] = {
    val (kind, resource) = identity(envelope.pid) // fail before initialization or any SQL
    tracked() { initialize().flatMap { _ => Future(repository.write { session =>
      val row = session.ensureRow(envelope.pid, kind, resource)
      val serialized = payload(envelope.event)
      session.event(row.pid, envelope.sequenceNr) match {
        case Some(existing) =>
          require(existing.kind == serialized.kind && existing.manifest == serialized.manifest &&
            java.util.Arrays.equals(existing.bytes, serialized.bytes), "conflicting journal sequence/payload")
        case None =>
          require(envelope.sequenceNr == Math.addExact(row.last, 1L), "noncontiguous journal sequence")
          val state = bindings.fold(row, envelope.event)
          val next = session.append(row, envelope.sequenceNr, serialized, state)
          bindings.indexes(session, next)
      }
      ()
    }) } }
  }
  def read[A](f: ${name}Repository#Session => A): Future[A] = tracked() {
    Future(repository.read(session => f(session)))
  }
  def catchUp(pid: String): Future[Unit] = tracked() {
    val (kind, resource) = identity(pid)
    initialize().flatMap(_ => Future(repository.read(_.row(pid).map(_.last).getOrElse(0L)))).flatMap { after =>
      journal.currentEvents(pid, after).flatMap { events =>
        require(events.forall(_.pid == pid), "foreign PID returned by journal")
        events.foldLeft(Future.successful(()))((done, event) => done.flatMap(_ => project(event))).flatMap { _ =>
          val high = events.lastOption.map(_.sequenceNr).getOrElse(after)
          Future(repository.write { session =>
            session.ensureRow(pid, kind, resource)
            session.observe(pid, high)
          })
        }
      }
    }
  }
  private def invalidate(pid: String): Future[Unit] = Future(repository.write(_.invalidate(pid)))
  private def watch(pid: String): Unit = synchronized {
    if (!closed && !watches.contains(pid)) {
      identity(pid)
      val running = tracked() {
        journal.events(pid, 0L).via(stop.flow).mapAsync(1)(project).runWith(Sink.ignore)
          .transformWith(_ => invalidate(pid).map(_ => Done))
      }
      watches.put(pid, running)
      running.onComplete { _ => synchronized { watches.remove(pid) } }(ExecutionContext.parasitic)
    }
  }
  private def discover(): Unit = synchronized {
    // Discovery can be infinite; never stack another subscription or await it as readiness.
    if (!closed && discovery.isEmpty) {
      val running = tracked() { journal.persistenceIds().via(stop.flow).runForeach(watch) }
      discovery = Some(running)
      running.onComplete { _ => synchronized { discovery = None } }(ExecutionContext.parasitic)
    }
  }
  def start(): Future[Unit] = tracked() { initialize().map { _ => synchronized {
    require(!closed, "readside is closed")
    if (poll.isEmpty) {
      discover()
      poll = Some(system.scheduler.scheduleWithFixedDelay(Duration.Zero, ${store.pollIntervalMillis}.millis)(new Runnable {
        def run(): Unit = ${name}Projection.this.synchronized {
          if (!closed) {
            discover()
            watches.keys.toVector.foreach { pid =>
              tracked() { catchUp(pid).recoverWith { case NonFatal(_) => invalidate(pid) } }
            }
          }
        }
      })(ec))
    }
    ()
  } } }
  def shutdown(): Future[Unit] = synchronized {
    shutdownResult.getOrElse {
      closed = true
      poll.foreach(_.cancel())
      stop.shutdown()
      if (pendingWork == 0) drained.trySuccess(())
      val result = drained.future.flatMap { _ =>
        initialized match {
          case None => Future.successful(())
          case Some(ready) => ready.flatMap(_ => Future(repository.write(_.invalidateAll())))
        }
      }
      shutdownResult = Some(result)
      result
    }
  }
  def close(): Unit = { Await.result(shutdown(), ${store.closeTimeoutMillis}.millis); () }
}
`;
}

/** Optional, data-driven service projection producer; no dependency on render-service. */
export function renderJournalReadside({ products, options }, footprint) {
  const artifacts = products['artifact-contract'].artifacts.filter(artifact =>
    artifact.id === options.service.artifact && artifact.status === 'selected' && artifact.deployment.service);
  if (artifacts.length !== 1) fail('SERVICE_OPTIONS', 'one selected service artifact required');
  const artifact = artifacts[0], service = artifact.deployment.service;
  if (!Object.hasOwn(service, 'projectionStore')) return [];
  const store = validateJournalReadside(service.projectionStore, products['reference-layout'], artifact.source);
  // These are fixed Scala/JDBC ABI limits, not inferred application policy. Keep a
  // finite producer error until the shared declaration gate also covers them.
  const companionNames = new Set(['Row', 'Payload', 'State', 'Owner', 'hash', 'String', 'Long', 'Boolean', 'Byte', 'Array', 'Option', 'MessageDigest', 'StandardCharsets']);
  if ([...store.streams.map(stream => stream.kind), ...store.technicalKinds].some(kind => kind.length > 32))
    fail('SERVICE_JOURNAL_READSIDE_TARGET', 'PID kinds must fit the compatible VARCHAR(32) column', artifact.source);
  for (const index of store.indexes) {
    if (companionNames.has(index.id)) fail('SERVICE_JOURNAL_READSIDE_TARGET', 'index record collides with a fixed repository symbol: ' + index.id, artifact.source);
    if (index.queries.some(query => query.where.includes('after')))
      fail('SERVICE_JOURNAL_READSIDE_TARGET', 'query equality argument collides with the fixed after pagination argument', artifact.source);
  }
  const pkg = packageFor(artifact.artifact.context, options), name = symbol(store.id);
  const source = { document: artifact.source.document, pointer: artifact.source.pointer + '/deployment/service/projectionStore' };
  const path = suffix => pathFor(pkg, `infrastructure/projection/${store.id}${suffix}.scala`);
  const mapped = (path, content, deps = [], sources = [source], mappings = [], kind = 'service-runtime') => {
    const span = { start: 0, end: content.length };
    return entry(path, content, kind, sources, footprint, deps, [{ source, span, scope: span }, ...mappings]);
  };
  const statements = journalStatements(store);
  const schema = `package ${pkg}.infrastructure.projection

object ${name}Schema {
  val version: String = ${q(store.version)}
  val statements: Vector[String] = Vector(
${statements.map(sql => '    ' + q(sql)).join(',\n')}
  )
}
`;
  const domain = renderJournalDomain({ products, options }, pkg, store, source);
  const sql = mapped(`conf/sql/${store.id}.sql`, statements.join(';\n\n') + ';\n', [], [source], [], 'service-config');
  // Keep the entry helper's byte offsets intact while using an actual SQL comment.
  sql.content = sql.content.replace(/^\/\//u, '--');
  return [
    mapped(path('Schema'), schema),
    mapped(path('Repository'), renderJournalRepository(pkg, store), [path('Schema')]),
    mapped(path('Projection'), renderProjection(pkg, store), [path('Repository')]),
    mapped(path('Domain'), domain.content, domain.deps, domain.sources, domain.codeMappings),
    sql
  ];
}
