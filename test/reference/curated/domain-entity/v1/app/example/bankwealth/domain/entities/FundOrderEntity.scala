package example.bankwealth.domain.entities

import example.bankwealth.domain.values._

object FundOrderEntity {
  final case class State(
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

  type Event = example.bankwealth.domain.events.FundOrderEvents.Event
  val Events: example.bankwealth.domain.events.FundOrderEvents.type = example.bankwealth.domain.events.FundOrderEvents

  def empty: State = State(
    id = FundOrderId(""),
    status = "new",
    operationId = OperationId(""),
    investorAccountId = AccountId(""),
    fundCollectionAccountId = AccountId(""),
    fundCode = "",
    amount = Money(BigDecimal("0.00"), "CNY"),
    reservedSubscriptions = Map(),
    committedSubscriptions = Map(),
    compensatedSubscriptions = Map(),
    selectedPaymentTxId = TxId(""),
    paymentOutcome = "",
    cashPaymentResults = Map(),
    cashPaymentFinalResults = Map(),
    taRequestId = TaRequestId(""),
    taReference = "",
    taStatus = "",
    taReceipts = Map(),
    taReceiptOutcomes = Map(),
    taConfirmedShares = FundShare("", TaExactText(""), TaExactText("")),
    taRejectionReason = "",
    refundOperationId = OperationId(""),
    refundOutcome = "",
    refundResultReceipts = Map(),
    refundFinalResults = Map(),
    taObservedReceipts = Map(),
    paymentObservedResults = Map(),
    refundObservedResults = Map(),
    cashRequestSource = None,
    cashRequestOriginals = Map()
  )
}
