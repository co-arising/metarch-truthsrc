package example.parcel.application

import example.parcel.application.ports.{QuoteFlow, RouteRepository}
import example.parcel.domain.QuoteError
import example.parcel.domain.QuoteError._
import example.parcel.domain.ports.CapacityPolicy
import example.parcel.domain.values._
import org.scalatest.funsuite.AnyFunSuite

import scala.concurrent.{Await, ExecutionContext, Future, Promise}
import scala.concurrent.duration._

final class QuoteFlowSpec extends AnyFunSuite {
  private implicit val executionContext: ExecutionContext = ExecutionContext.parasitic
  private val id = RouteId("north")
  private val route = Route(id, 100)
  private val parcels = Vector(Parcel(ParcelId("a"), 2), Parcel(ParcelId("b"), 3))
  private val request = QuoteRequest(id, parcels)

  private final class StubRepository(answer: RouteId => Future[Option[Route]]) extends RouteRepository {
    var calls: Vector[RouteId] = Vector.empty
    override def find(id: RouteId): Future[Option[Route]] = {
      calls = calls :+ id
      answer(id)
    }
  }

  private final class StubPolicy(answer: (Route, Vector[Parcel]) => Either[QuoteError, Load])
      extends CapacityPolicy {
    var calls: Vector[(Route, Vector[Parcel])] = Vector.empty
    override def assess(route: Route, parcels: Vector[Parcel]): Either[QuoteError, Load] = {
      calls = calls :+ (route -> parcels)
      answer(route, parcels)
    }
  }

  private def result(flow: QuoteFlow, input: QuoteRequest = request): Either[QuoteError, Quote] =
    Await.result(flow.quote(input), 2.seconds)

  test("forwards the requested ID, resolved route and original parcels exactly once") {
    val resolvedRoute = Route(RouteId("canonical-north"), 100)
    val repository = new StubRepository(_ => Future.successful(Some(resolvedRoute)))
    val load = Load(73)
    val policy = new StubPolicy((_, _) => Right(load))
    val flow: QuoteFlow = new DefaultQuoteFlow(repository, policy)

    assert(result(flow) == Right(Quote(resolvedRoute.id, load)))
    assert(repository.calls == Vector(id))
    assert(policy.calls == Vector(resolvedRoute -> parcels))
    assert(policy.calls.head._1 eq resolvedRoute)
    assert(policy.calls.head._2 eq parcels)
  }

  test("unknown route is a domain refusal and never invokes the policy") {
    val repository = new StubRepository(_ => Future.successful(None))
    val policy = new StubPolicy((_, _) => fail("policy must not run for an unknown route"))
    val missing = QuoteRequest(RouteId("missing"), Vector.empty)

    assert(result(new DefaultQuoteFlow(repository, policy), missing) == Left(UnknownRoute(missing.routeId)))
    assert(repository.calls == Vector(missing.routeId))
    assert(policy.calls.isEmpty)
  }

  test("propagates the injected policy refusal without translating it") {
    val repository = new StubRepository(_ => Future.successful(Some(route)))
    val refusal = InvalidWeight(ParcelId("policy-selected"), -7)
    val policy = new StubPolicy((_, _) => Left(refusal))

    assert(result(new DefaultQuoteFlow(repository, policy)) == Left(refusal))
    assert(policy.calls == Vector(route -> parcels))
  }

  test("a failed repository future stays failed rather than becoming UnknownRoute") {
    val failure = new IllegalStateException("lookup unavailable")
    val repository = new StubRepository(_ => Future.failed(failure))
    val policy = new StubPolicy((_, _) => fail("policy must not run after lookup failure"))
    val flow = new DefaultQuoteFlow(repository, policy)

    val observed = intercept[IllegalStateException](Await.result(flow.quote(request), 2.seconds))
    assert(observed eq failure)
    assert(repository.calls == Vector(id))
    assert(policy.calls.isEmpty)
  }

  test("does not complete or invoke the policy before a controllable lookup completes") {
    val lookup = Promise[Option[Route]]()
    val repository = new StubRepository(_ => lookup.future)
    val policy = new StubPolicy((_, _) => Right(Load(19)))
    val pending = new DefaultQuoteFlow(repository, policy).quote(request)

    assert(repository.calls == Vector(id))
    assert(!pending.isCompleted)
    assert(policy.calls.isEmpty)
    lookup.success(Some(route))
    assert(Await.result(pending, 2.seconds) == Right(Quote(id, Load(19))))
    assert(policy.calls == Vector(route -> parcels))
  }

  test("a delayed lookup failure is preserved without invoking capacity") {
    val lookup = Promise[Option[Route]]()
    val failure = new IllegalArgumentException("delayed failure")
    val repository = new StubRepository(_ => lookup.future)
    val policy = new StubPolicy((_, _) => fail("policy must not run after lookup failure"))
    val pending = new DefaultQuoteFlow(repository, policy).quote(request)

    assert(!pending.isCompleted)
    lookup.failure(failure)
    assert(intercept[IllegalArgumentException](Await.result(pending, 2.seconds)) eq failure)
    assert(policy.calls.isEmpty)
  }

  test("a delayed absent route is refused only after lookup completion") {
    val lookup = Promise[Option[Route]]()
    val repository = new StubRepository(_ => lookup.future)
    val policy = new StubPolicy((_, _) => fail("policy must not run for an unknown route"))
    val pending = new DefaultQuoteFlow(repository, policy).quote(request)

    assert(!pending.isCompleted)
    lookup.success(None)
    assert(Await.result(pending, 2.seconds) == Left(UnknownRoute(id)))
    assert(policy.calls.isEmpty)
  }

  test("different injected policies determine behavior without duplicated capacity rules") {
    val unusualRoute = Route(id, 0)
    val unusualRequest = QuoteRequest(id, Vector.empty)
    val repository = new StubRepository(_ => Future.successful(Some(unusualRoute)))
    val permissive = new StubPolicy((_, _) => Right(Load(91)))
    val refusing = new StubPolicy((_, _) => Left(WeightOverflow))

    assert(result(new DefaultQuoteFlow(repository, permissive), unusualRequest) == Right(Quote(id, Load(91))))
    assert(result(new DefaultQuoteFlow(repository, refusing), unusualRequest) == Left(WeightOverflow))
    assert(permissive.calls == Vector(unusualRoute -> Vector.empty[Parcel]))
    assert(refusing.calls == Vector(unusualRoute -> Vector.empty[Parcel]))
  }

  test("separate injected repositories are used rather than a hidden shared lookup") {
    val otherRoute = Route(id, 200)
    val first = new StubRepository(_ => Future.successful(Some(route)))
    val second = new StubRepository(_ => Future.successful(Some(otherRoute)))
    val policy = new StubPolicy((r, _) => Right(Load(r.capacityGrams)))

    assert(result(new DefaultQuoteFlow(first, policy)) == Right(Quote(id, Load(100))))
    assert(result(new DefaultQuoteFlow(second, policy)) == Right(Quote(id, Load(200))))
    assert(first.calls == Vector(id))
    assert(second.calls == Vector(id))
    assert(policy.calls == Vector(route -> parcels, otherRoute -> parcels))
  }
}
