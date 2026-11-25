package example.bankwealth.application.readmodels

import example.bankwealth.domain.values.{AccountId, FundOrderId, OperationId, TaRequestId, TxId}
import example.bankwealth.interfaces.api.ApiWire.MoneyWire

object ReadModelViews {
  final case class BankOrderView(
    orderId: FundOrderId,
    operationId: OperationId,
    investorAccountId: AccountId,
    fundCollectionAccountId: AccountId,
    fundCode: String,
    amount: MoneyWire,
    paymentTxId: Option[TxId],
    paymentStatus: String,
    taRequestId: Option[TaRequestId],
    taStatus: String,
    taReference: Option[String],
    taShares: Option[BankTaSharesView],
    taRejectionReason: Option[String],
    refundOperationId: Option[OperationId],
    refundStatus: String
  )
}
