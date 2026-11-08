package example.counter.reference

import example.counter.domain.{CounterProtocol, CounterState}
import example.counter.domain.command.CounterCommandHelpers
import example.counter.domain.entities.behaviors.CounterEventHandler
import example.counter.domain.invariant.CounterRules
import example.counter.domain.ports.CounterComputations
import example.counter.domain.values.{Distance, Ratio, Reading}
import org.scalatest.funsuite.AnyFunSuite

final class AggregateOperationsSpec extends AnyFunSuite {
  private val initial = CounterState.empty
  private val ratio = Ratio(BigDecimal("0.12500000000000000000000000000000000000"))
  private val delta = Ratio(BigDecimal("0.25000000000000000000000000000000000000"))
  private val distance = Distance(BigDecimal("2"), "m")
  private val reading = initial.reading.copy(label = "left-sentinel", note = "right-sentinel")
  private def command(id: String = "ops") = CounterProtocol.SetCount(id, 17L, reading, "key", Vector("key", "key", "new"), delta, distance)
  private def event = CounterProtocol.CountSet("ops", 17L, reading, ratio, "key", Vector("key", "key", "new"), delta, distance)

  test("all seven fold forms read the same pre-event state and preserve distinct values") {
    val next = CounterEventHandler(initial, event)
    assert(next.id == "ops")
    assert(next.count == 17L)
    assert(next.reading == reading)
    assert(next.accepted == ratio)
    assert(next.removed == Map("old" -> "retained"))
    assert(next.put == Map("old" -> "retained", "key" -> "new"))
    assert(next.putAll == Map("old" -> "retained", "key" -> "bulk", "new" -> "bulk"))
    assert(next.removeAll == Map("old" -> "retained"))
    assert(next.oldValue == Some("before"))
    assert(next.ratioTotal == Ratio(BigDecimal("0.50000000000000000000000000000000000000")))
    assert(next.distanceTotal == Distance(BigDecimal("10"), "m"))
    assert(next.minimum == Long.MinValue + 1L)
    assert(next.maximum == Long.MaxValue)
    assert(next.left == 29L && next.right == 11L)
    assert(initial.removed == Map("old" -> "retained", "key" -> "before"))
    assert(initial.left == 11L && initial.right == 29L)
  }

  test("the second event with no assignments leaves state unchanged") {
    val next = CounterEventHandler(initial, CounterProtocol.CountRecorded("ignored"))
    assert(next eq initial)
  }

  test("a complete decision produces two ordered facts and calls the host with actual inputs once") {
    var calls = 0
    val hosts = new CounterComputations {
      def acceptedRatio(actualReading: Reading, count: Long, minimum: Long): Ratio = {
        assert(actualReading == reading)
        assert(count == 17L)
        assert(minimum == Long.MinValue)
        calls += 1
        ratio
      }
    }
    assert(CounterRules.decide(initial, command(), hosts) == Right(Vector(event, CounterProtocol.CountRecorded("ops"))))
    assert(calls == 1)
    assert(initial.count == -7L)
  }

  test("an early rejection never evaluates the host or emits the later event") {
    val hosts = new CounterComputations {
      def acceptedRatio(actualReading: Reading, count: Long, minimum: Long): Ratio =
        throw new AssertionError("rejected decision evaluated host")
    }
    assert(CounterRules.decide(initial, command(""), hosts) == Left("EMPTY_ID"))
  }

  test("unit mismatch fails without publishing a partially updated pure state") {
    intercept[IllegalArgumentException] {
      CounterEventHandler(initial, event.copy(distance = Distance(BigDecimal("2"), "km")))
    }
    assert(initial.id == "counter-default" && initial.count == -7L)
    assert(initial.distanceTotal == Distance(BigDecimal("12"), "m"))
  }

  test("signed-64 overflow fails before pure State.copy can return a result") {
    val max = initial.copy(minimum = Long.MaxValue)
    intercept[ArithmeticException] { CounterEventHandler(max, event) }
    assert(max.minimum == Long.MaxValue && max.left == 11L)
  }

  test("scalar exact overflow is checked without rounding or a floating conversion") {
    val max = initial.copy(ratioTotal = Ratio(BigDecimal("0.99999999999999999999999999999999999999")))
    intercept[IllegalArgumentException] { CounterEventHandler(max, event) }
    assert(max.ratioTotal.value.toString == "0.99999999999999999999999999999999999999")
  }

  test("host failures remain technical failures instead of becoming successful empty decisions") {
    val failure = new IllegalStateException("explicit host failure")
    val hosts = new CounterComputations {
      def acceptedRatio(actualReading: Reading, count: Long, minimum: Long): Ratio = throw failure
    }
    assert(intercept[IllegalStateException] { CounterRules.decide(initial, command(), hosts) } eq failure)
  }
}
