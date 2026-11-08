package example.parcel.domain

import example.parcel.domain.QuoteError._
import example.parcel.domain.values._

object CapacityRule {
  def assess(route: Route, parcels: Vector[Parcel]): Either[QuoteError, Load] = {
    if (route.capacityGrams <= 0) Left(InvalidCapacity(route.id, route.capacityGrams))
    else if (parcels.isEmpty) Left(EmptyParcels)
    else {
      val total = parcels.foldLeft[Either[QuoteError, (Set[ParcelId], Long)]](Right((Set.empty, 0L))) {
        case (accumulated, parcel) =>
          accumulated.flatMap { case (seen, grams) =>
            if (parcel.grams <= 0) Left(InvalidWeight(parcel.id, parcel.grams))
            else if (seen.contains(parcel.id)) Left(DuplicateParcel(parcel.id))
            else if (parcel.grams > Long.MaxValue - grams) Left(WeightOverflow)
            else Right((seen + parcel.id, grams + parcel.grams))
          }
      }
      total.flatMap { case (_, grams) =>
        if (grams > route.capacityGrams) Left(OverCapacity(route.id, grams, route.capacityGrams))
        else Right(Load(grams))
      }
    }
  }
}
