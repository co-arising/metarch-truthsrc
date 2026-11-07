package example.counter.domain

import example.counter.domain.values._

final case class CounterState(
  id: String = "counter-default",
  count: Long = -7L,
  minimum: Long = -9223372036854775808L,
  maximum: Long = 9223372036854775807L,
  reading: Reading = Reading(
    label = "left-default",
    note = "right-default",
    ratio = Ratio(BigDecimal("0.12500000000000000000000000000000000000")),
    distance = Distance(BigDecimal("-12"), "m"),
    maybe = Some(None),
    samples = Vector(Some(-9223372036854775808L), None, Some(9223372036854775807L)),
    ratios = Map("base" -> Ratio(BigDecimal("0.50000000000000000000000000000000000000")))
  ),
  accepted: Ratio = Ratio(BigDecimal("0.25000000000000000000000000000000000000"))
)

object CounterState {
  val empty: CounterState = CounterState()
}
