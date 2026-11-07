package example.counter.domain.values

final case class Distance(amount: BigDecimal, unit: String) {
  Distance.checkedAmount(amount)
  require(Set("m", "km").contains(unit), "unsupported exact unit")

  def isPositive: Boolean = amount > 0

  def compareSameUnit(other: Distance): Int = {
    require(unit == other.unit, "exact units differ")
    amount.compare(other.amount)
  }

  def plus(other: Distance): Distance = {
    require(unit == other.unit, "exact units differ")
    Distance(Distance.checkedAmount(amount) + Distance.checkedAmount(other.amount), unit)
  }

  def minus(other: Distance): Distance = {
    require(unit == other.unit, "exact units differ")
    Distance(Distance.checkedAmount(amount) - Distance.checkedAmount(other.amount), unit)
  }
}

object Distance {
  def checkedAmount(value: BigDecimal): BigDecimal = {
    require(value != null, "exact amount is required")
    val scaled = value.bigDecimal.setScale(0, java.math.RoundingMode.UNNECESSARY)
    require(scaled.precision <= 38, "exact precision exceeded")
    new scala.math.BigDecimal(scaled, java.math.MathContext.UNLIMITED)
  }
}
