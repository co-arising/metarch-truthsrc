package example.inventory.extensions

import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._
import example.inventory.infrastructure.web.{ApiPrincipal, WarehouseAuthority}
import play.api.mvc.RequestHeader
import java.nio.charset.StandardCharsets.UTF_8
import java.security.MessageDigest
import java.nio.ByteBuffer
import scala.concurrent.Future

final class ReservationIdentity extends WarehouseComputations {
  override def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId = {
    val digest = MessageDigest.getInstance("SHA-256")
    Vector(txid.value, warehouseId.value, skuId.value, quantity.toString).foreach { value =>
      val bytes = value.getBytes(UTF_8)
      digest.update(ByteBuffer.allocate(4).putInt(bytes.length).array())
      digest.update(bytes)
    }
    ReservationId(digest.digest().map(b => f"${b & 255}%02x").mkString)
  }
}
final case class LocalCredential(token: String, csrf: String, principal: ApiPrincipal)
final class ConfiguredWarehouseAuthority(credentials: Vector[LocalCredential]) extends WarehouseAuthority {
  require(credentials != null && credentials.nonEmpty && credentials.size <= 8 && credentials.forall(c =>
    c != null && c.token != null && c.token.length >= 24 && c.csrf != null && c.csrf.length >= 24 && c.principal != null))
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
