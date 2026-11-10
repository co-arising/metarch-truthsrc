package example.inventory.extensions

import example.inventory.infrastructure.web.{ApiPrincipal, WarehouseAuthority}
import play.api.Configuration
import play.api.mvc.RequestHeader
import java.nio.charset.StandardCharsets.UTF_8
import java.security.MessageDigest
import scala.concurrent.Future

final class ConfiguredWarehouseAuthority(config: Vector[Configuration]) extends WarehouseAuthority {
  private final case class Credential(token: String, csrf: String, principal: ApiPrincipal)
  require(config != null && config.nonEmpty && config.size <= 8, "explicit local credentials required")
  private val credentials = config.map { row =>
    val token = row.get[String]("token")
    val csrf = row.get[String]("csrf")
    require(token.length >= 24 && token.length <= 512 && csrf.length >= 24 && csrf.length <= 512)
    Credential(token, csrf, ApiPrincipal(row.get[String]("id"), row.get[Seq[String]]("roles").toSet, row.get[Seq[String]]("resources").toSet))
  }
  require(credentials.map(_.token).distinct.size == credentials.size && credentials.map(_.principal.id).distinct.size == credentials.size)
  private def same(a: String, b: String): Boolean = MessageDigest.isEqual(a.getBytes(UTF_8), b.getBytes(UTF_8))
  private def token(request: RequestHeader): Option[String] = request.headers.getAll("Authorization") match {
    case Seq(value) if value.startsWith("Bearer ") && value.length <= 1024 => Some(value.substring(7))
    case _ => None
  }
  override def authenticate(request: RequestHeader): Future[Option[ApiPrincipal]] =
    Future.successful(token(request).flatMap(t => credentials.find(c => same(t, c.token))).map(_.principal))
  override def csrf(request: RequestHeader, principal: ApiPrincipal): Future[Boolean] = Future.successful {
    request.headers.getAll("X-CSRF-Token") match {
      case Seq(value) if value.length <= 1024 => token(request).exists(t => credentials.exists(c =>
        c.principal == principal && same(t, c.token) && same(value, c.csrf)))
      case _ => false
    }
  }
}
