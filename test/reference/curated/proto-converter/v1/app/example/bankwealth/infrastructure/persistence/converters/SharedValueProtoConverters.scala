package example.bankwealth.infrastructure.persistence.converters

import example.bankwealth.domain.entities._
import example.bankwealth.application.connectors.BankSipDispatchProtocol._
import example.bankwealth.application.connectors.BankTaEffectProtocol._
import example.bankwealth.application.process.BankPaymentMessages._
import example.bankwealth.application.process.BankRefundMessages._
import example.bankwealth.application.process.CreditFundCollectionStep._
import example.bankwealth.application.process.CreditOriginalInvestorStep._
import example.bankwealth.application.process.DebitFundCollectionStep._
import example.bankwealth.application.process.ReserveCashFundOrderStep._
import example.bankwealth.application.process.ReserveInvestorFundsStep._
import example.bankwealth.application.projection._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.persistence._
import example.bankwealth.interfaces.api.ApiAcknowledgements._
import example.bankwealth.interfaces.api.ApiCommands._
import example.bankwealth.interfaces.api.ApiKeys._
import example.bankwealth.interfaces.api.ApiResponses._
import example.bankwealth.interfaces.api.ApiWire._
import example.bankwealth.infrastructure.{proto => pb}
import net.imadz.common.serialization.PrimitiveConverter
trait SharedValueProtoConverters extends PrimitiveConverter with SharedValueGroup0ProtoConverters with SharedValueGroup1ProtoConverters {
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
