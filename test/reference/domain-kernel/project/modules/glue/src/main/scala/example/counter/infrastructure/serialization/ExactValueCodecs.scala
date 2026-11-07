package example.counter.infrastructure.serialization

import example.counter.domain.values._

object ExactValueCodecs {
  private def coefficient(text: String): java.math.BigInteger = {
    require(text != null && text.length <= 40, "canonical exact text is required")
    require(text.matches("-?(0|[1-9][0-9]*)") && text != "-0", "noncanonical exact text")
    val digits = if (text.startsWith("-")) text.length - 1 else text.length
    require(digits <= 38, "exact precision exceeded")
    new java.math.BigInteger(text)
  }

  object RatioCodec {
    def toWire(value: Ratio): WireRatio =
      WireRatio(Ratio.checkedAmount(value.value).bigDecimal.unscaledValue.toString)

    def fromWire(value: WireRatio): Ratio = {
      val decimal = new java.math.BigDecimal(coefficient(value.value), 38)
      Ratio(new scala.math.BigDecimal(decimal, java.math.MathContext.UNLIMITED))
    }

    def toPo(value: Ratio): PoRatio =
      PoRatio(Ratio.checkedAmount(value.value).bigDecimal.unscaledValue.toString)

    def fromPo(value: PoRatio): Ratio = {
      val decimal = new java.math.BigDecimal(coefficient(value.value), 38)
      Ratio(new scala.math.BigDecimal(decimal, java.math.MathContext.UNLIMITED))
    }
  }

  object DistanceCodec {
    def toWire(value: Distance): WireDistance =
      WireDistance(Distance.checkedAmount(value.amount).bigDecimal.toPlainString, value.unit)

    def fromWire(value: WireDistance): Distance = {
      val decimal = new java.math.BigDecimal(coefficient(value.wAmount), 0)
      Distance(new scala.math.BigDecimal(decimal, java.math.MathContext.UNLIMITED), value.wUnit)
    }

    def toPo(value: Distance): PoDistance =
      PoDistance(Distance.checkedAmount(value.amount).bigDecimal.toPlainString, value.unit)

    def fromPo(value: PoDistance): Distance = {
      val decimal = new java.math.BigDecimal(coefficient(value.pAmount), 0)
      Distance(new scala.math.BigDecimal(decimal, java.math.MathContext.UNLIMITED), value.pUnit)
    }
  }
}
