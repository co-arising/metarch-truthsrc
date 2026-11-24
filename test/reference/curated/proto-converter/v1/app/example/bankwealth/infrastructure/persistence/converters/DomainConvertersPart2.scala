package example.bankwealth.infrastructure.persistence.converters

import example.bankwealth.domain.entities._
import example.bankwealth.domain.events._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.{proto => pb}
trait DomainConvertersPart2 { self: DomainConverters.type =>
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
  def encodeFundPurchaseSettlementRequestedPO(value: FundOrderEvents.FundPurchaseSettlementRequested): pb.FundPurchaseSettlementRequestedPO = pb.FundPurchaseSettlementRequestedPO(
    operationId = Some(encodeOperationIdPO(value.operationId)),
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = Some(encodeMoneyPO(value.amount))
  )
  def decodeFundPurchaseSettlementRequestedPO(value: pb.FundPurchaseSettlementRequestedPO): FundOrderEvents.FundPurchaseSettlementRequested = FundOrderEvents.FundPurchaseSettlementRequested(
    operationId = decodeOperationIdPO(req(value.operationId)),
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = decodeMoneyPO(req(value.amount))
  )
  def encodeReserveFundSubscriptionConfirmedPO(value: FundOrderEvents.ReserveFundSubscriptionConfirmed): pb.ReserveFundSubscriptionConfirmedPO = pb.ReserveFundSubscriptionConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeFundOrderIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeReserveFundSubscriptionConfirmedPO(value: pb.ReserveFundSubscriptionConfirmedPO): FundOrderEvents.ReserveFundSubscriptionConfirmed = FundOrderEvents.ReserveFundSubscriptionConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeFundOrderIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeFundSubscriptionPaymentConfirmedPO(value: FundOrderEvents.FundSubscriptionPaymentConfirmed): pb.FundSubscriptionPaymentConfirmedPO = pb.FundSubscriptionPaymentConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeFundOrderIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeFundSubscriptionPaymentConfirmedPO(value: pb.FundSubscriptionPaymentConfirmedPO): FundOrderEvents.FundSubscriptionPaymentConfirmed = FundOrderEvents.FundSubscriptionPaymentConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeFundOrderIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeCashFundSubscriptionCanceledPO(value: FundOrderEvents.CashFundSubscriptionCanceled): pb.CashFundSubscriptionCanceledPO = pb.CashFundSubscriptionCanceledPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeFundOrderIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCashFundSubscriptionCanceledPO(value: pb.CashFundSubscriptionCanceledPO): FundOrderEvents.CashFundSubscriptionCanceled = FundOrderEvents.CashFundSubscriptionCanceled(txid = decodeTxIdPO(req(value.txid)), resource = decodeFundOrderIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeFundCashPaymentSucceededPO(value: FundOrderEvents.FundCashPaymentSucceeded): pb.FundCashPaymentSucceededPO = pb.FundCashPaymentSucceededPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentSucceededPO(value: pb.FundCashPaymentSucceededPO): FundOrderEvents.FundCashPaymentSucceeded = FundOrderEvents.FundCashPaymentSucceeded(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundCashPaymentRejectedBeforeEffectsPO(value: FundOrderEvents.FundCashPaymentRejectedBeforeEffects): pb.FundCashPaymentRejectedBeforeEffectsPO = pb.FundCashPaymentRejectedBeforeEffectsPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentRejectedBeforeEffectsPO(value: pb.FundCashPaymentRejectedBeforeEffectsPO): FundOrderEvents.FundCashPaymentRejectedBeforeEffects = FundOrderEvents.FundCashPaymentRejectedBeforeEffects(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundCashPaymentCompensatedPO(value: FundOrderEvents.FundCashPaymentCompensated): pb.FundCashPaymentCompensatedPO = pb.FundCashPaymentCompensatedPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentCompensatedPO(value: pb.FundCashPaymentCompensatedPO): FundOrderEvents.FundCashPaymentCompensated = FundOrderEvents.FundCashPaymentCompensated(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundCashPaymentRecoveryRequiredPO(value: FundOrderEvents.FundCashPaymentRecoveryRequired): pb.FundCashPaymentRecoveryRequiredPO = pb.FundCashPaymentRecoveryRequiredPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentRecoveryRequiredPO(value: pb.FundCashPaymentRecoveryRequiredPO): FundOrderEvents.FundCashPaymentRecoveryRequired = FundOrderEvents.FundCashPaymentRecoveryRequired(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundCashPaymentOutcomeUnknownPO(value: FundOrderEvents.FundCashPaymentOutcomeUnknown): pb.FundCashPaymentOutcomeUnknownPO = pb.FundCashPaymentOutcomeUnknownPO(txid = Some(encodeTxIdPO(value.txid)), kind = value.kind)
  def decodeFundCashPaymentOutcomeUnknownPO(value: pb.FundCashPaymentOutcomeUnknownPO): FundOrderEvents.FundCashPaymentOutcomeUnknown = FundOrderEvents.FundCashPaymentOutcomeUnknown(txid = decodeTxIdPO(req(value.txid)), kind = value.kind)
  def encodeFundTASubmissionRegisteredPO(value: FundOrderEvents.FundTASubmissionRegistered): pb.FundTASubmissionRegisteredPO = pb.FundTASubmissionRegisteredPO(fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)), paymentTxId = Some(encodeTxIdPO(value.paymentTxId)), taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)))
  def decodeFundTASubmissionRegisteredPO(value: pb.FundTASubmissionRegisteredPO): FundOrderEvents.FundTASubmissionRegistered = FundOrderEvents.FundTASubmissionRegistered(fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)), paymentTxId = decodeTxIdPO(req(value.paymentTxId)), taRequestId = decodeTaRequestIdPO(req(value.taRequestId)))
  def encodeFundTAAcceptedPO(value: FundOrderEvents.FundTAAccepted): pb.FundTAAcceptedPO = pb.FundTAAcceptedPO(
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
  def decodeFundTAAcceptedPO(value: pb.FundTAAcceptedPO): FundOrderEvents.FundTAAccepted = FundOrderEvents.FundTAAccepted(
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
  def encodeFundTASharesConfirmedPO(value: FundOrderEvents.FundTASharesConfirmed): pb.FundTASharesConfirmedPO = pb.FundTASharesConfirmedPO(
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
  def decodeFundTASharesConfirmedPO(value: pb.FundTASharesConfirmedPO): FundOrderEvents.FundTASharesConfirmed = FundOrderEvents.FundTASharesConfirmed(
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
  def encodeFundTARejectedPO(value: FundOrderEvents.FundTARejected): pb.FundTARejectedPO = pb.FundTARejectedPO(
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
  def decodeFundTARejectedPO(value: pb.FundTARejectedPO): FundOrderEvents.FundTARejected = FundOrderEvents.FundTARejected(
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
  def encodeFundTAUnknownPO(value: FundOrderEvents.FundTAUnknown): pb.FundTAUnknownPO = pb.FundTAUnknownPO(
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
  def decodeFundTAUnknownPO(value: pb.FundTAUnknownPO): FundOrderEvents.FundTAUnknown = FundOrderEvents.FundTAUnknown(
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
  def encodeFundPurchaseRefundRequestedPO(value: FundOrderEvents.FundPurchaseRefundRequested): pb.FundPurchaseRefundRequestedPO = pb.FundPurchaseRefundRequestedPO(
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    paymentTxId = Some(encodeTxIdPO(value.paymentTxId)),
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    amount = Some(encodeMoneyPO(value.amount)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId))
  )
  def decodeFundPurchaseRefundRequestedPO(value: pb.FundPurchaseRefundRequestedPO): FundOrderEvents.FundPurchaseRefundRequested = FundOrderEvents.FundPurchaseRefundRequested(
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    paymentTxId = decodeTxIdPO(req(value.paymentTxId)),
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    amount = decodeMoneyPO(req(value.amount)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId))
  )
  def encodeFundRefundSucceededPO(value: FundOrderEvents.FundRefundSucceeded): pb.FundRefundSucceededPO = pb.FundRefundSucceededPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundSucceededPO(value: pb.FundRefundSucceededPO): FundOrderEvents.FundRefundSucceeded = FundOrderEvents.FundRefundSucceeded(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundRefundRejectedBeforeEffectsPO(value: FundOrderEvents.FundRefundRejectedBeforeEffects): pb.FundRefundRejectedBeforeEffectsPO = pb.FundRefundRejectedBeforeEffectsPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundRejectedBeforeEffectsPO(value: pb.FundRefundRejectedBeforeEffectsPO): FundOrderEvents.FundRefundRejectedBeforeEffects = FundOrderEvents.FundRefundRejectedBeforeEffects(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundRefundCompensatedPO(value: FundOrderEvents.FundRefundCompensated): pb.FundRefundCompensatedPO = pb.FundRefundCompensatedPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundCompensatedPO(value: pb.FundRefundCompensatedPO): FundOrderEvents.FundRefundCompensated = FundOrderEvents.FundRefundCompensated(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundRefundRecoveryRequiredPO(value: FundOrderEvents.FundRefundRecoveryRequired): pb.FundRefundRecoveryRequiredPO = pb.FundRefundRecoveryRequiredPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundRecoveryRequiredPO(value: pb.FundRefundRecoveryRequiredPO): FundOrderEvents.FundRefundRecoveryRequired = FundOrderEvents.FundRefundRecoveryRequired(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundRefundOutcomeUnknownPO(value: FundOrderEvents.FundRefundOutcomeUnknown): pb.FundRefundOutcomeUnknownPO = pb.FundRefundOutcomeUnknownPO(
    refundTxId = Some(encodeTxIdPO(value.refundTxId)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def decodeFundRefundOutcomeUnknownPO(value: pb.FundRefundOutcomeUnknownPO): FundOrderEvents.FundRefundOutcomeUnknown = FundOrderEvents.FundRefundOutcomeUnknown(
    refundTxId = decodeTxIdPO(req(value.refundTxId)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId)),
    receiptId = value.receiptId,
    receiptBody = value.receiptBody,
    kind = value.kind
  )
  def encodeFundTAReceiptObservedPO(value: FundOrderEvents.FundTAReceiptObserved): pb.FundTAReceiptObservedPO = pb.FundTAReceiptObservedPO(
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
  def decodeFundTAReceiptObservedPO(value: pb.FundTAReceiptObservedPO): FundOrderEvents.FundTAReceiptObserved = FundOrderEvents.FundTAReceiptObserved(
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
  def encodeBankPaymentResultSucceededPO(value: FundOrderEvents.BankPaymentResultSucceeded): pb.BankPaymentResultSucceededPO = pb.BankPaymentResultSucceededPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultSucceededPO(value: pb.BankPaymentResultSucceededPO): FundOrderEvents.BankPaymentResultSucceeded = FundOrderEvents.BankPaymentResultSucceeded(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankPaymentResultRejectedBeforeEffectsPO(value: FundOrderEvents.BankPaymentResultRejectedBeforeEffects): pb.BankPaymentResultRejectedBeforeEffectsPO = pb.BankPaymentResultRejectedBeforeEffectsPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultRejectedBeforeEffectsPO(value: pb.BankPaymentResultRejectedBeforeEffectsPO): FundOrderEvents.BankPaymentResultRejectedBeforeEffects = FundOrderEvents.BankPaymentResultRejectedBeforeEffects(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankPaymentResultCompensatedPO(value: FundOrderEvents.BankPaymentResultCompensated): pb.BankPaymentResultCompensatedPO = pb.BankPaymentResultCompensatedPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultCompensatedPO(value: pb.BankPaymentResultCompensatedPO): FundOrderEvents.BankPaymentResultCompensated = FundOrderEvents.BankPaymentResultCompensated(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankPaymentResultRecoveryRequiredPO(value: FundOrderEvents.BankPaymentResultRecoveryRequired): pb.BankPaymentResultRecoveryRequiredPO = pb.BankPaymentResultRecoveryRequiredPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultRecoveryRequiredPO(value: pb.BankPaymentResultRecoveryRequiredPO): FundOrderEvents.BankPaymentResultRecoveryRequired = FundOrderEvents.BankPaymentResultRecoveryRequired(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankPaymentResultOutcomeUnknownPO(value: FundOrderEvents.BankPaymentResultOutcomeUnknown): pb.BankPaymentResultOutcomeUnknownPO = pb.BankPaymentResultOutcomeUnknownPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultOutcomeUnknownPO(value: pb.BankPaymentResultOutcomeUnknownPO): FundOrderEvents.BankPaymentResultOutcomeUnknown = FundOrderEvents.BankPaymentResultOutcomeUnknown(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultSucceededPO(value: FundOrderEvents.BankRefundResultSucceeded): pb.BankRefundResultSucceededPO = pb.BankRefundResultSucceededPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultSucceededPO(value: pb.BankRefundResultSucceededPO): FundOrderEvents.BankRefundResultSucceeded = FundOrderEvents.BankRefundResultSucceeded(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultRejectedBeforeEffectsPO(value: FundOrderEvents.BankRefundResultRejectedBeforeEffects): pb.BankRefundResultRejectedBeforeEffectsPO = pb.BankRefundResultRejectedBeforeEffectsPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultRejectedBeforeEffectsPO(value: pb.BankRefundResultRejectedBeforeEffectsPO): FundOrderEvents.BankRefundResultRejectedBeforeEffects = FundOrderEvents.BankRefundResultRejectedBeforeEffects(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultCompensatedPO(value: FundOrderEvents.BankRefundResultCompensated): pb.BankRefundResultCompensatedPO = pb.BankRefundResultCompensatedPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultCompensatedPO(value: pb.BankRefundResultCompensatedPO): FundOrderEvents.BankRefundResultCompensated = FundOrderEvents.BankRefundResultCompensated(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultRecoveryRequiredPO(value: FundOrderEvents.BankRefundResultRecoveryRequired): pb.BankRefundResultRecoveryRequiredPO = pb.BankRefundResultRecoveryRequiredPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultRecoveryRequiredPO(value: pb.BankRefundResultRecoveryRequiredPO): FundOrderEvents.BankRefundResultRecoveryRequired = FundOrderEvents.BankRefundResultRecoveryRequired(txid = decodeTxIdPO(req(value.txid)))
  def encodeBankRefundResultOutcomeUnknownPO(value: FundOrderEvents.BankRefundResultOutcomeUnknown): pb.BankRefundResultOutcomeUnknownPO = pb.BankRefundResultOutcomeUnknownPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultOutcomeUnknownPO(value: pb.BankRefundResultOutcomeUnknownPO): FundOrderEvents.BankRefundResultOutcomeUnknown = FundOrderEvents.BankRefundResultOutcomeUnknown(txid = decodeTxIdPO(req(value.txid)))
  def encodeCashRequestSourceRecordedPO(value: FundOrderEvents.CashRequestSourceRecorded): pb.CashRequestSourceRecordedPO = pb.CashRequestSourceRecordedPO(original = Some(encodeBankCashOriginalPO(value.original)), source = value.source.map(encodeBankCashOriginalPO))
  def decodeCashRequestSourceRecordedPO(value: pb.CashRequestSourceRecordedPO): FundOrderEvents.CashRequestSourceRecorded = FundOrderEvents.CashRequestSourceRecorded(original = decodeBankCashOriginalPO(req(value.original)), source = value.source.map(decodeBankCashOriginalPO))
  def encodeFundOrderEventPO(value: FundOrderEvents.Event): pb.FundOrderEventPO = value match {
    case e: FundOrderEvents.FundPurchaseSettlementRequested => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundPurchaseSettlementRequested(encodeFundPurchaseSettlementRequestedPO(e)))
    case e: FundOrderEvents.ReserveFundSubscriptionConfirmed => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.ReserveFundSubscriptionConfirmed(encodeReserveFundSubscriptionConfirmedPO(e)))
    case e: FundOrderEvents.FundSubscriptionPaymentConfirmed => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundSubscriptionPaymentConfirmed(encodeFundSubscriptionPaymentConfirmedPO(e)))
    case e: FundOrderEvents.CashFundSubscriptionCanceled => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.CashFundSubscriptionCanceled(encodeCashFundSubscriptionCanceledPO(e)))
    case e: FundOrderEvents.FundCashPaymentSucceeded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentSucceeded(encodeFundCashPaymentSucceededPO(e)))
    case e: FundOrderEvents.FundCashPaymentRejectedBeforeEffects => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentRejectedBeforeEffects(encodeFundCashPaymentRejectedBeforeEffectsPO(e)))
    case e: FundOrderEvents.FundCashPaymentCompensated => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentCompensated(encodeFundCashPaymentCompensatedPO(e)))
    case e: FundOrderEvents.FundCashPaymentRecoveryRequired => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentRecoveryRequired(encodeFundCashPaymentRecoveryRequiredPO(e)))
    case e: FundOrderEvents.FundCashPaymentOutcomeUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundCashPaymentOutcomeUnknown(encodeFundCashPaymentOutcomeUnknownPO(e)))
    case e: FundOrderEvents.FundTASubmissionRegistered => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTASubmissionRegistered(encodeFundTASubmissionRegisteredPO(e)))
    case e: FundOrderEvents.FundTAAccepted => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTAAccepted(encodeFundTAAcceptedPO(e)))
    case e: FundOrderEvents.FundTASharesConfirmed => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTASharesConfirmed(encodeFundTASharesConfirmedPO(e)))
    case e: FundOrderEvents.FundTARejected => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTARejected(encodeFundTARejectedPO(e)))
    case e: FundOrderEvents.FundTAUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTAUnknown(encodeFundTAUnknownPO(e)))
    case e: FundOrderEvents.FundPurchaseRefundRequested => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundPurchaseRefundRequested(encodeFundPurchaseRefundRequestedPO(e)))
    case e: FundOrderEvents.FundRefundSucceeded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundSucceeded(encodeFundRefundSucceededPO(e)))
    case e: FundOrderEvents.FundRefundRejectedBeforeEffects => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundRejectedBeforeEffects(encodeFundRefundRejectedBeforeEffectsPO(e)))
    case e: FundOrderEvents.FundRefundCompensated => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundCompensated(encodeFundRefundCompensatedPO(e)))
    case e: FundOrderEvents.FundRefundRecoveryRequired => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundRecoveryRequired(encodeFundRefundRecoveryRequiredPO(e)))
    case e: FundOrderEvents.FundRefundOutcomeUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundRefundOutcomeUnknown(encodeFundRefundOutcomeUnknownPO(e)))
    case e: FundOrderEvents.FundTAReceiptObserved => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.FundTAReceiptObserved(encodeFundTAReceiptObservedPO(e)))
    case e: FundOrderEvents.BankPaymentResultSucceeded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultSucceeded(encodeBankPaymentResultSucceededPO(e)))
    case e: FundOrderEvents.BankPaymentResultRejectedBeforeEffects => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultRejectedBeforeEffects(encodeBankPaymentResultRejectedBeforeEffectsPO(e)))
    case e: FundOrderEvents.BankPaymentResultCompensated => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultCompensated(encodeBankPaymentResultCompensatedPO(e)))
    case e: FundOrderEvents.BankPaymentResultRecoveryRequired => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultRecoveryRequired(encodeBankPaymentResultRecoveryRequiredPO(e)))
    case e: FundOrderEvents.BankPaymentResultOutcomeUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankPaymentResultOutcomeUnknown(encodeBankPaymentResultOutcomeUnknownPO(e)))
    case e: FundOrderEvents.BankRefundResultSucceeded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultSucceeded(encodeBankRefundResultSucceededPO(e)))
    case e: FundOrderEvents.BankRefundResultRejectedBeforeEffects => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultRejectedBeforeEffects(encodeBankRefundResultRejectedBeforeEffectsPO(e)))
    case e: FundOrderEvents.BankRefundResultCompensated => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultCompensated(encodeBankRefundResultCompensatedPO(e)))
    case e: FundOrderEvents.BankRefundResultRecoveryRequired => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultRecoveryRequired(encodeBankRefundResultRecoveryRequiredPO(e)))
    case e: FundOrderEvents.BankRefundResultOutcomeUnknown => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.BankRefundResultOutcomeUnknown(encodeBankRefundResultOutcomeUnknownPO(e)))
    case e: FundOrderEvents.CashRequestSourceRecorded => pb.FundOrderEventPO(pb.FundOrderEventPO.Event.CashRequestSourceRecorded(encodeCashRequestSourceRecordedPO(e)))
  }
  def decodeFundOrderEventPO(value: pb.FundOrderEventPO): FundOrderEvents.Event = value.event match {
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
