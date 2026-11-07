package example.parcel.composition

import example.parcel.application.DefaultQuoteFlow
import example.parcel.application.ports.QuoteFlow
import example.parcel.domain.ports.CapacityPolicyBridge
import example.parcel.domain.values.{Route, RouteId}
import example.parcel.infrastructure.InMemoryRouteRepository

import scala.collection.immutable.Map
import scala.concurrent.ExecutionContext

object ParcelModule {
  def create(routes: Map[RouteId, Route])(implicit executionContext: ExecutionContext): QuoteFlow = {
    val repository = new InMemoryRouteRepository(routes)
    val capacity = new CapacityPolicyBridge
    new DefaultQuoteFlow(repository, capacity)
  }
}
