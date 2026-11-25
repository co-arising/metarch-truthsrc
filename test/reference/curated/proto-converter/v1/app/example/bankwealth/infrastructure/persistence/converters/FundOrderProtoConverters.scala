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
trait FundOrderProtoConverters extends PrimitiveConverter with SharedValueProtoConverters {
  def encodeFundOrderStatePO(value: FundOrderEntity.State): pb.FundOrderStatePO = pb.FundOrderStatePO(
    id = Some(encodeFundOrderIdPO(value.id)),
    status = value.status,
    operationId = Some(encodeOperationIdPO(value.operationId)),
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = Some(encodeMoneyPO(value.amount)),
    reservedSubscriptions = value.reservedSubscriptions.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    committedSubscriptions = value.committedSubscriptions.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    compensatedSubscriptions = value.compensatedSubscriptions.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    selectedPaymentTxId = Some(encodeTxIdPO(value.selectedPaymentTxId)),
    paymentOutcome = value.paymentOutcome,
    cashPaymentResults = value.cashPaymentResults.map { case (k, v) => k.value -> v },
    cashPaymentFinalResults = value.cashPaymentFinalResults.map { case (k, v) => k.value -> v },
    taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)),
    taReference = value.taReference,
    taStatus = value.taStatus,
    taReceipts = value.taReceipts,
    taReceiptOutcomes = value.taReceiptOutcomes,
    taConfirmedShares = Some(encodeFundSharePO(value.taConfirmedShares)),
    taRejectionReason = value.taRejectionReason,
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    refundOutcome = value.refundOutcome,
    refundResultReceipts = value.refundResultReceipts,
    refundFinalResults = value.refundFinalResults.map { case (k, v) => k.value -> v },
    taObservedReceipts = value.taObservedReceipts,
    paymentObservedResults = value.paymentObservedResults.map { case (k, v) => k.value -> v },
    refundObservedResults = value.refundObservedResults.map { case (k, v) => k.value -> v },
    cashRequestSource = value.cashRequestSource.map(encodeBankCashOriginalPO),
    cashRequestOriginals = value.cashRequestOriginals.map { case (k, v) => k -> encodeBankCashOriginalPO(v) }
  )
  def decodeFundOrderStatePO(value: pb.FundOrderStatePO): FundOrderEntity.State = FundOrderEntity.State(
    id = decodeFundOrderIdPO(req(value.id)),
    status = value.status,
    operationId = decodeOperationIdPO(req(value.operationId)),
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = decodeMoneyPO(req(value.amount)),
    reservedSubscriptions = value.reservedSubscriptions.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    committedSubscriptions = value.committedSubscriptions.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    compensatedSubscriptions = value.compensatedSubscriptions.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    selectedPaymentTxId = decodeTxIdPO(req(value.selectedPaymentTxId)),
    paymentOutcome = value.paymentOutcome,
    cashPaymentResults = value.cashPaymentResults.map { case (k, v) => TxId(k) -> v },
    cashPaymentFinalResults = value.cashPaymentFinalResults.map { case (k, v) => TxId(k) -> v },
    taRequestId = decodeTaRequestIdPO(req(value.taRequestId)),
    taReference = value.taReference,
    taStatus = value.taStatus,
    taReceipts = value.taReceipts,
    taReceiptOutcomes = value.taReceiptOutcomes,
    taConfirmedShares = decodeFundSharePO(req(value.taConfirmedShares)),
    taRejectionReason = value.taRejectionReason,
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    refundOutcome = value.refundOutcome,
    refundResultReceipts = value.refundResultReceipts,
    refundFinalResults = value.refundFinalResults.map { case (k, v) => TxId(k) -> v },
    taObservedReceipts = value.taObservedReceipts,
    paymentObservedResults = value.paymentObservedResults.map { case (k, v) => TxId(k) -> v },
    refundObservedResults = value.refundObservedResults.map { case (k, v) => TxId(k) -> v },
    cashRequestSource = value.cashRequestSource.map(decodeBankCashOriginalPO),
    cashRequestOriginals = value.cashRequestOriginals.map { case (k, v) => k -> decodeBankCashOriginalPO(v) }
  )
  def encodeFundPurchaseSettlementRequestedPO(value: FundOrderEntity.FundPurchaseSettlementRequested): pb.FundPurchaseSettlementRequestedPO = pb.FundPurchaseSettlementRequestedPO(
    operationId = Some(encodeOperationIdPO(value.operationId)),
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = Some(encodeMoneyPO(value.amount))
  )
  def decodeFundPurchaseSettlementRequestedPO(value: pb.FundPurchaseSettlementRequestedPO): FundOrderEntity.FundPurchaseSettlementRequested = FundOrderEntity.FundPurchaseSettlementRequested(
    operationId = decodeOperationIdPO(req(value.operationId)),
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = decodeMoneyPO(req(value.amount))
  )
  def encodeReserveFundSubscriptionConfirmedPO(value: FundOrderEntity.ReserveFundSubscriptionConfirmed): pb.ReserveFundSubscriptionConfirmedPO = pb.ReserveFundSubscriptionConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeFundOrderIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeReserveFundSubscriptionConfirmedPO(value: pb.ReserveFundSubscriptionConfirmedPO): FundOrderEntity.ReserveFundSubscriptionConfirmed = FundOrderEntity.ReserveFundSubscriptionConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeFundOrderIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeFundSubscriptionPaymentConfirmedPO(value: FundOrderEntity.FundSubscriptionPaymentConfirmed): pb.FundSubscriptionPaymentConfirmedPO = pb.FundSubscriptionPaymentConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeFundOrderIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeFundSubscriptionPaymentConfirmedPO(value: pb.FundSubscriptionPaymentConfirmedPO): FundOrderEntity.FundSubscriptionPaymentConfirmed = FundOrderEntity.FundSubscriptionPaymentConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeFundOrderIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeCashFundSubscriptionCanceledPO(value: FundOrderEntity.CashFundSubscriptionCanceled): pb.CashFundSubscriptionCanceledPO = pb.CashFundSubscriptionCanceledPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeFundOrderIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCashFundSubscriptionCanceledPO(value: pb.CashFundSubscriptionCanceledPO): FundOrderEntity.CashFundSubscriptionCanceled = FundOrderEntity.CashFundSubscriptionCanceled(txid = decodeTxIdPO(req(value.txid)), resource = decodeFundOrderIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeFundCashPaymentSucceededPO(value: FundOrderEntity.FundCashPaymentSucceeded): pb.FundCashPaymentSucceededPO = pb.FundCashPaymentSucceededPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentSucceededPO(value: pb.FundCashPaymentSucceededPO): FundOrderEntity.FundCashPaymentSucceeded = FundOrderEntity.FundCashPaymentSucceeded(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundCashPaymentRejectedBeforeEffectsPO(value: FundOrderEntity.FundCashPaymentRejectedBeforeEffects): pb.FundCashPaymentRejectedBeforeEffectsPO = pb.FundCashPaymentRejectedBeforeEffectsPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentRejectedBeforeEffectsPO(value: pb.FundCashPaymentRejectedBeforeEffectsPO): FundOrderEntity.FundCashPaymentRejectedBeforeEffects = FundOrderEntity.FundCashPaymentRejectedBeforeEffects(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundCashPaymentCompensatedPO(value: FundOrderEntity.FundCashPaymentCompensated): pb.FundCashPaymentCompensatedPO = pb.FundCashPaymentCompensatedPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentCompensatedPO(value: pb.FundCashPaymentCompensatedPO): FundOrderEntity.FundCashPaymentCompensated = FundOrderEntity.FundCashPaymentCompensated(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundCashPaymentRecoveryRequiredPO(value: FundOrderEntity.FundCashPaymentRecoveryRequired): pb.FundCashPaymentRecoveryRequiredPO = pb.FundCashPaymentRecoveryRequiredPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentRecoveryRequiredPO(value: pb.FundCashPaymentRecoveryRequiredPO): FundOrderEntity.FundCashPaymentRecoveryRequired = FundOrderEntity.FundCashPaymentRecoveryRequired(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundCashPaymentOutcomeUnknownPO(value: FundOrderEntity.FundCashPaymentOutcomeUnknown): pb.FundCashPaymentOutcomeUnknownPO = pb.FundCashPaymentOutcomeUnknownPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentOutcomeUnknownPO(value: pb.FundCashPaymentOutcomeUnknownPO): FundOrderEntity.FundCashPaymentOutcomeUnknown = FundOrderEntity.FundCashPaymentOutcomeUnknown(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundTASubmissionRegisteredPO(value: FundOrderEntity.FundTASubmissionRegistered): pb.FundTASubmissionRegisteredPO = pb.FundTASubmissionRegisteredPO(fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)), paymentTxId = Some(encodeTxIdPO(value.paymentTxId)), taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)))
  def decodeFundTASubmissionRegisteredPO(value: pb.FundTASubmissionRegisteredPO): FundOrderEntity.FundTASubmissionRegistered = FundOrderEntity.FundTASubmissionRegistered(fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)), paymentTxId = decodeTxIdPO(req(value.paymentTxId)), taRequestId = decodeTaRequestIdPO(req(value.taRequestId)))
  def encodeFundTAAcceptedPO(value: FundOrderEntity.FundTAAccepted): pb.FundTAAcceptedPO = pb.FundTAAcceptedPO(
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    paymentTxId = Some(encodeTxIdPO(value.paymentTxId)),
    taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)),
    taReference = value.taReference,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    fundCode = value.fundCode,
    currency = value.currency,
    outcome = value.outcome
  )
  def decodeFundTAAcceptedPO(value: pb.FundTAAcceptedPO): FundOrderEntity.FundTAAccepted = FundOrderEntity.FundTAAccepted(
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    paymentTxId = decodeTxIdPO(req(value.paymentTxId)),
    taRequestId = decodeTaRequestIdPO(req(value.taRequestId)),
    taReference = value.taReference,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    fundCode = value.fundCode,
    currency = value.currency,
    outcome = value.outcome
  )
  def encodeFundTASharesConfirmedPO(value: FundOrderEntity.FundTASharesConfirmed): pb.FundTASharesConfirmedPO = pb.FundTASharesConfirmedPO(
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    paymentTxId = Some(encodeTxIdPO(value.paymentTxId)),
    taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)),
    taReference = value.taReference,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    fundCode = value.fundCode,
    currency = value.currency,
    shares = Some(encodeFundSharePO(value.shares)),
    outcome = value.outcome
  )
  def decodeFundTASharesConfirmedPO(value: pb.FundTASharesConfirmedPO): FundOrderEntity.FundTASharesConfirmed = FundOrderEntity.FundTASharesConfirmed(
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    paymentTxId = decodeTxIdPO(req(value.paymentTxId)),
    taRequestId = decodeTaRequestIdPO(req(value.taRequestId)),
    taReference = value.taReference,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    fundCode = value.fundCode,
    currency = value.currency,
    shares = decodeFundSharePO(req(value.shares)),
    outcome = value.outcome
  )
  def encodeFundTARejectedPO(value: FundOrderEntity.FundTARejected): pb.FundTARejectedPO = pb.FundTARejectedPO(
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    paymentTxId = Some(encodeTxIdPO(value.paymentTxId)),
    taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)),
    taReference = value.taReference,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    fundCode = value.fundCode,
    currency = value.currency,
    reason = value.reason,
    outcome = value.outcome
  )
  def decodeFundTARejectedPO(value: pb.FundTARejectedPO): FundOrderEntity.FundTARejected = FundOrderEntity.FundTARejected(
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    paymentTxId = decodeTxIdPO(req(value.paymentTxId)),
    taRequestId = decodeTaRequestIdPO(req(value.taRequestId)),
    taReference = value.taReference,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    fundCode = value.fundCode,
    currency = value.currency,
    reason = value.reason,
    outcome = value.outcome
  )
  def encodeFundTAUnknownPO(value: FundOrderEntity.FundTAUnknown): pb.FundTAUnknownPO = pb.FundTAUnknownPO(
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    paymentTxId = Some(encodeTxIdPO(value.paymentTxId)),
    taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)),
    taReference = value.taReference,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    fundCode = value.fundCode,
    currency = value.currency,
    outcome = value.outcome
  )
  def decodeFundTAUnknownPO(value: pb.FundTAUnknownPO): FundOrderEntity.FundTAUnknown = FundOrderEntity.FundTAUnknown(
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    paymentTxId = decodeTxIdPO(req(value.paymentTxId)),
    taRequestId = decodeTaRequestIdPO(req(value.taRequestId)),
    taReference = value.taReference,
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    fundCode = value.fundCode,
    currency = value.currency,
    outcome = value.outcome
  )
  def encodeFundPurchaseRefundRequestedPO(value: FundOrderEntity.FundPurchaseRefundRequested): pb.FundPurchaseRefundRequestedPO = pb.FundPurchaseRefundRequestedPO(
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    paymentTxId = Some(encodeTxIdPO(value.paymentTxId)),
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    amount = Some(encodeMoneyPO(value.amount)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId))
  )
  def decodeFundPurchaseRefundRequestedPO(value: pb.FundPurchaseRefundRequestedPO): FundOrderEntity.FundPurchaseRefundRequested = FundOrderEntity.FundPurchaseRefundRequested(
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    paymentTxId = decodeTxIdPO(req(value.paymentTxId)),
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    amount = decodeMoneyPO(req(value.amount)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId))
  )
  def encodeFundRefundSucceededPO(value: FundOrderEntity.FundRefundSucceeded): pb.FundRefundSucceededPO = pb.FundRefundSucceededPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundSucceededPO(value: pb.FundRefundSucceededPO): FundOrderEntity.FundRefundSucceeded = FundOrderEntity.FundRefundSucceeded(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundRefundRejectedBeforeEffectsPO(value: FundOrderEntity.FundRefundRejectedBeforeEffects): pb.FundRefundRejectedBeforeEffectsPO = pb.FundRefundRejectedBeforeEffectsPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundRejectedBeforeEffectsPO(value: pb.FundRefundRejectedBeforeEffectsPO): FundOrderEntity.FundRefundRejectedBeforeEffects = FundOrderEntity.FundRefundRejectedBeforeEffects(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundRefundCompensatedPO(value: FundOrderEntity.FundRefundCompensated): pb.FundRefundCompensatedPO = pb.FundRefundCompensatedPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundCompensatedPO(value: pb.FundRefundCompensatedPO): FundOrderEntity.FundRefundCompensated = FundOrderEntity.FundRefundCompensated(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundRefundRecoveryRequiredPO(value: FundOrderEntity.FundRefundRecoveryRequired): pb.FundRefundRecoveryRequiredPO = pb.FundRefundRecoveryRequiredPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundRecoveryRequiredPO(value: pb.FundRefundRecoveryRequiredPO): FundOrderEntity.FundRefundRecoveryRequired = FundOrderEntity.FundRefundRecoveryRequired(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundRefundOutcomeUnknownPO(value: FundOrderEntity.FundRefundOutcomeUnknown): pb.FundRefundOutcomeUnknownPO = pb.FundRefundOutcomeUnknownPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundOutcomeUnknownPO(value: pb.FundRefundOutcomeUnknownPO): FundOrderEntity.FundRefundOutcomeUnknown = FundOrderEntity.FundRefundOutcomeUnknown(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundTAReceiptObservedPO(value: FundOrderEntity.FundTAReceiptObserved): pb.FundTAReceiptObservedPO = pb.FundTAReceiptObservedPO(
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    paymentTxId = Some(encodeTxIdPO(value.paymentTxId)),
    taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)),
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = Some(encodeMoneyPO(value.amount)),
    principal = Some(encodeAmountDecimalPO(value.principal)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    taReference = value.taReference,
    status = value.status,
    shares = Some(encodeTaExactTextPO(value.shares)),
    nav = Some(encodeTaExactTextPO(value.nav)),
    reason = value.reason
  )
  def decodeFundTAReceiptObservedPO(value: pb.FundTAReceiptObservedPO): FundOrderEntity.FundTAReceiptObserved = FundOrderEntity.FundTAReceiptObserved(
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    paymentTxId = decodeTxIdPO(req(value.paymentTxId)),
    taRequestId = decodeTaRequestIdPO(req(value.taRequestId)),
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = decodeMoneyPO(req(value.amount)),
    principal = decodeAmountDecimalPO(req(value.principal)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    taReference = value.taReference,
    status = value.status,
    shares = decodeTaExactTextPO(req(value.shares)),
    nav = decodeTaExactTextPO(req(value.nav)),
    reason = value.reason
  )
  def encodeBankPaymentResultSucceededPO(value: FundOrderEntity.BankPaymentResultSucceeded): pb.BankPaymentResultSucceededPO = pb.BankPaymentResultSucceededPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultSucceededPO(value: pb.BankPaymentResultSucceededPO): FundOrderEntity.BankPaymentResultSucceeded = FundOrderEntity.BankPaymentResultSucceeded(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankPaymentResultRejectedBeforeEffectsPO(value: FundOrderEntity.BankPaymentResultRejectedBeforeEffects): pb.BankPaymentResultRejectedBeforeEffectsPO = pb.BankPaymentResultRejectedBeforeEffectsPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultRejectedBeforeEffectsPO(value: pb.BankPaymentResultRejectedBeforeEffectsPO): FundOrderEntity.BankPaymentResultRejectedBeforeEffects = FundOrderEntity.BankPaymentResultRejectedBeforeEffects(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankPaymentResultCompensatedPO(value: FundOrderEntity.BankPaymentResultCompensated): pb.BankPaymentResultCompensatedPO = pb.BankPaymentResultCompensatedPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultCompensatedPO(value: pb.BankPaymentResultCompensatedPO): FundOrderEntity.BankPaymentResultCompensated = FundOrderEntity.BankPaymentResultCompensated(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankPaymentResultRecoveryRequiredPO(value: FundOrderEntity.BankPaymentResultRecoveryRequired): pb.BankPaymentResultRecoveryRequiredPO = pb.BankPaymentResultRecoveryRequiredPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultRecoveryRequiredPO(value: pb.BankPaymentResultRecoveryRequiredPO): FundOrderEntity.BankPaymentResultRecoveryRequired = FundOrderEntity.BankPaymentResultRecoveryRequired(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankPaymentResultOutcomeUnknownPO(value: FundOrderEntity.BankPaymentResultOutcomeUnknown): pb.BankPaymentResultOutcomeUnknownPO = pb.BankPaymentResultOutcomeUnknownPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultOutcomeUnknownPO(value: pb.BankPaymentResultOutcomeUnknownPO): FundOrderEntity.BankPaymentResultOutcomeUnknown = FundOrderEntity.BankPaymentResultOutcomeUnknown(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultSucceededPO(value: FundOrderEntity.BankRefundResultSucceeded): pb.BankRefundResultSucceededPO = pb.BankRefundResultSucceededPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultSucceededPO(value: pb.BankRefundResultSucceededPO): FundOrderEntity.BankRefundResultSucceeded = FundOrderEntity.BankRefundResultSucceeded(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultRejectedBeforeEffectsPO(value: FundOrderEntity.BankRefundResultRejectedBeforeEffects): pb.BankRefundResultRejectedBeforeEffectsPO = pb.BankRefundResultRejectedBeforeEffectsPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultRejectedBeforeEffectsPO(value: pb.BankRefundResultRejectedBeforeEffectsPO): FundOrderEntity.BankRefundResultRejectedBeforeEffects = FundOrderEntity.BankRefundResultRejectedBeforeEffects(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultCompensatedPO(value: FundOrderEntity.BankRefundResultCompensated): pb.BankRefundResultCompensatedPO = pb.BankRefundResultCompensatedPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultCompensatedPO(value: pb.BankRefundResultCompensatedPO): FundOrderEntity.BankRefundResultCompensated = FundOrderEntity.BankRefundResultCompensated(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultRecoveryRequiredPO(value: FundOrderEntity.BankRefundResultRecoveryRequired): pb.BankRefundResultRecoveryRequiredPO = pb.BankRefundResultRecoveryRequiredPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultRecoveryRequiredPO(value: pb.BankRefundResultRecoveryRequiredPO): FundOrderEntity.BankRefundResultRecoveryRequired = FundOrderEntity.BankRefundResultRecoveryRequired(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultOutcomeUnknownPO(value: FundOrderEntity.BankRefundResultOutcomeUnknown): pb.BankRefundResultOutcomeUnknownPO = pb.BankRefundResultOutcomeUnknownPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultOutcomeUnknownPO(value: pb.BankRefundResultOutcomeUnknownPO): FundOrderEntity.BankRefundResultOutcomeUnknown = FundOrderEntity.BankRefundResultOutcomeUnknown(txid = decodeTxIdPO(req(value.txid)))
  def encodeCashRequestSourceRecordedPO(value: FundOrderEntity.CashRequestSourceRecorded): pb.CashRequestSourceRecordedPO = pb.CashRequestSourceRecordedPO(original = Some(encodeBankCashOriginalPO(value.original)), source = value.source.map(encodeBankCashOriginalPO))
  def decodeCashRequestSourceRecordedPO(value: pb.CashRequestSourceRecordedPO): FundOrderEntity.CashRequestSourceRecorded = FundOrderEntity.CashRequestSourceRecorded(original = decodeBankCashOriginalPO(req(value.original)), source = value.source.map(decodeBankCashOriginalPO))
  def encodeFundOrderEventPO(value: FundOrderEntity.Event): pb.FundOrderEventPO = value match {
    case e: FundOrderEntity.FundPurchaseSettlementRequested => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundPurchaseSettlementRequested(encodeFundPurchaseSettlementRequestedPO(e)))
    case e: FundOrderEntity.ReserveFundSubscriptionConfirmed => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.ReserveFundSubscriptionConfirmed(encodeReserveFundSubscriptionConfirmedPO(e)))
    case e: FundOrderEntity.FundSubscriptionPaymentConfirmed => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundSubscriptionPaymentConfirmed(encodeFundSubscriptionPaymentConfirmedPO(e)))
    case e: FundOrderEntity.CashFundSubscriptionCanceled => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.CashFundSubscriptionCanceled(encodeCashFundSubscriptionCanceledPO(e)))
    case e: FundOrderEntity.FundCashPaymentSucceeded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentSucceeded(encodeFundCashPaymentSucceededPO(e)))
    case e: FundOrderEntity.FundCashPaymentRejectedBeforeEffects => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentRejectedBeforeEffects(encodeFundCashPaymentRejectedBeforeEffectsPO(e)))
    case e: FundOrderEntity.FundCashPaymentCompensated => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentCompensated(encodeFundCashPaymentCompensatedPO(e)))
    case e: FundOrderEntity.FundCashPaymentRecoveryRequired => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentRecoveryRequired(encodeFundCashPaymentRecoveryRequiredPO(e)))
    case e: FundOrderEntity.FundCashPaymentOutcomeUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentOutcomeUnknown(encodeFundCashPaymentOutcomeUnknownPO(e)))
    case e: FundOrderEntity.FundTASubmissionRegistered => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTASubmissionRegistered(encodeFundTASubmissionRegisteredPO(e)))
    case e: FundOrderEntity.FundTAAccepted => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTAAccepted(encodeFundTAAcceptedPO(e)))
    case e: FundOrderEntity.FundTASharesConfirmed => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTASharesConfirmed(encodeFundTASharesConfirmedPO(e)))
    case e: FundOrderEntity.FundTARejected => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTARejected(encodeFundTARejectedPO(e)))
    case e: FundOrderEntity.FundTAUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTAUnknown(encodeFundTAUnknownPO(e)))
    case e: FundOrderEntity.FundPurchaseRefundRequested => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundPurchaseRefundRequested(encodeFundPurchaseRefundRequestedPO(e)))
    case e: FundOrderEntity.FundRefundSucceeded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundSucceeded(encodeFundRefundSucceededPO(e)))
    case e: FundOrderEntity.FundRefundRejectedBeforeEffects => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundRejectedBeforeEffects(encodeFundRefundRejectedBeforeEffectsPO(e)))
    case e: FundOrderEntity.FundRefundCompensated => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundCompensated(encodeFundRefundCompensatedPO(e)))
    case e: FundOrderEntity.FundRefundRecoveryRequired => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundRecoveryRequired(encodeFundRefundRecoveryRequiredPO(e)))
    case e: FundOrderEntity.FundRefundOutcomeUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundOutcomeUnknown(encodeFundRefundOutcomeUnknownPO(e)))
    case e: FundOrderEntity.FundTAReceiptObserved => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTAReceiptObserved(encodeFundTAReceiptObservedPO(e)))
    case e: FundOrderEntity.BankPaymentResultSucceeded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultSucceeded(encodeBankPaymentResultSucceededPO(e)))
    case e: FundOrderEntity.BankPaymentResultRejectedBeforeEffects => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultRejectedBeforeEffects(encodeBankPaymentResultRejectedBeforeEffectsPO(e)))
    case e: FundOrderEntity.BankPaymentResultCompensated => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultCompensated(encodeBankPaymentResultCompensatedPO(e)))
    case e: FundOrderEntity.BankPaymentResultRecoveryRequired => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultRecoveryRequired(encodeBankPaymentResultRecoveryRequiredPO(e)))
    case e: FundOrderEntity.BankPaymentResultOutcomeUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultOutcomeUnknown(encodeBankPaymentResultOutcomeUnknownPO(e)))
    case e: FundOrderEntity.BankRefundResultSucceeded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultSucceeded(encodeBankRefundResultSucceededPO(e)))
    case e: FundOrderEntity.BankRefundResultRejectedBeforeEffects => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultRejectedBeforeEffects(encodeBankRefundResultRejectedBeforeEffectsPO(e)))
    case e: FundOrderEntity.BankRefundResultCompensated => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultCompensated(encodeBankRefundResultCompensatedPO(e)))
    case e: FundOrderEntity.BankRefundResultRecoveryRequired => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultRecoveryRequired(encodeBankRefundResultRecoveryRequiredPO(e)))
    case e: FundOrderEntity.BankRefundResultOutcomeUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultOutcomeUnknown(encodeBankRefundResultOutcomeUnknownPO(e)))
    case e: FundOrderEntity.CashRequestSourceRecorded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.CashRequestSourceRecorded(encodeCashRequestSourceRecordedPO(e)))
  }
  def decodeFundOrderEventPO(value: pb.FundOrderEventPO): FundOrderEntity.Event = value.event match {
    case pb.FundOrderEventPO.Event.FundPurchaseSettlementRequested(e) => decodeFundPurchaseSettlementRequestedPO(e)
    case pb.FundOrderEventPO.Event.ReserveFundSubscriptionConfirmed(e) => decodeReserveFundSubscriptionConfirmedPO(e)
    case pb.FundOrderEventPO.Event.FundSubscriptionPaymentConfirmed(e) => decodeFundSubscriptionPaymentConfirmedPO(e)
    case pb.FundOrderEventPO.Event.CashFundSubscriptionCanceled(e) => decodeCashFundSubscriptionCanceledPO(e)
    case pb.FundOrderEventPO.Event.FundCashPaymentSucceeded(e) => decodeFundCashPaymentSucceededPO(e)
    case pb.FundOrderEventPO.Event.FundCashPaymentRejectedBeforeEffects(e) => decodeFundCashPaymentRejectedBeforeEffectsPO(e)
    case pb.FundOrderEventPO.Event.FundCashPaymentCompensated(e) => decodeFundCashPaymentCompensatedPO(e)
    case pb.FundOrderEventPO.Event.FundCashPaymentRecoveryRequired(e) => decodeFundCashPaymentRecoveryRequiredPO(e)
    case pb.FundOrderEventPO.Event.FundCashPaymentOutcomeUnknown(e) => decodeFundCashPaymentOutcomeUnknownPO(e)
    case pb.FundOrderEventPO.Event.FundTASubmissionRegistered(e) => decodeFundTASubmissionRegisteredPO(e)
    case pb.FundOrderEventPO.Event.FundTAAccepted(e) => decodeFundTAAcceptedPO(e)
    case pb.FundOrderEventPO.Event.FundTASharesConfirmed(e) => decodeFundTASharesConfirmedPO(e)
    case pb.FundOrderEventPO.Event.FundTARejected(e) => decodeFundTARejectedPO(e)
    case pb.FundOrderEventPO.Event.FundTAUnknown(e) => decodeFundTAUnknownPO(e)
    case pb.FundOrderEventPO.Event.FundPurchaseRefundRequested(e) => decodeFundPurchaseRefundRequestedPO(e)
    case pb.FundOrderEventPO.Event.FundRefundSucceeded(e) => decodeFundRefundSucceededPO(e)
    case pb.FundOrderEventPO.Event.FundRefundRejectedBeforeEffects(e) => decodeFundRefundRejectedBeforeEffectsPO(e)
    case pb.FundOrderEventPO.Event.FundRefundCompensated(e) => decodeFundRefundCompensatedPO(e)
    case pb.FundOrderEventPO.Event.FundRefundRecoveryRequired(e) => decodeFundRefundRecoveryRequiredPO(e)
    case pb.FundOrderEventPO.Event.FundRefundOutcomeUnknown(e) => decodeFundRefundOutcomeUnknownPO(e)
    case pb.FundOrderEventPO.Event.FundTAReceiptObserved(e) => decodeFundTAReceiptObservedPO(e)
    case pb.FundOrderEventPO.Event.BankPaymentResultSucceeded(e) => decodeBankPaymentResultSucceededPO(e)
    case pb.FundOrderEventPO.Event.BankPaymentResultRejectedBeforeEffects(e) => decodeBankPaymentResultRejectedBeforeEffectsPO(e)
    case pb.FundOrderEventPO.Event.BankPaymentResultCompensated(e) => decodeBankPaymentResultCompensatedPO(e)
    case pb.FundOrderEventPO.Event.BankPaymentResultRecoveryRequired(e) => decodeBankPaymentResultRecoveryRequiredPO(e)
    case pb.FundOrderEventPO.Event.BankPaymentResultOutcomeUnknown(e) => decodeBankPaymentResultOutcomeUnknownPO(e)
    case pb.FundOrderEventPO.Event.BankRefundResultSucceeded(e) => decodeBankRefundResultSucceededPO(e)
    case pb.FundOrderEventPO.Event.BankRefundResultRejectedBeforeEffects(e) => decodeBankRefundResultRejectedBeforeEffectsPO(e)
    case pb.FundOrderEventPO.Event.BankRefundResultCompensated(e) => decodeBankRefundResultCompensatedPO(e)
    case pb.FundOrderEventPO.Event.BankRefundResultRecoveryRequired(e) => decodeBankRefundResultRecoveryRequiredPO(e)
    case pb.FundOrderEventPO.Event.BankRefundResultOutcomeUnknown(e) => decodeBankRefundResultOutcomeUnknownPO(e)
    case pb.FundOrderEventPO.Event.CashRequestSourceRecorded(e) => decodeCashRequestSourceRecordedPO(e)
    case pb.FundOrderEventPO.Event.Empty => throw new IllegalArgumentException("empty FundOrderEventPO event")
  }
}
