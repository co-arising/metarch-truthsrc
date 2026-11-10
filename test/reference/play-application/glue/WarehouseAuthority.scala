package example.inventory.infrastructure.web

import example.inventory.application.api.WarehouseApi
import play.api.mvc.RequestHeader
import scala.concurrent.Future

final case class ApiPrincipal(id: String, roles: Set[String], resources: Set[String]) {
  require(id != null && id.nonEmpty && roles != null && resources != null &&
    roles.forall(_ != null) && resources.forall(_ != null), "principal required")
}
final class AuthorityUnavailable extends RuntimeException("authority unavailable")
trait WarehouseAuthority {
  def authenticate(request: RequestHeader): Future[Option[ApiPrincipal]]
  def csrf(request: RequestHeader, principal: ApiPrincipal): Future[Boolean]
}
final case class ResourceBinding(warehouseId: String, persistenceId: String, resource: String) {
  require(Vector(warehouseId, persistenceId, resource).forall(v => v != null && v.nonEmpty &&
    v.length <= 256 && !v.exists(Character.isISOControl)), "bounded resource identity required")
}
final class WarehouseDirectory(val bindings: Vector[ResourceBinding]) {
  require(bindings != null && bindings.nonEmpty && bindings.size <= 8 && bindings.forall(_ != null), "bounded directory required")
  require(bindings.map(_.warehouseId).distinct.size == bindings.size && bindings.map(_.persistenceId).distinct.size == bindings.size &&
    bindings.map(_.resource).distinct.size == bindings.size, "one-to-one resource association required")
  def find(id: String): Option[ResourceBinding] = bindings.find(_.warehouseId == id)
  def byPid(pid: String): Option[ResourceBinding] = bindings.find(_.persistenceId == pid)
}
