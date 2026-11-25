package example.bankwealth.domain.values

import net.imadz.common.CommonTypes.iMadzError

final case class AmountDecimal(value: BigDecimal) {
  def isPositive: Boolean = value > 0
  def compareSameUnit(other: AmountDecimal): Either[iMadzError, Int] =
    Right(value.compare(other.value))
  def plus(other: AmountDecimal): Either[iMadzError, AmountDecimal] =
    for {
      lhs <- AmountDecimal.checkedAmount(value)
      rhs <- AmountDecimal.checkedAmount(other.value)
      result <- AmountDecimal.checkedAmount(lhs + rhs)
    } yield AmountDecimal(result)
  def minus(other: AmountDecimal): Either[iMadzError, AmountDecimal] =
    for {
      lhs <- AmountDecimal.checkedAmount(value)
      rhs <- AmountDecimal.checkedAmount(other.value)
      result <- AmountDecimal.checkedAmount(lhs - rhs)
    } yield AmountDecimal(result)
}
object AmountDecimal {
  def create(value: BigDecimal): Either[iMadzError, AmountDecimal] =
    checkedAmount(value).map(AmountDecimal(_))
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
