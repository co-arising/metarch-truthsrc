package example.parcel.domain

import example.parcel.domain.QuoteError._
import example.parcel.domain.ports.{CapacityPolicy, CapacityPolicyBridge}
import example.parcel.domain.values._
import org.scalatest.funsuite.AnyFunSuite

final class CapacityRuleSpec extends AnyFunSuite {
  private val routeId = RouteId("north")
  private def route(capacity: Long): Route = Route(routeId, capacity)
  private def parcel(id: String, grams: Long): Parcel = Parcel(ParcelId(id), grams)

  test("empty parcels are a distinct input refusal") {
    assert(CapacityRule.assess(route(10), Vector.empty) == Left(EmptyParcels))
  }

  test("zero and negative capacities are invalid even for a positive parcel") {
    Vector(0L, -1L, Long.MinValue).foreach { capacity =>
      assert(CapacityRule.assess(route(capacity), Vector(parcel("a", 1))) ==
        Left(InvalidCapacity(routeId, capacity)))
    }
  }

  test("invalid capacity takes precedence over empty input") {
    assert(CapacityRule.assess(route(0), Vector.empty) == Left(InvalidCapacity(routeId, 0)))
  }

  test("zero and negative weights identify the offending parcel") {
    Vector(0L, -1L, Long.MinValue).foreach { grams =>
      val bad = parcel("bad", grams)
      assert(CapacityRule.assess(route(10), Vector(parcel("a", 1), bad)) ==
        Left(InvalidWeight(bad.id, grams)))
    }
  }

  test("one positive gram fits a one gram capacity") {
    assert(CapacityRule.assess(route(1), Vector(parcel("a", 1))) == Right(Load(1)))
  }

  test("a load below capacity succeeds with the exact sum") {
    assert(CapacityRule.assess(route(100), Vector(parcel("a", 17), parcel("b", 23))) ==
      Right(Load(40)))
  }

  test("a load exactly at capacity succeeds") {
    assert(CapacityRule.assess(route(40), Vector(parcel("a", 17), parcel("b", 23))) ==
      Right(Load(40)))
  }

  test("a load one gram above capacity is refused with its total") {
    assert(CapacityRule.assess(route(39), Vector(parcel("a", 17), parcel("b", 23))) ==
      Left(OverCapacity(routeId, 40, 39)))
  }

  test("a single parcel above capacity is refused") {
    assert(CapacityRule.assess(route(1), Vector(parcel("a", 2))) ==
      Left(OverCapacity(routeId, 2, 1)))
  }

  test("repeated parcel IDs are refused even when their weights differ") {
    assert(CapacityRule.assess(route(100), Vector(parcel("a", 2), parcel("a", 3))) ==
      Left(DuplicateParcel(ParcelId("a"))))
  }

  test("duplicate identity is value based and need not be adjacent") {
    assert(CapacityRule.assess(route(100), Vector(parcel("a", 2), parcel("b", 3), parcel("a", 4))) ==
      Left(DuplicateParcel(ParcelId("a"))))
  }

  test("different IDs may have equal weights") {
    assert(CapacityRule.assess(route(10), Vector(parcel("a", 3), parcel("b", 3))) ==
      Right(Load(6)))
  }

  test("Long.MaxValue is a valid single weight and capacity") {
    assert(CapacityRule.assess(route(Long.MaxValue), Vector(parcel("a", Long.MaxValue))) ==
      Right(Load(Long.MaxValue)))
  }

  test("a sum exactly at Long.MaxValue does not overflow") {
    assert(CapacityRule.assess(route(Long.MaxValue),
      Vector(parcel("a", Long.MaxValue - 1), parcel("b", 1))) == Right(Load(Long.MaxValue)))
  }

  test("Long.MaxValue plus one is an overflow rather than a wrapped success") {
    assert(CapacityRule.assess(route(Long.MaxValue),
      Vector(parcel("a", Long.MaxValue), parcel("b", 1))) == Left(WeightOverflow))
  }

  test("overflow at a later addition is refused before comparing capacity") {
    assert(CapacityRule.assess(route(1),
      Vector(parcel("a", Long.MaxValue - 1), parcel("b", 1), parcel("c", 1))) ==
      Left(WeightOverflow))
  }

  test("a representable large total over capacity is not an overflow") {
    assert(CapacityRule.assess(route(Long.MaxValue - 1), Vector(parcel("a", Long.MaxValue))) ==
      Left(OverCapacity(routeId, Long.MaxValue, Long.MaxValue - 1)))
  }

  test("duplicate validation precedes adding that parcel's weight") {
    assert(CapacityRule.assess(route(Long.MaxValue),
      Vector(parcel("a", Long.MaxValue), parcel("a", 1))) == Left(DuplicateParcel(ParcelId("a"))))
  }

  test("calls do not retain previous IDs or totals") {
    val parcels = Vector(parcel("a", 2), parcel("b", 3))
    assert(CapacityRule.assess(route(5), parcels) == Right(Load(5)))
    assert(CapacityRule.assess(route(4), parcels) == Left(OverCapacity(routeId, 5, 4)))
    assert(CapacityRule.assess(route(5), parcels) == Right(Load(5)))
  }

  test("the bridge implements the port and preserves success and each refusal") {
    val bridge: CapacityPolicy = new CapacityPolicyBridge
    val cases: Vector[(Route, Vector[Parcel], Either[QuoteError, Load])] = Vector(
      (route(5), Vector(parcel("a", 2), parcel("b", 3)), Right(Load(5))),
      (route(5), Vector.empty, Left(EmptyParcels)),
      (route(0), Vector(parcel("a", 1)), Left(InvalidCapacity(routeId, 0))),
      (route(5), Vector(parcel("a", 0)), Left(InvalidWeight(ParcelId("a"), 0))),
      (route(5), Vector(parcel("a", 1), parcel("a", 2)), Left(DuplicateParcel(ParcelId("a")))),
      (route(4), Vector(parcel("a", 5)), Left(OverCapacity(routeId, 5, 4))),
      (route(Long.MaxValue), Vector(parcel("a", Long.MaxValue), parcel("b", 1)), Left(WeightOverflow))
    )
    cases.foreach { case (r, parcels, expected) =>
      assert(bridge.assess(r, parcels) == expected)
    }
  }
}
