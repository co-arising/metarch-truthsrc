package example.parcel.domain.values

final case class RouteId(value: String)
final case class ParcelId(value: String)
final case class Parcel(id: ParcelId, grams: Long)
final case class Route(id: RouteId, capacityGrams: Long)
final case class Load(totalGrams: Long)
final case class QuoteRequest(routeId: RouteId, parcels: Vector[Parcel])
final case class Quote(routeId: RouteId, load: Load)
