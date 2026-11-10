package example.inventory.application.api

import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.values._
import scala.concurrent.Future

object WarehouseApi {
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
  final case class ReserveRequest(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, quantity: Long)
  final case class CommitRequest(txid: TxId, warehouseId: WarehouseId, skuId: SkuId, reservationId: ReservationId)
  final case class ReceiptPosition(mapKey: String, pidKey: String)
  final case class ReceiptItem(txid: TxId, receipt: String)
  final case class ReceiptPage(rows: Vector[ReceiptItem], next: Option[ReceiptPosition])
}
trait WarehouseCommands {
  import WarehouseApi._
  def reserve(request: ReserveRequest): Future[Outcome[CommandResult[WarehouseProtocol.SkuQuantityReserved]]]
  def commit(request: CommitRequest): Future[Outcome[CommandResult[WarehouseProtocol.SkuReservationCommitted]]]
}
trait WarehouseQueries {
  import WarehouseApi._
  def receipts(warehouseId: WarehouseId, after: Option[ReceiptPosition], limit: Int): Future[Outcome[ReceiptPage]]
}
