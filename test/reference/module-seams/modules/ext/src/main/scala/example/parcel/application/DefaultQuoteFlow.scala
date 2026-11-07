package example.parcel.application

import example.parcel.application.ports.{QuoteFlow, RouteRepository}
import example.parcel.domain.QuoteError
import example.parcel.domain.QuoteError.UnknownRoute
import example.parcel.domain.ports.CapacityPolicy
import example.parcel.domain.values.{Quote, QuoteRequest}

import scala.concurrent.{ExecutionContext, Future}

final class DefaultQuoteFlow(repository: RouteRepository, capacity: CapacityPolicy)(
    implicit executionContext: ExecutionContext
) extends QuoteFlow {
  override def quote(request: QuoteRequest): Future[Either[QuoteError, Quote]] =
    repository.find(request.routeId).map {
      case None => Left(UnknownRoute(request.routeId))
      case Some(route) => capacity.assess(route, request.parcels).map(load => Quote(route.id, load))
    }
}
