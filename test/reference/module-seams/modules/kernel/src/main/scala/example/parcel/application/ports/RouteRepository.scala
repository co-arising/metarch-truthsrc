package example.parcel.application.ports

import example.parcel.domain.values.{Route, RouteId}

import scala.concurrent.Future

trait RouteRepository {
  def find(id: RouteId): Future[Option[Route]]
}
