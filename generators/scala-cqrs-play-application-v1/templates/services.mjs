import { scalarType, unwrap } from './syntax.mjs';

export function commandServiceTemplate(m, out) {
  const n = m.names, p = m.persistence, protocol = p.aggregate.actorProtocol.fqn;
  out.append(`package ${n.commandService.package}

import akka.actor.typed.{ActorSystem, Scheduler}
import akka.actor.typed.scaladsl.AskPattern._
import java.util.concurrent.TimeoutException
import akka.util.Timeout
import ${n.api.fqn}._
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.control.NonFatal

final class ${n.commandService.identifier}(repository: ${p.aggregate.repository.fqn}[String], directory: ${n.directory.fqn},
    system: ActorSystem[_], askMillis: Int) extends ${n.commands.fqn} {
  require(repository != null && directory != null && system != null && askMillis > 0 && askMillis <= 5000)
  private implicit val ec: ExecutionContext = system.executionContext
  private implicit val scheduler: Scheduler = system.scheduler
  private implicit val timeout: Timeout = Timeout(askMillis.millis)
  private def execute[A <: ${p.aggregate.base.protocol.fqn}.Event](resource: ${scalarType(m.resource)}, command: ${p.aggregate.base.protocol.fqn}.Command)
      (select: PartialFunction[${p.aggregate.base.protocol.fqn}.Event, A]): Future[Outcome[CommandResult[A]]] = {
    val key = ${unwrap(m.resource, 'resource')}
    if (directory.find(key).isEmpty) return Future.successful(Left(MissingResource))
    try repository.get(key).ref.ask[${protocol}.Reply](${protocol}.Execute(command, _)).map {
      case ${protocol}.Accepted(events) if events.isEmpty => Right(NoChange)
      case ${protocol}.Accepted(Vector(event)) if select.isDefinedAt(event) => Right(Applied(select(event)))
      case ${protocol}.Rejected(code) => Left(DomainRejected(code))
      case _ => Left(InternalFailure)
    }.recover {
      case _: TimeoutException => Left(OutcomeUnknown)
      case NonFatal(_) => Left(InternalFailure)
    } catch { case _: IllegalStateException => Future.successful(Left(Unavailable)) }
  }
`, [m.api.source, m.composition.source]);
  for (const c of m.commands) out.append(`  override def ${c.method.identifier}(request: ${c.requestName.identifier}): Future[Outcome[CommandResult[${c.event.fqn}]]] =
    execute(request.${c.resource.identifier}, ${c.domain.fqn}(${c.domain.fields.map(d => 'request.' + c.fields.find(f => f.domain === d || f.domain.ref.id === d.ref.id).identifier).join(', ')})) {
      case event: ${c.event.fqn} => event
    }
`, [c.source, c.commandSource, c.eventSource]);
  out.append('}\n');
}
export function queryServiceTemplate(m, out) {
  out.append(`package ${m.names.queryService.package}

import ${m.names.api.fqn}._
import scala.concurrent.{ExecutionContext, Future, blocking}
import scala.util.control.NonFatal

final class ${m.names.queryService.identifier}(repository: ${m.persistence.names.repository.fqn}, directory: ${m.names.directory.fqn},
    blockingEc: ExecutionContext) extends ${m.names.queries.fqn} {
  require(repository != null && directory != null && blockingEc != null)
  override def receipts(resource: ${scalarType(m.resource)}, after: Option[ReceiptPosition], limit: Int): Future[Outcome[ReceiptPage]] = {
    if (limit < 1 || limit > ${m.query.maxPageSize}) return Future.successful(Left(InvalidRequest))
    directory.find(${unwrap(m.resource, 'resource')}) match {
      case None => Future.successful(Left(MissingResource))
      case Some(binding) => Future(blocking {
        val page = repository.byResource(binding.envelopeResource, after.map(c => ${m.persistence.names.cursor.fqn}(c.mapKey, c.pidKey)), limit)
        Right(ReceiptPage(page.rows.map(row => ReceiptItem(row.${m.persistence.index.keyMember}, row.${m.persistence.index.valueMember})),
          page.next.map(c => ReceiptPosition(c.mapKey, c.pidKey))))
      })(blockingEc).recover { case NonFatal(_) => Left(Unavailable) }(blockingEc)
    }
  }
}
`, [m.query.source, m.query.indexSource, m.composition.source]);
}
