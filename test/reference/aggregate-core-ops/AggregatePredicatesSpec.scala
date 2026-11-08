package example.counter.reference

import _root_.params.counter.domain.{CounterProtocol, CounterState}
import _root_.params.counter.domain.invariant.CounterRules
import _root_.params.counter.domain.invariant.params.CounterRuleParams.CheckAllEqualParams
import _root_.params.counter.domain.ports.CounterComputations
import _root_.params.counter.domain.values.{Distance, Ratio, Reading, Text}
import org.scalatest.funsuite.AnyFunSuite

// Independent fixed expectations for aggregate-core-predicate-variants.mjs.
// No renderer, JS evaluator or generated test computes these expected results.
final class AggregatePredicatesSpec extends AnyFunSuite {
  private val initial = CounterState.empty
  private val quarter = Ratio(BigDecimal("0.25000000000000000000000000000000000000"))
  private val half = Ratio(BigDecimal("0.50000000000000000000000000000000000000"))
  private val metre = Distance(BigDecimal("2"), "m")
  private val neverHosts = new CounterComputations {
    def acceptedRatio(reading: Reading, count: Long, minimum: Long): Ratio =
      throw new AssertionError("predicate probe evaluated a host")
  }
  private def decide(command: CounterProtocol.Command, state: CounterState = initial): Either[String, Vector[CounterProtocol.Event]] =
    CounterRules.decide(state, command, neverHosts)
  private val passed: Either[String, Vector[CounterProtocol.Event]] = Right(Vector(CounterProtocol.CountRecorded("probe")))

  test("early empty precedes overflowing guards and all host inputs") {
    val empty = CounterProtocol.SetCount("empty", Long.MaxValue, null, "key", null, null, null)
    assert(decide(empty) == Right(Vector.empty))
    assert(decide(empty.copy(id = "")) == Left("EMPTY_ID"))
    intercept[ArithmeticException] { decide(empty.copy(id = "overflow")) }
    assert(initial.count == -7L && initial.firstCount == 11L && initial.right == 29L)
  }

  test("nested Boolean equality and mixed and-or keep their authored grouping") {
    assert(decide(CounterProtocol.CheckBoolean("probe", true, false, false)) == passed)
    assert(decide(CounterProtocol.CheckBoolean("probe", false, true, false)) == Left("BOOLEAN_PRECEDENCE"))
    assert(decide(CounterProtocol.CheckBoolean("probe", true, false, true)) == Left("BOOLEAN_LEFT"))
  }

  test("Long comparison operands of Boolean equality remain parenthesized") {
    assert(decide(CounterProtocol.CheckComparison("probe", 17L, true)) == passed)
    assert(decide(CounterProtocol.CheckComparison("probe", Long.MaxValue, false)) == passed)
    assert(decide(CounterProtocol.CheckComparison("probe", Long.MaxValue, true)) == Left("COMPARISON_RIGHT"))
  }

  test("signed-64 endpoints succeed and intermediate overflow is not a business refusal") {
    val neutral = initial.copy(firstCount = 0L, right = 0L)
    assert(decide(CounterProtocol.CheckLong("probe", Long.MinValue), neutral) == passed)
    assert(decide(CounterProtocol.CheckLong("probe", Long.MaxValue), neutral) == passed)
    intercept[ArithmeticException] { decide(CounterProtocol.CheckLong("probe", Long.MaxValue)) }
    intercept[ArithmeticException] { decide(CounterProtocol.CheckLong("probe", Long.MinValue)) }
    assert(decide(CounterProtocol.CheckLong("probe", 17L), initial.copy(firstCount = -30L, right = 1L)) == Left("LONG_MATH"))
  }

  test("scalar exact arithmetic preserves the thirty-eighth digit and checks precision") {
    val amount = Ratio(BigDecimal("0.12345678901234567890123456789012345678"))
    val equal = initial.copy(ratioTotal = Ratio(BigDecimal("0.32345678901234567890123456789012345678")))
    assert(decide(CounterProtocol.CheckScalar("probe", amount), equal) == passed)
    val above = initial.copy(ratioTotal = Ratio(BigDecimal("0.32345678901234567890123456789012345679")))
    assert(decide(CounterProtocol.CheckScalar("probe", amount), above) == Left("SCALAR_MATH"))
    intercept[IllegalArgumentException] {
      decide(CounterProtocol.CheckScalar("probe", Ratio(BigDecimal("0.99999999999999999999999999999999999999"))))
    }
  }

  test("unit nominal arithmetic checks both units and every intermediate precision") {
    assert(decide(CounterProtocol.CheckUnit("probe", metre)) == passed)
    intercept[IllegalArgumentException] { decide(CounterProtocol.CheckUnit("probe", Distance(BigDecimal("2"), "km"))) }
    val max = Distance(BigDecimal("99999999999999999999999999999999999999"), "m")
    intercept[IllegalArgumentException] { decide(CounterProtocol.CheckUnit("probe", max), initial.copy(distanceTotal = Distance(BigDecimal("1"), "m"))) }
    assert(initial.distanceTotal == Distance(BigDecimal("12"), "m"))
  }

  test("amount projections retain containing units and checked intermediate amounts") {
    val state = initial.copy(distanceTotal = metre)
    assert(decide(CounterProtocol.CheckAmount("probe", metre), state) == passed)
    assert(decide(CounterProtocol.CheckAmount("probe", metre)) == Left("AMOUNT_MATH"))
    intercept[IllegalArgumentException] { decide(CounterProtocol.CheckAmount("probe", Distance(BigDecimal("2"), "km")), state) }
    val max = Distance(BigDecimal("99999999999999999999999999999999999999"), "m")
    intercept[IllegalArgumentException] { decide(CounterProtocol.CheckAmount("probe", max), state) }
  }

  test("nominal structural equality is distinct from unit-aware amount equality") {
    val state = initial.copy(distanceTotal = metre)
    assert(decide(CounterProtocol.CheckStructural("probe", metre, quarter), state) == passed)
    assert(decide(CounterProtocol.CheckStructural("probe", Distance(BigDecimal("2"), "km"), quarter), state) == Left("STRUCTURAL_DISTANCE"))
    assert(decide(CounterProtocol.CheckStructural("probe", metre, half), state) == Left("STRUCTURAL_RATIO"))
    assert(decide(CounterProtocol.CheckAmountEquality("probe", metre), state) == passed)
    assert(decide(CounterProtocol.CheckAmountEquality("probe", Distance(BigDecimal("3"), "m")), state) == Left("AMOUNT_EQUAL"))
    intercept[IllegalArgumentException] { decide(CounterProtocol.CheckAmountEquality("probe", Distance(BigDecimal("2"), "km")), state) }
  }

  test("dominating map guards skip absent lookups and optional comparisons") {
    assert(decide(CounterProtocol.CheckMap("probe", initial.reading.copy(index = Map.empty), null)) == passed)
    assert(decide(CounterProtocol.CheckMap("probe", initial.reading.copy(index = Map("probe" -> quarter)), quarter)) == passed)
    assert(decide(CounterProtocol.CheckMap("probe", initial.reading.copy(index = Map("probe" -> half)), quarter)) == Left("MAP_OPTION"))
    assert(decide(CounterProtocol.CheckMap("probe", initial.reading.copy(index = Map("probe" -> quarter)), half)) == Left("MAP_LOOKUP"))
  }

  test("map-get preserves Some-None instead of collapsing a nested optional") {
    assert(decide(CounterProtocol.CheckNestedOptional("none", None)) == Right(Vector(CounterProtocol.CountRecorded("none"))))
    assert(decide(CounterProtocol.CheckNestedOptional("some", Some("x"))) == Right(Vector(CounterProtocol.CountRecorded("some"))))
    assert(decide(CounterProtocol.CheckNestedOptional("missing", None)) == Left("NESTED_OPTION"))
    assert(decide(CounterProtocol.CheckNestedOptional("some", None)) == Left("NESTED_OPTION"))
  }

  test("nominal Text extraction uses its admitted scalar accessor") {
    assert(decide(CounterProtocol.CheckText("probe", Text("x-sentinel"))) == passed)
    assert(decide(CounterProtocol.CheckText("probe", Text(""))) == Left("TEXT"))
    assert(decide(CounterProtocol.CheckText("probe", Text("abc"))) == Left("TEXT"))
    intercept[NullPointerException] { decide(CounterProtocol.CheckText("probe", Text(null))) }
  }

  test("empty all-equal skips the null command while nonempty reads its RHS") {
    assert(CounterRules.checkAllEqual(CheckAllEqualParams(initial, null, neverHosts)) == Right(Vector.empty))
    val nonempty = initial.copy(guardKeys = Map("probe" -> "v"))
    intercept[NullPointerException] { CounterRules.checkAllEqual(CheckAllEqualParams(nonempty, null, neverHosts)) }
    assert(decide(CounterProtocol.CheckAllEqual("probe"), nonempty) == Right(Vector.empty))
    assert(decide(CounterProtocol.CheckAllEqual("different"), nonempty) == Left("ALL_EQUAL"))
  }

  test("collection coverage accepts duplicates and empty input but evaluates both operands") {
    val state = initial.copy(guardKeys = Map("a" -> "first", "b" -> "second"))
    assert(decide(CounterProtocol.CheckCovered("probe", Vector("a", "a", "b")), state) == passed)
    assert(decide(CounterProtocol.CheckCovered("probe", Vector.empty)) == passed)
    assert(decide(CounterProtocol.CheckCovered("probe", Vector("a", "missing")), state) == Left("COVERED"))
    intercept[NullPointerException] { decide(CounterProtocol.CheckCovered("probe", null)) }
  }

  test("exact positivity short-circuits later nominal operands") {
    assert(decide(CounterProtocol.CheckPositive("probe", quarter, metre)) == passed)
    assert(decide(CounterProtocol.CheckPositive("probe", Ratio(BigDecimal("0")), null)) == Left("POSITIVE_SCALAR"))
    assert(decide(CounterProtocol.CheckPositive("probe", quarter, Distance(BigDecimal("0"), "m"))) == Left("POSITIVE_UNIT"))
  }

  test("sufficient balances reject absence but mismatched present units remain technical failures") {
    assert(decide(CounterProtocol.CheckSufficient("probe", metre)) == Left("SUFFICIENT_UNIT"))
    val enough = initial.copy(balances = Map("m" -> Distance(BigDecimal("3"), "m")))
    assert(decide(CounterProtocol.CheckSufficient("probe", metre), enough) == passed)
    assert(decide(CounterProtocol.CheckSufficient("probe", Distance(BigDecimal("4"), "m")), enough) == Left("SUFFICIENT_UNIT"))
    val mismatched = initial.copy(balances = Map("m" -> Distance(BigDecimal("3"), "km")))
    intercept[IllegalArgumentException] { decide(CounterProtocol.CheckSufficient("probe", metre), mismatched) }
    assert(decide(CounterProtocol.CheckScalarSufficient("probe", quarter)) == passed)
    assert(decide(CounterProtocol.CheckScalarSufficient("probe", half)) == Left("SUFFICIENT_SCALAR"))
  }

  test("successful host occurrence and nominal literal emission use fixed independent values") {
    var calls = 0
    val reading = initial.reading.copy(label = "left-sentinel", note = "right-sentinel")
    val hosts = new CounterComputations {
      def acceptedRatio(actual: Reading, count: Long, minimum: Long): Ratio = {
        assert(actual == reading && count == 17L && minimum == Long.MinValue)
        calls += 1
        half
      }
    }
    val command = CounterProtocol.SetCount("probe", 17L, reading, "key", Vector("key", "key"), quarter, metre)
    val event = CounterProtocol.CountSet("probe", 17L, reading, half, "key", Vector("key", "key"), quarter, metre,
      Ratio(BigDecimal("0.12500000000000000000000000000000000000")))
    assert(CounterRules.decide(initial, command, hosts) == Right(Vector(event, CounterProtocol.CountRecorded("probe"))))
    assert(calls == 1)
    assert(initial.count == -7L && initial.reading.label == "left-default")
  }
}
