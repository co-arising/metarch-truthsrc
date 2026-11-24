package example.bankwealth.infrastructure.serialization

import example.bankwealth.domain._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.{proto => pb}
object DomainConverters extends DomainConvertersPart0 with DomainConvertersPart1 with DomainConvertersPart2 with DomainConvertersPart3 {
  protected def req[A](value: Option[A]): A =
    value.getOrElse(throw new IllegalArgumentException("required typed value missing"))

  protected def fixed(value: BigDecimal, scale: Int): String =
    value.bigDecimal.setScale(scale, java.math.RoundingMode.UNNECESSARY).toPlainString

  protected def readExact(value: String, scale: Int, minor: Boolean): BigDecimal = {
    require(value != null && value.length <= 80, "bounded exact text required")
    val pattern = if (minor || scale == 0) "-?(0|[1-9][0-9]*)" else "-?(0|[1-9][0-9]*)\\.[0-9]{" + scale + "}"
    require(value.matches(pattern) && !(value.startsWith("-") && BigDecimal(value) == 0), "noncanonical exact text")
    if (minor) BigDecimal(new java.math.BigDecimal(new java.math.BigInteger(value), scale)) else BigDecimal(value)
  }
}
