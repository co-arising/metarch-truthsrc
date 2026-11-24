package example.bankwealth.domain.values

final case class BankOrderView(orderId: FundOrderId, operationId: OperationId, investorAccountId: AccountId, fundCollectionAccountId: AccountId, fundCode: String, amount: MoneyWire, paymentTxId: Option[TxId], paymentStatus: String, taRequestId: Option[TaRequestId], taStatus: String, taReference: Option[String], taShares: Option[BankTaSharesView], taRejectionReason: Option[String], refundOperationId: Option[OperationId], refundStatus: String)
