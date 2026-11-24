package example.bankwealth.domain.invariants.params

import example.bankwealth.domain.values._

object FundOrderRuleParams {
  final case class RequestFundPurchaseSettlementParams(
    operationId: OperationId,
    fundOrderId: FundOrderId,
    investorAccountId: AccountId,
    fundCollectionAccountId: AccountId,
    fundCode: String,
    amount: Money
  )
  final case class ReserveFundSubscriptionParams(txid: TxId, resource: FundOrderId, amount: Money)
  final case class ConfirmFundSubscriptionPaymentParams(txid: TxId, resource: FundOrderId, amount: Money)
  final case class CancelCashFundSubscriptionParams(txid: TxId, resource: FundOrderId, amount: Money)
  final case class RecordFundCashPaymentSucceededParams(txid: TxId)
  final case class RecordFundCashPaymentRejectedBeforeEffectsParams(txid: TxId)
  final case class RecordFundCashPaymentCompensatedParams(txid: TxId)
  final case class RecordFundCashPaymentRecoveryRequiredParams(txid: TxId)
  final case class RecordFundCashPaymentOutcomeUnknownParams(txid: TxId)
  final case class RegisterFundTASubmissionParams(fundOrderId: FundOrderId, paymentTxId: TxId)
  final case class RecordFundTAAcceptedParams(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String
  )
  final case class RecordFundTAConfirmedParams(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    shares: FundShare
  )
  final case class RecordFundTARejectedParams(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String,
    reason: String
  )
  final case class RecordFundTAUnknownParams(
    fundOrderId: FundOrderId,
    paymentTxId: TxId,
    taRequestId: TaRequestId,
    taReference: String,
    receiptId: String,
    receiptBody: String,
    fundCode: String,
    currency: String
  )
  final case class RequestFundPurchaseRefundParams(fundOrderId: FundOrderId, paymentTxId: TxId)
  final case class RecordFundRefundSucceededParams(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  )
  final case class RecordFundRefundRejectedBeforeEffectsParams(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  )
  final case class RecordFundRefundCompensatedParams(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  )
  final case class RecordFundRefundRecoveryRequiredParams(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  )
  final case class RecordFundRefundOutcomeUnknownParams(
    refundTxId: TxId,
    refundOperationId: OperationId,
    receiptId: String,
    receiptBody: String
  )
  final case class RecordCashRequestSourceParams(original: BankCashOriginal, source: Option[BankCashOriginal])
}
