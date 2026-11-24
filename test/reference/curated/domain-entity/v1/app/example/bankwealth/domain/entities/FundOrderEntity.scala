package example.bankwealth.domain.entities

import example.bankwealth.domain.values._

object FundOrderEntity {
  type State = example.bankwealth.domain.FundOrderState
  val State: example.bankwealth.domain.FundOrderState.type = example.bankwealth.domain.FundOrderState

  type Event = example.bankwealth.domain.FundOrderProtocol.Event
  val Events: example.bankwealth.domain.FundOrderProtocol.type = example.bankwealth.domain.FundOrderProtocol

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
