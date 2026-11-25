package example.bankwealth.infrastructure.persistence.converters

import example.bankwealth.domain.entities._
import example.bankwealth.application.connectors.BankSipDispatchProtocol._
import example.bankwealth.application.connectors.BankTaEffectProtocol._
import example.bankwealth.application.process.protocol.BankPaymentMessages._
import example.bankwealth.application.process.protocol.BankRefundMessages._
import example.bankwealth.application.process.protocol.CreditFundCollectionStep._
import example.bankwealth.application.process.protocol.CreditOriginalInvestorStep._
import example.bankwealth.application.process.protocol.DebitFundCollectionStep._
import example.bankwealth.application.process.protocol.ReserveCashFundOrderStep._
import example.bankwealth.application.process.protocol.ReserveInvestorFundsStep._
import example.bankwealth.application.readmodels.ReadModelViews._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.persistence._
import example.bankwealth.interfaces.api.ApiAcknowledgements._
import example.bankwealth.interfaces.api.ApiCommands._
import example.bankwealth.interfaces.api.ApiKeys._
import example.bankwealth.interfaces.api.ApiResponses._
import example.bankwealth.interfaces.api.ApiWire._
import example.bankwealth.infrastructure.{proto => pb}
import net.imadz.common.serialization.PrimitiveConverter
object DomainConverters extends SharedValueProtoConverters with CreditBalanceProtoConverters with FundOrderProtoConverters with SipPlanProtoConverters
