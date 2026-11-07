package example.parcel.domain.ports

import example.parcel.domain.QuoteError
import example.parcel.domain.values.{Load, Parcel, Route}

trait CapacityPolicy {
  def assess(route: Route, parcels: Vector[Parcel]): Either[QuoteError, Load]
}
