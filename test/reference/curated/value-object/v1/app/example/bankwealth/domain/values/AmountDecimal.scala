package example.bankwealth.domain.values

final case class AmountDecimal(value: BigDecimal) {
  AmountDecimal.checkedAmount(value)
  def isPositive: Boolean = value > 0
  def compareSameUnit(other: AmountDecimal): Int = { value.compare(other.value) }
  def plus(other: AmountDecimal): AmountDecimal = { AmountDecimal(AmountDecimal.checkedAmount(AmountDecimal.checkedAmount(value) + AmountDecimal.checkedAmount(other.value))) }
  def minus(other: AmountDecimal): AmountDecimal = { AmountDecimal(AmountDecimal.checkedAmount(AmountDecimal.checkedAmount(value) - AmountDecimal.checkedAmount(other.value))) }
}
object AmountDecimal {
  def checkedAmount(value: BigDecimal): BigDecimal = {
    require(value != null, "exact amount is required")
    val scaled = value.bigDecimal.setScale(2, java.math.RoundingMode.UNNECESSARY)
    require(scaled.precision <= 38, "exact precision exceeded")
    new scala.math.BigDecimal(scaled, java.math.MathContext.UNLIMITED)
  }
}
