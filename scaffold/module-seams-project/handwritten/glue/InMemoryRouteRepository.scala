package example.parcel.infrastructure

import example.parcel.application.ports.RouteRepository
import example.parcel.domain.values.{Route, RouteId}

import scala.collection.immutable.Map
import scala.concurrent.Future

final class InMemoryRouteRepository(routes: Map[RouteId, Route]) extends RouteRepository {
  override def find(id: RouteId): Future[Option[Route]] = Future.successful(routes.get(id))
}
