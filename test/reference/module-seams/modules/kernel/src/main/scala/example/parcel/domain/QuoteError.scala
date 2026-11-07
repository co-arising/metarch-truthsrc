package example.parcel.domain

import example.parcel.domain.values.{ParcelId, RouteId}

sealed trait QuoteError

object QuoteError {
  case object EmptyParcels extends QuoteError
  final case class InvalidCapacity(routeId: RouteId, capacityGrams: Long) extends QuoteError
  final case class InvalidWeight(parcelId: ParcelId, grams: Long) extends QuoteError
  final case class DuplicateParcel(parcelId: ParcelId) extends QuoteError
  final case class OverCapacity(routeId: RouteId, totalGrams: Long, capacityGrams: Long) extends QuoteError
  case object WeightOverflow extends QuoteError
  final case class UnknownRoute(routeId: RouteId) extends QuoteError
}
