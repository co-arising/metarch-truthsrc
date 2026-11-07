package example.parcel.domain.ports

import example.parcel.domain.{CapacityRule, QuoteError}
import example.parcel.domain.values.{Load, Parcel, Route}

final class CapacityPolicyBridge extends CapacityPolicy {
  override def assess(route: Route, parcels: Vector[Parcel]): Either[QuoteError, Load] =
    CapacityRule.assess(route, parcels)
}
