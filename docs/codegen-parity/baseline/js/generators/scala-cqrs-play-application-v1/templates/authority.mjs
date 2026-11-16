import { q } from './syntax.mjs';
export function authorityTemplate(m, out) {
  out.append(`package ${m.names.authority.package}

import play.api.mvc.RequestHeader
import scala.concurrent.Future

final case class ApiPrincipal(id: String, roles: Set[String], resources: Set[String]) {
  require(id != null && id.nonEmpty && roles != null && resources != null && roles.forall(_ != null) && resources.forall(_ != null), "principal required")
}
final class AuthorityUnavailable extends RuntimeException("authority unavailable")
trait ${m.names.authority.identifier} {
  def authenticate(request: RequestHeader): Future[Option[ApiPrincipal]]
  def csrf(request: RequestHeader, principal: ApiPrincipal): Future[Boolean]
}
`, [m.api.source, m.composition.implementations.find(i => i.role === 'authority').source]);
}
export function directoryTemplate(m, out) {
  out.append(`package ${m.names.directory.package}

final case class ResourceBinding(resourceId: String, persistenceId: String, envelopeResource: String) {
  require(Vector(resourceId, persistenceId, envelopeResource).forall(v => v != null && v.nonEmpty && v.length <= 256 &&
    !v.exists(Character.isISOControl)), "bounded resource identity required")
}
final class ${m.names.directory.identifier}(val bindings: Vector[ResourceBinding]) {
  require(bindings != null && bindings.nonEmpty && bindings.size <= 8 && bindings.forall(_ != null), "bounded directory required")
  require(bindings.map(_.resourceId).distinct.size == bindings.size && bindings.map(_.persistenceId).distinct.size == bindings.size &&
    bindings.map(_.envelopeResource).distinct.size == bindings.size, "one-to-one resource association required")
  def find(id: String): Option[ResourceBinding] = bindings.find(_.resourceId == id)
  def byPid(pid: String): Option[ResourceBinding] = bindings.find(_.persistenceId == pid)
}
object ${m.names.directory.identifier} {
  val declared: Vector[ResourceBinding] = Vector(
`, [m.composition.source]);
  m.composition.resources.forEach((r, i) => out.append(`    ResourceBinding(${q(r.resourceId)}, ${q(r.persistenceId)}, ${q(r.envelopeResource)})${i + 1 < m.composition.resources.length ? ',' : ''}
`, [r.source]));
  out.append('  )\n}\n');
}
