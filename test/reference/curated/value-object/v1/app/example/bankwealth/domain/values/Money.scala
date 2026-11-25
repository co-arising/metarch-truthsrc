package example.bankwealth.domain.values

import net.imadz.common.CommonTypes.iMadzError

sealed abstract case class Money private (amount: BigDecimal, currency: String) {
  def isPositive: Boolean = amount > 0
  def compareSameUnit(other: Money): Either[iMadzError, Int] =
    if (currency == other.currency) Right(amount.compare(other.amount)) else Left(iMadzError("EXACT_UNIT_MISMATCH", "exact units differ"))
  def plus(other: Money): Either[iMadzError, Money] =
    if (currency != other.currency) Left(iMadzError("EXACT_UNIT_MISMATCH", "exact units differ"))
    else for {
      lhs <- Money.checkedAmount(amount)
      rhs <- Money.checkedAmount(other.amount)
      result <- Money.checkedAmount(lhs + rhs)
    } yield new Money(result, currency) {}
  def minus(other: Money): Either[iMadzError, Money] =
    if (currency != other.currency) Left(iMadzError("EXACT_UNIT_MISMATCH", "exact units differ"))
    else for {
      lhs <- Money.checkedAmount(amount)
      rhs <- Money.checkedAmount(other.amount)
      result <- Money.checkedAmount(lhs - rhs)
    } yield new Money(result, currency) {}
}
object Money {
  val SupportedUnits: Set[String] = Set("CNY")
  val Zero: Money = new Money(BigDecimal("0.00"), "CNY") {}
  def create(amount: BigDecimal, currency: String): Either[iMadzError, Money] =
    if (!SupportedUnits.contains(currency)) Left(iMadzError("EXACT_UNIT_UNSUPPORTED", "unsupported exact unit"))
    else checkedAmount(amount).map(a => new Money(a, currency) {})
  def checkedAmount(value: BigDecimal): Either[iMadzError, BigDecimal] = {
    val stripped = value.bigDecimal.stripTrailingZeros()
    if (stripped.scale() > 2) Left(iMadzError("EXACT_SCALE_EXCEEDED", "exact scale exceeded"))
    else {
      val scaled = stripped.setScale(2, java.math.RoundingMode.UNNECESSARY)
      if (scaled.precision() > 38) Left(iMadzError("EXACT_PRECISION_EXCEEDED", "exact precision exceeded"))
      else Right(new scala.math.BigDecimal(scaled, java.math.MathContext.UNLIMITED))
    }
  }
}
