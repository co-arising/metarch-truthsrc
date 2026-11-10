package example.inventory.playreference.oracle

import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._
import example.inventory.infrastructure.web.{ApiPrincipal, AuthorityUnavailable, WarehouseAuthority}
import play.api.mvc.RequestHeader
import java.util.concurrent.atomic.AtomicInteger
import scala.concurrent.Future

object FaultFixtures {
  def authority(delegate: WarehouseAuthority, mode: String): WarehouseAuthority = new WarehouseAuthority {
    def authenticate(request: RequestHeader): Future[Option[ApiPrincipal]] = mode match {
      case "authority-unavailable" => Future.failed(new AuthorityUnavailable)
      case "authority-unexpected" => Future.failed(new IllegalStateException("private-authority-detail"))
      case _ => delegate.authenticate(request)
    }
    def csrf(request: RequestHeader, principal: ApiPrincipal): Future[Boolean] = mode match {
      case "csrf-unavailable" => Future.failed(new AuthorityUnavailable)
      case _ => delegate.csrf(request, principal)
    }
  }
  def computations(delegate: WarehouseComputations, mode: String, count: AtomicInteger): WarehouseComputations = new WarehouseComputations {
    def reservationIdentity(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long): ReservationId = {
      count.incrementAndGet()
      if (mode == "ask-timeout") Thread.sleep(1500)
      if (mode == "invalid-output") ReservationId("x" * 257)
      else delegate.reservationIdentity(txid, warehouseId, skuId, quantity)
    }
  }
}
