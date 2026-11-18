package example.stockreservation.domain.invariant

import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}

import example.stockreservation.domain.entities.StockReservationEntity
import example.stockreservation.domain.entities.StockReservationEntity.{StockReservationEvents, StockReservationState}
import example.stockreservation.domain.services.ReservationIdentity
import example.stockreservation.domain.values._

object StockReservationRules {
  sealed abstract class ReservationRejection(val code: String, val message: String) {
    final def toError: iMadzError = iMadzError(code, message)
  }

  object ReservationRejection {
    case object QuantityNotPositive extends ReservationRejection(
      "STOCK_QUANTITY_NONPOSITIVE", "Requested quantity must be greater than zero."
    )
    case object RequestAlreadyReserved extends ReservationRejection(
      "STOCK_REQUEST_ALREADY_RESERVED", "The request already has a reservation."
    )
    case object UnknownLocation extends ReservationRejection(
      "STOCK_LOCATION_UNKNOWN", "Every requested location must be registered."
    )
    case object StockUnavailable extends ReservationRejection(
      "STOCK_UNAVAILABLE", "The SKU must exist with sufficient available quantity."
    )
    case object ReservationMissing extends ReservationRejection(
      "STOCK_RESERVATION_MISSING", "The request has no reservation."
    )
    case object ReservationIdentityMismatch extends ReservationRejection(
      "STOCK_RESERVATION_ID_MISMATCH", "The reservation identity does not match the request."
    )
  }

  import ReservationRejection._

  final case class ReserveUnitsParams(
      requestId: RequestId,
      sku: SkuId,
      quantity: Long,
      locations: Vector[LocationId],
      locationNotes: Option[Map[LocationId, Vector[ReservationNote]]]
  )

  final case class ConfirmReservationParams(
      requestId: RequestId,
      reservationId: ReservationId
  )

  /** One named single-responsibility admission check; the rule body never changes when guards are added. */
  private sealed trait ReserveGuard {
    def rejection(state: StockReservationState, p: ReserveUnitsParams): Option[ReservationRejection]
  }

  private object QuantityGuard extends ReserveGuard {
    def rejection(state: StockReservationState, p: ReserveUnitsParams): Option[ReservationRejection] =
      if (p.quantity <= 0L) Some(QuantityNotPositive) else None
  }

  private object FreshRequestGuard extends ReserveGuard {
    def rejection(state: StockReservationState, p: ReserveUnitsParams): Option[ReservationRejection] =
      if (state.reservations.contains(p.requestId)) Some(RequestAlreadyReserved) else None
  }

  private object RegisteredLocationsGuard extends ReserveGuard {
    def rejection(state: StockReservationState, p: ReserveUnitsParams): Option[ReservationRejection] =
      if (p.locations.forall(state.registeredLocations.contains)) None else Some(UnknownLocation)
  }

  private object SufficientStockGuard extends ReserveGuard {
    def rejection(state: StockReservationState, p: ReserveUnitsParams): Option[ReservationRejection] =
      if (state.available.get(p.sku).exists(_ >= p.quantity)) None else Some(StockUnavailable)
  }

  /** Guard order is declared data; the first rejection wins and rejected params never compute an identity. */
  private val reserveGuards: Vector[ReserveGuard] =
    Vector(QuantityGuard, FreshRequestGuard, RegisteredLocationsGuard, SufficientStockGuard)

  final class ReserveUnitsRule(identity: ReservationIdentity)
      extends InvariantRule[StockReservationEvents, StockReservationState, ReserveUnitsParams] {
    override def apply(
        state: StockReservationState,
        p: ReserveUnitsParams
    ): Either[iMadzError, List[StockReservationEvents]] =
      reserveGuards.iterator.map(_.rejection(state, p)).collectFirst { case Some(rejection) =>
        Left(rejection.toError)
      }.getOrElse(Right(reserve(state, p)))

    private def reserve(state: StockReservationState, p: ReserveUnitsParams): List[StockReservationEvents] = {
      val reservationId = identity.reservationId(state.warehouseId, p.requestId, p.sku, p.quantity)
      List(
        StockReservationEntity.UnitsReserved(
          p.requestId, reservationId, p.sku, p.quantity, p.locations, p.locationNotes
        ),
        StockReservationEntity.ReservationReceiptIssued(p.requestId, reservationId)
      )
    }
  }

  object ConfirmReservationRule
      extends InvariantRule[StockReservationEvents, StockReservationState, ConfirmReservationParams] {
    override def apply(
        state: StockReservationState,
        p: ConfirmReservationParams
    ): Either[iMadzError, List[StockReservationEvents]] =
      state.reservations.get(p.requestId) match {
        case None => Left(ReservationMissing.toError)
        case Some(reservation) =>
          if (reservation.reservationId != p.reservationId) Left(ReservationIdentityMismatch.toError)
          else if (state.confirmedRequests.contains(p.requestId)) Right(Nil)
          else Right(List(StockReservationEntity.ReservationConfirmed(p.requestId, p.reservationId)))
      }
  }
}
