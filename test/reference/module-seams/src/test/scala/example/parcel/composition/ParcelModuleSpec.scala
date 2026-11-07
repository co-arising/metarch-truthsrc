package example.parcel.composition

import example.parcel.application.ports.QuoteFlow
import example.parcel.domain.QuoteError._
import example.parcel.domain.values._
import example.parcel.infrastructure.InMemoryRouteRepository
import org.scalatest.funsuite.AnyFunSuite

import scala.concurrent.{Await, ExecutionContext}
import scala.concurrent.duration._

final class ParcelModuleSpec extends AnyFunSuite {
  private implicit val executionContext: ExecutionContext = ExecutionContext.parasitic
  private val north = RouteId("north")
  private val south = RouteId("south")
  private val parcels = Vector(Parcel(ParcelId("a"), 2), Parcel(ParcelId("b"), 3))
  private val routes = Map(north -> Route(north, 5), south -> Route(south, 4))

  test("root binding returns a port backed by the explicit routes and capacity bridge") {
    val flow: QuoteFlow = ParcelModule.create(routes)
    assert(Await.result(flow.quote(QuoteRequest(north, parcels)), 2.seconds) ==
      Right(Quote(north, Load(5))))
    assert(Await.result(flow.quote(QuoteRequest(south, parcels)), 2.seconds) ==
      Left(OverCapacity(south, 5, 4)))
  }

  test("actual wiring applies duplicate and empty input rules") {
    val flow = ParcelModule.create(routes)
    assert(Await.result(flow.quote(QuoteRequest(north, Vector(parcels.head, parcels.head))), 2.seconds) ==
      Left(DuplicateParcel(ParcelId("a"))))
    assert(Await.result(flow.quote(QuoteRequest(north, Vector.empty)), 2.seconds) == Left(EmptyParcels))
  }

  test("actual wiring does not manufacture missing routes") {
    val flow = ParcelModule.create(Map.empty[RouteId, Route])
    assert(Await.result(flow.quote(QuoteRequest(north, parcels)), 2.seconds) == Left(UnknownRoute(north)))
  }

  test("separately composed modules retain their own immutable route maps") {
    val first = ParcelModule.create(routes)
    val second = ParcelModule.create(routes.updated(north, Route(north, 1)))
    val request = QuoteRequest(north, parcels)
    assert(Await.result(first.quote(request), 2.seconds) == Right(Quote(north, Load(5))))
    assert(Await.result(second.quote(request), 2.seconds) == Left(OverCapacity(north, 5, 1)))
    assert(Await.result(first.quote(request), 2.seconds) == Right(Quote(north, Load(5))))
  }

  test("the in-memory adapter returns already completed read-only lookup futures") {
    val repository = new InMemoryRouteRepository(routes)
    val present = repository.find(north)
    val missing = repository.find(RouteId("missing"))
    assert(present.isCompleted)
    assert(missing.isCompleted)
    assert(Await.result(present, 2.seconds).contains(routes(north)))
    assert(Await.result(missing, 2.seconds).isEmpty)
    assert(Await.result(repository.find(north), 2.seconds).contains(routes(north)))
    assert(routes == Map(north -> Route(north, 5), south -> Route(south, 4)))
  }
}
