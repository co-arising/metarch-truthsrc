package example.counter.domain.values

final case class Ratio(value: BigDecimal) {
  Ratio.checkedAmount(value)

  def isPositive: Boolean = value > 0

  def compareSameUnit(other: Ratio): Int = value.compare(other.value)

  def plus(other: Ratio): Ratio =
    Ratio(Ratio.checkedAmount(value) + Ratio.checkedAmount(other.value))

  def minus(other: Ratio): Ratio =
    Ratio(Ratio.checkedAmount(value) - Ratio.checkedAmount(other.value))
}

object Ratio {
  def checkedAmount(value: BigDecimal): BigDecimal = {
    require(value != null, "exact amount is required")
    val scaled = value.bigDecimal.setScale(38, java.math.RoundingMode.UNNECESSARY)
    require(scaled.precision <= 38, "exact precision exceeded")
    new scala.math.BigDecimal(scaled, java.math.MathContext.UNLIMITED)
  }
}
