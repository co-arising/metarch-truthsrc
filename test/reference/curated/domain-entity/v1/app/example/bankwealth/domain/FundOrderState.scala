package example.bankwealth.domain

import example.bankwealth.domain.values._

final case class FundOrderState(
  id: FundOrderId,
  status: String,
  operationId: OperationId,
  investorAccountId: AccountId,
  fundCollectionAccountId: AccountId,
  fundCode: String,
  amount: Money,
  reservedSubscriptions: Map[TxId, Money],
  committedSubscriptions: Map[TxId, Money],
  compensatedSubscriptions: Map[TxId, Money],
  selectedPaymentTxId: TxId,
  paymentOutcome: String,
  cashPaymentResults: Map[TxId, String],
  cashPaymentFinalResults: Map[TxId, String],
  taRequestId: TaRequestId,
  taReference: String,
  taStatus: String,
  taReceipts: Map[String, String],
  taReceiptOutcomes: Map[String, String],
  taConfirmedShares: FundShare,
  taRejectionReason: String,
  refundOperationId: OperationId,
  refundOutcome: String,
  refundResultReceipts: Map[String, String],
  refundFinalResults: Map[TxId, String],
  taObservedReceipts: Map[String, String],
  paymentObservedResults: Map[TxId, String],
  refundObservedResults: Map[TxId, String],
  cashRequestSource: Option[BankCashOriginal],
  cashRequestOriginals: Map[String, BankCashOriginal]
)

object FundOrderState {
  def empty: FundOrderState = example.bankwealth.domain.entities.FundOrderEntity.empty
}
