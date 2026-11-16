import { scalarType, scalaFields } from './syntax.mjs';

export function apiTemplate(m, out) {
  const n = m.names;
  out.append(`package ${n.api.package}

import scala.concurrent.Future

object ${n.api.identifier} {
  sealed trait Failure { def code: String }
  case object InvalidRequest extends Failure { val code = "invalid-request" }
  case object NotAuthenticated extends Failure { val code = "not-authenticated" }
  case object NotAuthorized extends Failure { val code = "not-authorized" }
  case object CsrfDenied extends Failure { val code = "csrf-denied" }
  case object MissingResource extends Failure { val code = "not-found" }
  case object Unavailable extends Failure { val code = "service-unavailable" }
  case object OutcomeUnknown extends Failure { val code = "outcome-unknown" }
  case object InternalFailure extends Failure { val code = "internal-error" }
  final case class DomainRejected(code: String) extends Failure
  type Outcome[A] = Either[Failure, A]
  sealed trait CommandResult[+A]
  final case class Applied[A](event: A) extends CommandResult[A]
  case object NoChange extends CommandResult[Nothing]
`, [m.api.source]);
  for (const c of m.commands) out.append(`  final case class ${c.requestName.identifier}(${scalaFields(c.fields)})
`, [c.source, ...c.fields.flatMap(f => [f.source, f.domainSource])]);
  out.append(`  final case class ReceiptPosition(mapKey: String, pidKey: String)
  final case class ReceiptItem(${m.query.key.identifier}: ${scalarType(m.query.keyCarrier)}, ${m.query.value.identifier}: ${scalarType(m.query.valueCarrier)})
  final case class ReceiptPage(rows: Vector[ReceiptItem], next: Option[ReceiptPosition])
}
`, [m.query.source, m.query.indexSource]);
}
export function commandsTemplate(m, out) {
  const n = m.names;
  out.append(`package ${n.commands.package}

import scala.concurrent.Future
import ${n.api.fqn}._

trait ${n.commands.identifier} {
`, [m.api.source]);
  for (const c of m.commands) out.append(`  def ${c.method.identifier}(request: ${c.requestName.identifier}): Future[Outcome[CommandResult[${c.event.fqn}]]]
`, [c.source, c.commandSource]);
  out.append('}\n');
}
export function queriesTemplate(m, out) {
  out.append(`package ${m.names.queries.package}

import scala.concurrent.Future
import ${m.names.api.fqn}._

trait ${m.names.queries.identifier} {
  def receipts(resource: ${scalarType(m.resource)}, after: Option[ReceiptPosition], limit: Int): Future[Outcome[ReceiptPage]]
}
`, [m.query.source, m.query.indexSource]);
}
