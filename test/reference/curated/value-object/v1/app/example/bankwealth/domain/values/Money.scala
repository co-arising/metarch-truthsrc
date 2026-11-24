package example.bankwealth.domain.values

final case class Money(amount: BigDecimal, currency: String) {
  Money.checkedAmount(amount)
  require(Set("CNY").contains(currency), "unsupported exact unit")
  def isPositive: Boolean = amount > 0
  def compareSameUnit(other: Money): Int = { require(currency == other.currency, "exact units differ"); amount.compare(other.amount) }
  def plus(other: Money): Money = { require(currency == other.currency, "exact units differ"); Money(Money.checkedAmount(Money.checkedAmount(amount) + Money.checkedAmount(other.amount)), currency) }
  def minus(other: Money): Money = { require(currency == other.currency, "exact units differ"); Money(Money.checkedAmount(Money.checkedAmount(amount) - Money.checkedAmount(other.amount)), currency) }
}
object Money {
  def checkedAmount(value: BigDecimal): BigDecimal = {
    require(value != null, "exact amount is required")
    val scaled = value.bigDecimal.setScale(2, java.math.RoundingMode.UNNECESSARY)
    require(scaled.precision <= 38, "exact precision exceeded")
    new scala.math.BigDecimal(scaled, java.math.MathContext.UNLIMITED)
  }
}
