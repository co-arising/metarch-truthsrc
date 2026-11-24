package example.bankwealth.infrastructure.serialization

import example.bankwealth.domain._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.proto._
trait DomainConvertersPart2 { self: DomainConverters.type =>
  def encodeFundOrderStatePBField23(value: Map[String, String]): FundOrderStatePBField23 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField23Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField23(rows) }
  def decodeFundOrderStatePBField23(value: FundOrderStatePBField23): Map[String, String] = { val rows = value.f0.map(item => decodeFundOrderStatePBField23Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField23Entry(value: (String, String)): FundOrderStatePBField23Entry = FundOrderStatePBField23Entry(value._1, value._2)
  def decodeFundOrderStatePBField23Entry(value: FundOrderStatePBField23Entry): (String, String) = (value.f0, value.f1)
  def encodeFundOrderStatePBField24(value: Map[TxId, String]): FundOrderStatePBField24 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField24Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField24(rows) }
  def decodeFundOrderStatePBField24(value: FundOrderStatePBField24): Map[TxId, String] = { val rows = value.f0.map(item => decodeFundOrderStatePBField24Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField24Entry(value: (TxId, String)): FundOrderStatePBField24Entry = FundOrderStatePBField24Entry(Some(encodeTxIdPB(value._1)), value._2)
  def decodeFundOrderStatePBField24Entry(value: FundOrderStatePBField24Entry): (TxId, String) = (decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderStatePBField25(value: Map[String, String]): FundOrderStatePBField25 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField25Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField25(rows) }
  def decodeFundOrderStatePBField25(value: FundOrderStatePBField25): Map[String, String] = { val rows = value.f0.map(item => decodeFundOrderStatePBField25Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField25Entry(value: (String, String)): FundOrderStatePBField25Entry = FundOrderStatePBField25Entry(value._1, value._2)
  def decodeFundOrderStatePBField25Entry(value: FundOrderStatePBField25Entry): (String, String) = (value.f0, value.f1)
  def encodeFundOrderStatePBField26(value: Map[TxId, String]): FundOrderStatePBField26 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField26Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField26(rows) }
  def decodeFundOrderStatePBField26(value: FundOrderStatePBField26): Map[TxId, String] = { val rows = value.f0.map(item => decodeFundOrderStatePBField26Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField26Entry(value: (TxId, String)): FundOrderStatePBField26Entry = FundOrderStatePBField26Entry(Some(encodeTxIdPB(value._1)), value._2)
  def decodeFundOrderStatePBField26Entry(value: FundOrderStatePBField26Entry): (TxId, String) = (decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderStatePBField27(value: Map[TxId, String]): FundOrderStatePBField27 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField27Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField27(rows) }
  def decodeFundOrderStatePBField27(value: FundOrderStatePBField27): Map[TxId, String] = { val rows = value.f0.map(item => decodeFundOrderStatePBField27Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField27Entry(value: (TxId, String)): FundOrderStatePBField27Entry = FundOrderStatePBField27Entry(Some(encodeTxIdPB(value._1)), value._2)
  def decodeFundOrderStatePBField27Entry(value: FundOrderStatePBField27Entry): (TxId, String) = (decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderStatePBField28(value: Option[BankCashOriginal]): FundOrderStatePBField28 = value match { case None => FundOrderStatePBField28(present = false); case Some(item) => FundOrderStatePBField28(present = true, f0 = Some(encodeBankCashOriginalPB(item))) }
  def decodeFundOrderStatePBField28(value: FundOrderStatePBField28): Option[BankCashOriginal] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankCashOriginalPB(req(value.f0)))
  def encodeFundOrderStatePBField29(value: Map[String, BankCashOriginal]): FundOrderStatePBField29 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField29Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField29(rows) }
  def decodeFundOrderStatePBField29(value: FundOrderStatePBField29): Map[String, BankCashOriginal] = { val rows = value.f0.map(item => decodeFundOrderStatePBField29Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField29Entry(value: (String, BankCashOriginal)): FundOrderStatePBField29Entry = FundOrderStatePBField29Entry(value._1, Some(encodeBankCashOriginalPB(value._2)))
  def decodeFundOrderStatePBField29Entry(value: FundOrderStatePBField29Entry): (String, BankCashOriginal) = (value.f0, decodeBankCashOriginalPB(req(value.f1)))
  def encodeFundOrderStatePB(value: FundOrderState): FundOrderStatePB = FundOrderStatePB(
    Some(encodeFundOrderIdPB(value.id)),
    value.status,
    Some(encodeOperationIdPB(value.operationId)),
    Some(encodeAccountIdPB(value.investorAccountId)),
    Some(encodeAccountIdPB(value.fundCollectionAccountId)),
    value.fundCode,
    Some(encodeMoneyPB(value.amount)),
    Some(encodeFundOrderStatePBField7(value.reservedSubscriptions)),
    Some(encodeFundOrderStatePBField8(value.committedSubscriptions)),
    Some(encodeFundOrderStatePBField9(value.compensatedSubscriptions)),
    Some(encodeTxIdPB(value.selectedPaymentTxId)),
    value.paymentOutcome,
    Some(encodeFundOrderStatePBField12(value.cashPaymentResults)),
    Some(encodeFundOrderStatePBField13(value.cashPaymentFinalResults)),
    Some(encodeTaRequestIdPB(value.taRequestId)),
    value.taReference,
    value.taStatus,
    Some(encodeFundOrderStatePBField17(value.taReceipts)),
    Some(encodeFundOrderStatePBField18(value.taReceiptOutcomes)),
    Some(encodeFundSharePB(value.taConfirmedShares)),
    value.taRejectionReason,
    Some(encodeOperationIdPB(value.refundOperationId)),
    value.refundOutcome,
    Some(encodeFundOrderStatePBField23(value.refundResultReceipts)),
    Some(encodeFundOrderStatePBField24(value.refundFinalResults)),
    Some(encodeFundOrderStatePBField25(value.taObservedReceipts)),
    Some(encodeFundOrderStatePBField26(value.paymentObservedResults)),
    Some(encodeFundOrderStatePBField27(value.refundObservedResults)),
    Some(encodeFundOrderStatePBField28(value.cashRequestSource)),
    Some(encodeFundOrderStatePBField29(value.cashRequestOriginals))
  )
  def decodeFundOrderStatePB(value: FundOrderStatePB): FundOrderState = FundOrderState(
    decodeFundOrderIdPB(req(value.f0)),
    value.f1,
    decodeOperationIdPB(req(value.f2)),
    decodeAccountIdPB(req(value.f3)),
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    decodeMoneyPB(req(value.f6)),
    decodeFundOrderStatePBField7(req(value.f7)),
    decodeFundOrderStatePBField8(req(value.f8)),
    decodeFundOrderStatePBField9(req(value.f9)),
    decodeTxIdPB(req(value.f10)),
    value.f11,
    decodeFundOrderStatePBField12(req(value.f12)),
    decodeFundOrderStatePBField13(req(value.f13)),
    decodeTaRequestIdPB(req(value.f14)),
    value.f15,
    value.f16,
    decodeFundOrderStatePBField17(req(value.f17)),
    decodeFundOrderStatePBField18(req(value.f18)),
    decodeFundSharePB(req(value.f19)),
    value.f20,
    decodeOperationIdPB(req(value.f21)),
    value.f22,
    decodeFundOrderStatePBField23(req(value.f23)),
    decodeFundOrderStatePBField24(req(value.f24)),
    decodeFundOrderStatePBField25(req(value.f25)),
    decodeFundOrderStatePBField26(req(value.f26)),
    decodeFundOrderStatePBField27(req(value.f27)),
    decodeFundOrderStatePBField28(req(value.f28)),
    decodeFundOrderStatePBField29(req(value.f29))
  )
  def encodeFundOrderFundPurchaseSettlementRequestedPB(value: FundOrderProtocol.FundPurchaseSettlementRequested): FundOrderFundPurchaseSettlementRequestedPB = FundOrderFundPurchaseSettlementRequestedPB(
    Some(encodeOperationIdPB(value.operationId)),
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeAccountIdPB(value.investorAccountId)),
    Some(encodeAccountIdPB(value.fundCollectionAccountId)),
    value.fundCode,
    Some(encodeMoneyPB(value.amount))
  )
  def decodeFundOrderFundPurchaseSettlementRequestedPB(value: FundOrderFundPurchaseSettlementRequestedPB): FundOrderProtocol.FundPurchaseSettlementRequested = FundOrderProtocol.FundPurchaseSettlementRequested(
    decodeOperationIdPB(req(value.f0)),
    decodeFundOrderIdPB(req(value.f1)),
    decodeAccountIdPB(req(value.f2)),
    decodeAccountIdPB(req(value.f3)),
    value.f4,
    decodeMoneyPB(req(value.f5))
  )
  def encodeFundOrderReserveFundSubscriptionConfirmedPB(value: FundOrderProtocol.ReserveFundSubscriptionConfirmed): FundOrderReserveFundSubscriptionConfirmedPB = FundOrderReserveFundSubscriptionConfirmedPB(Some(encodeTxIdPB(value.txid)), Some(encodeFundOrderIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeFundOrderReserveFundSubscriptionConfirmedPB(value: FundOrderReserveFundSubscriptionConfirmedPB): FundOrderProtocol.ReserveFundSubscriptionConfirmed = FundOrderProtocol.ReserveFundSubscriptionConfirmed(decodeTxIdPB(req(value.f0)), decodeFundOrderIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeFundOrderFundSubscriptionPaymentConfirmedPB(value: FundOrderProtocol.FundSubscriptionPaymentConfirmed): FundOrderFundSubscriptionPaymentConfirmedPB = FundOrderFundSubscriptionPaymentConfirmedPB(Some(encodeTxIdPB(value.txid)), Some(encodeFundOrderIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeFundOrderFundSubscriptionPaymentConfirmedPB(value: FundOrderFundSubscriptionPaymentConfirmedPB): FundOrderProtocol.FundSubscriptionPaymentConfirmed = FundOrderProtocol.FundSubscriptionPaymentConfirmed(decodeTxIdPB(req(value.f0)), decodeFundOrderIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeFundOrderCashFundSubscriptionCanceledPB(value: FundOrderProtocol.CashFundSubscriptionCanceled): FundOrderCashFundSubscriptionCanceledPB = FundOrderCashFundSubscriptionCanceledPB(Some(encodeTxIdPB(value.txid)), Some(encodeFundOrderIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeFundOrderCashFundSubscriptionCanceledPB(value: FundOrderCashFundSubscriptionCanceledPB): FundOrderProtocol.CashFundSubscriptionCanceled = FundOrderProtocol.CashFundSubscriptionCanceled(decodeTxIdPB(req(value.f0)), decodeFundOrderIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeFundOrderFundCashPaymentSucceededPB(value: FundOrderProtocol.FundCashPaymentSucceeded): FundOrderFundCashPaymentSucceededPB = FundOrderFundCashPaymentSucceededPB(Some(encodeTxIdPB(value.txid)), value.kind)
  def decodeFundOrderFundCashPaymentSucceededPB(value: FundOrderFundCashPaymentSucceededPB): FundOrderProtocol.FundCashPaymentSucceeded = FundOrderProtocol.FundCashPaymentSucceeded(decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderFundCashPaymentRejectedBeforeEffectsPB(value: FundOrderProtocol.FundCashPaymentRejectedBeforeEffects): FundOrderFundCashPaymentRejectedBeforeEffectsPB = FundOrderFundCashPaymentRejectedBeforeEffectsPB(Some(encodeTxIdPB(value.txid)), value.kind)
  def decodeFundOrderFundCashPaymentRejectedBeforeEffectsPB(value: FundOrderFundCashPaymentRejectedBeforeEffectsPB): FundOrderProtocol.FundCashPaymentRejectedBeforeEffects = FundOrderProtocol.FundCashPaymentRejectedBeforeEffects(decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderFundCashPaymentCompensatedPB(value: FundOrderProtocol.FundCashPaymentCompensated): FundOrderFundCashPaymentCompensatedPB = FundOrderFundCashPaymentCompensatedPB(Some(encodeTxIdPB(value.txid)), value.kind)
  def decodeFundOrderFundCashPaymentCompensatedPB(value: FundOrderFundCashPaymentCompensatedPB): FundOrderProtocol.FundCashPaymentCompensated = FundOrderProtocol.FundCashPaymentCompensated(decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderFundCashPaymentRecoveryRequiredPB(value: FundOrderProtocol.FundCashPaymentRecoveryRequired): FundOrderFundCashPaymentRecoveryRequiredPB = FundOrderFundCashPaymentRecoveryRequiredPB(Some(encodeTxIdPB(value.txid)), value.kind)
  def decodeFundOrderFundCashPaymentRecoveryRequiredPB(value: FundOrderFundCashPaymentRecoveryRequiredPB): FundOrderProtocol.FundCashPaymentRecoveryRequired = FundOrderProtocol.FundCashPaymentRecoveryRequired(decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderFundCashPaymentOutcomeUnknownPB(value: FundOrderProtocol.FundCashPaymentOutcomeUnknown): FundOrderFundCashPaymentOutcomeUnknownPB = FundOrderFundCashPaymentOutcomeUnknownPB(Some(encodeTxIdPB(value.txid)), value.kind)
  def decodeFundOrderFundCashPaymentOutcomeUnknownPB(value: FundOrderFundCashPaymentOutcomeUnknownPB): FundOrderProtocol.FundCashPaymentOutcomeUnknown = FundOrderProtocol.FundCashPaymentOutcomeUnknown(decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderFundTASubmissionRegisteredPB(value: FundOrderProtocol.FundTASubmissionRegistered): FundOrderFundTASubmissionRegisteredPB = FundOrderFundTASubmissionRegisteredPB(Some(encodeFundOrderIdPB(value.fundOrderId)), Some(encodeTxIdPB(value.paymentTxId)), Some(encodeTaRequestIdPB(value.taRequestId)))
  def decodeFundOrderFundTASubmissionRegisteredPB(value: FundOrderFundTASubmissionRegisteredPB): FundOrderProtocol.FundTASubmissionRegistered = FundOrderProtocol.FundTASubmissionRegistered(decodeFundOrderIdPB(req(value.f0)), decodeTxIdPB(req(value.f1)), decodeTaRequestIdPB(req(value.f2)))
  def encodeFundOrderFundTAAcceptedPB(value: FundOrderProtocol.FundTAAccepted): FundOrderFundTAAcceptedPB = FundOrderFundTAAcceptedPB(
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeTxIdPB(value.paymentTxId)),
    Some(encodeTaRequestIdPB(value.taRequestId)),
    value.taReference,
    value.receiptId,
    value.receiptBody,
    value.fundCode,
    value.currency,
    value.outcome
  )
  def decodeFundOrderFundTAAcceptedPB(value: FundOrderFundTAAcceptedPB): FundOrderProtocol.FundTAAccepted = FundOrderProtocol.FundTAAccepted(
    decodeFundOrderIdPB(req(value.f0)),
    decodeTxIdPB(req(value.f1)),
    decodeTaRequestIdPB(req(value.f2)),
    value.f3,
    value.f4,
    value.f5,
    value.f6,
    value.f7,
    value.f8
  )
  def encodeFundOrderFundTASharesConfirmedPB(value: FundOrderProtocol.FundTASharesConfirmed): FundOrderFundTASharesConfirmedPB = FundOrderFundTASharesConfirmedPB(
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeTxIdPB(value.paymentTxId)),
    Some(encodeTaRequestIdPB(value.taRequestId)),
    value.taReference,
    value.receiptId,
    value.receiptBody,
    value.fundCode,
    value.currency,
    Some(encodeFundSharePB(value.shares)),
    value.outcome
  )
  def decodeFundOrderFundTASharesConfirmedPB(value: FundOrderFundTASharesConfirmedPB): FundOrderProtocol.FundTASharesConfirmed = FundOrderProtocol.FundTASharesConfirmed(
    decodeFundOrderIdPB(req(value.f0)),
    decodeTxIdPB(req(value.f1)),
    decodeTaRequestIdPB(req(value.f2)),
    value.f3,
    value.f4,
    value.f5,
    value.f6,
    value.f7,
    decodeFundSharePB(req(value.f8)),
    value.f9
  )
  def encodeFundOrderFundTARejectedPB(value: FundOrderProtocol.FundTARejected): FundOrderFundTARejectedPB = FundOrderFundTARejectedPB(
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeTxIdPB(value.paymentTxId)),
    Some(encodeTaRequestIdPB(value.taRequestId)),
    value.taReference,
    value.receiptId,
    value.receiptBody,
    value.fundCode,
    value.currency,
    value.reason,
    value.outcome
  )
  def decodeFundOrderFundTARejectedPB(value: FundOrderFundTARejectedPB): FundOrderProtocol.FundTARejected = FundOrderProtocol.FundTARejected(
    decodeFundOrderIdPB(req(value.f0)),
    decodeTxIdPB(req(value.f1)),
    decodeTaRequestIdPB(req(value.f2)),
    value.f3,
    value.f4,
    value.f5,
    value.f6,
    value.f7,
    value.f8,
    value.f9
  )
  def encodeFundOrderFundTAUnknownPB(value: FundOrderProtocol.FundTAUnknown): FundOrderFundTAUnknownPB = FundOrderFundTAUnknownPB(
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeTxIdPB(value.paymentTxId)),
    Some(encodeTaRequestIdPB(value.taRequestId)),
    value.taReference,
    value.receiptId,
    value.receiptBody,
    value.fundCode,
    value.currency,
    value.outcome
  )
  def decodeFundOrderFundTAUnknownPB(value: FundOrderFundTAUnknownPB): FundOrderProtocol.FundTAUnknown = FundOrderProtocol.FundTAUnknown(
    decodeFundOrderIdPB(req(value.f0)),
    decodeTxIdPB(req(value.f1)),
    decodeTaRequestIdPB(req(value.f2)),
    value.f3,
    value.f4,
    value.f5,
    value.f6,
    value.f7,
    value.f8
  )
  def encodeFundOrderFundPurchaseRefundRequestedPB(value: FundOrderProtocol.FundPurchaseRefundRequested): FundOrderFundPurchaseRefundRequestedPB = FundOrderFundPurchaseRefundRequestedPB(
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeTxIdPB(value.paymentTxId)),
    Some(encodeAccountIdPB(value.investorAccountId)),
    Some(encodeAccountIdPB(value.fundCollectionAccountId)),
    Some(encodeMoneyPB(value.amount)),
    Some(encodeOperationIdPB(value.refundOperationId))
  )
  def decodeFundOrderFundPurchaseRefundRequestedPB(value: FundOrderFundPurchaseRefundRequestedPB): FundOrderProtocol.FundPurchaseRefundRequested = FundOrderProtocol.FundPurchaseRefundRequested(
    decodeFundOrderIdPB(req(value.f0)),
    decodeTxIdPB(req(value.f1)),
    decodeAccountIdPB(req(value.f2)),
    decodeAccountIdPB(req(value.f3)),
    decodeMoneyPB(req(value.f4)),
    decodeOperationIdPB(req(value.f5))
  )
  def encodeFundOrderFundRefundSucceededPB(value: FundOrderProtocol.FundRefundSucceeded): FundOrderFundRefundSucceededPB = FundOrderFundRefundSucceededPB(
    Some(encodeTxIdPB(value.refundTxId)),
    Some(encodeOperationIdPB(value.refundOperationId)),
    value.receiptId,
    value.receiptBody,
    value.kind
  )
  def decodeFundOrderFundRefundSucceededPB(value: FundOrderFundRefundSucceededPB): FundOrderProtocol.FundRefundSucceeded = FundOrderProtocol.FundRefundSucceeded(
    decodeTxIdPB(req(value.f0)),
    decodeOperationIdPB(req(value.f1)),
    value.f2,
    value.f3,
    value.f4
  )
  def encodeFundOrderFundRefundRejectedBeforeEffectsPB(value: FundOrderProtocol.FundRefundRejectedBeforeEffects): FundOrderFundRefundRejectedBeforeEffectsPB = FundOrderFundRefundRejectedBeforeEffectsPB(
    Some(encodeTxIdPB(value.refundTxId)),
    Some(encodeOperationIdPB(value.refundOperationId)),
    value.receiptId,
    value.receiptBody,
    value.kind
  )
  def decodeFundOrderFundRefundRejectedBeforeEffectsPB(value: FundOrderFundRefundRejectedBeforeEffectsPB): FundOrderProtocol.FundRefundRejectedBeforeEffects = FundOrderProtocol.FundRefundRejectedBeforeEffects(
    decodeTxIdPB(req(value.f0)),
    decodeOperationIdPB(req(value.f1)),
    value.f2,
    value.f3,
    value.f4
  )
  def encodeFundOrderFundRefundCompensatedPB(value: FundOrderProtocol.FundRefundCompensated): FundOrderFundRefundCompensatedPB = FundOrderFundRefundCompensatedPB(
    Some(encodeTxIdPB(value.refundTxId)),
    Some(encodeOperationIdPB(value.refundOperationId)),
    value.receiptId,
    value.receiptBody,
    value.kind
  )
  def decodeFundOrderFundRefundCompensatedPB(value: FundOrderFundRefundCompensatedPB): FundOrderProtocol.FundRefundCompensated = FundOrderProtocol.FundRefundCompensated(
    decodeTxIdPB(req(value.f0)),
    decodeOperationIdPB(req(value.f1)),
    value.f2,
    value.f3,
    value.f4
  )
  def encodeFundOrderFundRefundRecoveryRequiredPB(value: FundOrderProtocol.FundRefundRecoveryRequired): FundOrderFundRefundRecoveryRequiredPB = FundOrderFundRefundRecoveryRequiredPB(
    Some(encodeTxIdPB(value.refundTxId)),
    Some(encodeOperationIdPB(value.refundOperationId)),
    value.receiptId,
    value.receiptBody,
    value.kind
  )
  def decodeFundOrderFundRefundRecoveryRequiredPB(value: FundOrderFundRefundRecoveryRequiredPB): FundOrderProtocol.FundRefundRecoveryRequired = FundOrderProtocol.FundRefundRecoveryRequired(
    decodeTxIdPB(req(value.f0)),
    decodeOperationIdPB(req(value.f1)),
    value.f2,
    value.f3,
    value.f4
  )
  def encodeFundOrderFundRefundOutcomeUnknownPB(value: FundOrderProtocol.FundRefundOutcomeUnknown): FundOrderFundRefundOutcomeUnknownPB = FundOrderFundRefundOutcomeUnknownPB(
    Some(encodeTxIdPB(value.refundTxId)),
    Some(encodeOperationIdPB(value.refundOperationId)),
    value.receiptId,
    value.receiptBody,
    value.kind
  )
  def decodeFundOrderFundRefundOutcomeUnknownPB(value: FundOrderFundRefundOutcomeUnknownPB): FundOrderProtocol.FundRefundOutcomeUnknown = FundOrderProtocol.FundRefundOutcomeUnknown(
    decodeTxIdPB(req(value.f0)),
    decodeOperationIdPB(req(value.f1)),
    value.f2,
    value.f3,
    value.f4
  )
  def encodeFundOrderFundTAReceiptObservedPB(value: FundOrderProtocol.FundTAReceiptObserved): FundOrderFundTAReceiptObservedPB = FundOrderFundTAReceiptObservedPB(
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeTxIdPB(value.paymentTxId)),
    Some(encodeTaRequestIdPB(value.taRequestId)),
    Some(encodeAccountIdPB(value.investorAccountId)),
    Some(encodeAccountIdPB(value.fundCollectionAccountId)),
    value.fundCode,
    Some(encodeMoneyPB(value.amount)),
    Some(encodeAmountDecimalPB(value.principal)),
    value.receiptId,
    value.receiptBody,
    value.taReference,
    value.status,
    Some(encodeTaExactTextPB(value.shares)),
    Some(encodeTaExactTextPB(value.nav)),
    value.reason
  )
  def decodeFundOrderFundTAReceiptObservedPB(value: FundOrderFundTAReceiptObservedPB): FundOrderProtocol.FundTAReceiptObserved = FundOrderProtocol.FundTAReceiptObserved(
    decodeFundOrderIdPB(req(value.f0)),
    decodeTxIdPB(req(value.f1)),
    decodeTaRequestIdPB(req(value.f2)),
    decodeAccountIdPB(req(value.f3)),
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    decodeMoneyPB(req(value.f6)),
    decodeAmountDecimalPB(req(value.f7)),
    value.f8,
    value.f9,
    value.f10,
    value.f11,
    decodeTaExactTextPB(req(value.f12)),
    decodeTaExactTextPB(req(value.f13)),
    value.f14
  )
  def encodeFundOrderBankPaymentResultSucceededPB(value: FundOrderProtocol.BankPaymentResultSucceeded): FundOrderBankPaymentResultSucceededPB = FundOrderBankPaymentResultSucceededPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankPaymentResultSucceededPB(value: FundOrderBankPaymentResultSucceededPB): FundOrderProtocol.BankPaymentResultSucceeded = FundOrderProtocol.BankPaymentResultSucceeded(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderBankPaymentResultRejectedBeforeEffectsPB(value: FundOrderProtocol.BankPaymentResultRejectedBeforeEffects): FundOrderBankPaymentResultRejectedBeforeEffectsPB = FundOrderBankPaymentResultRejectedBeforeEffectsPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankPaymentResultRejectedBeforeEffectsPB(value: FundOrderBankPaymentResultRejectedBeforeEffectsPB): FundOrderProtocol.BankPaymentResultRejectedBeforeEffects = FundOrderProtocol.BankPaymentResultRejectedBeforeEffects(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderBankPaymentResultCompensatedPB(value: FundOrderProtocol.BankPaymentResultCompensated): FundOrderBankPaymentResultCompensatedPB = FundOrderBankPaymentResultCompensatedPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankPaymentResultCompensatedPB(value: FundOrderBankPaymentResultCompensatedPB): FundOrderProtocol.BankPaymentResultCompensated = FundOrderProtocol.BankPaymentResultCompensated(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderBankPaymentResultRecoveryRequiredPB(value: FundOrderProtocol.BankPaymentResultRecoveryRequired): FundOrderBankPaymentResultRecoveryRequiredPB = FundOrderBankPaymentResultRecoveryRequiredPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankPaymentResultRecoveryRequiredPB(value: FundOrderBankPaymentResultRecoveryRequiredPB): FundOrderProtocol.BankPaymentResultRecoveryRequired = FundOrderProtocol.BankPaymentResultRecoveryRequired(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderBankPaymentResultOutcomeUnknownPB(value: FundOrderProtocol.BankPaymentResultOutcomeUnknown): FundOrderBankPaymentResultOutcomeUnknownPB = FundOrderBankPaymentResultOutcomeUnknownPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankPaymentResultOutcomeUnknownPB(value: FundOrderBankPaymentResultOutcomeUnknownPB): FundOrderProtocol.BankPaymentResultOutcomeUnknown = FundOrderProtocol.BankPaymentResultOutcomeUnknown(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderBankRefundResultSucceededPB(value: FundOrderProtocol.BankRefundResultSucceeded): FundOrderBankRefundResultSucceededPB = FundOrderBankRefundResultSucceededPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankRefundResultSucceededPB(value: FundOrderBankRefundResultSucceededPB): FundOrderProtocol.BankRefundResultSucceeded = FundOrderProtocol.BankRefundResultSucceeded(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderBankRefundResultRejectedBeforeEffectsPB(value: FundOrderProtocol.BankRefundResultRejectedBeforeEffects): FundOrderBankRefundResultRejectedBeforeEffectsPB = FundOrderBankRefundResultRejectedBeforeEffectsPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankRefundResultRejectedBeforeEffectsPB(value: FundOrderBankRefundResultRejectedBeforeEffectsPB): FundOrderProtocol.BankRefundResultRejectedBeforeEffects = FundOrderProtocol.BankRefundResultRejectedBeforeEffects(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderBankRefundResultCompensatedPB(value: FundOrderProtocol.BankRefundResultCompensated): FundOrderBankRefundResultCompensatedPB = FundOrderBankRefundResultCompensatedPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankRefundResultCompensatedPB(value: FundOrderBankRefundResultCompensatedPB): FundOrderProtocol.BankRefundResultCompensated = FundOrderProtocol.BankRefundResultCompensated(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderBankRefundResultRecoveryRequiredPB(value: FundOrderProtocol.BankRefundResultRecoveryRequired): FundOrderBankRefundResultRecoveryRequiredPB = FundOrderBankRefundResultRecoveryRequiredPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankRefundResultRecoveryRequiredPB(value: FundOrderBankRefundResultRecoveryRequiredPB): FundOrderProtocol.BankRefundResultRecoveryRequired = FundOrderProtocol.BankRefundResultRecoveryRequired(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderBankRefundResultOutcomeUnknownPB(value: FundOrderProtocol.BankRefundResultOutcomeUnknown): FundOrderBankRefundResultOutcomeUnknownPB = FundOrderBankRefundResultOutcomeUnknownPB(Some(encodeTxIdPB(value.txid)))
  def decodeFundOrderBankRefundResultOutcomeUnknownPB(value: FundOrderBankRefundResultOutcomeUnknownPB): FundOrderProtocol.BankRefundResultOutcomeUnknown = FundOrderProtocol.BankRefundResultOutcomeUnknown(decodeTxIdPB(req(value.f0)))
  def encodeFundOrderCashRequestSourceRecordedPBField1(value: Option[BankCashOriginal]): FundOrderCashRequestSourceRecordedPBField1 = value match { case None => FundOrderCashRequestSourceRecordedPBField1(present = false); case Some(item) => FundOrderCashRequestSourceRecordedPBField1(present = true, f0 = Some(encodeBankCashOriginalPB(item))) }
  def decodeFundOrderCashRequestSourceRecordedPBField1(value: FundOrderCashRequestSourceRecordedPBField1): Option[BankCashOriginal] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankCashOriginalPB(req(value.f0)))
  def encodeFundOrderCashRequestSourceRecordedPB(value: FundOrderProtocol.CashRequestSourceRecorded): FundOrderCashRequestSourceRecordedPB = FundOrderCashRequestSourceRecordedPB(Some(encodeBankCashOriginalPB(value.original)), Some(encodeFundOrderCashRequestSourceRecordedPBField1(value.source)))
  def decodeFundOrderCashRequestSourceRecordedPB(value: FundOrderCashRequestSourceRecordedPB): FundOrderProtocol.CashRequestSourceRecorded = FundOrderProtocol.CashRequestSourceRecorded(decodeBankCashOriginalPB(req(value.f0)), decodeFundOrderCashRequestSourceRecordedPBField1(req(value.f1)))
  def encodeSipPlanStatePBField5(value: Map[Long, Long]): SipPlanStatePBField5 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField5Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField5(rows) }
  def decodeSipPlanStatePBField5(value: SipPlanStatePBField5): Map[Long, Long] = { val rows = value.f0.map(item => decodeSipPlanStatePBField5Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField5Entry(value: (Long, Long)): SipPlanStatePBField5Entry = SipPlanStatePBField5Entry(value._1, value._2)
  def decodeSipPlanStatePBField5Entry(value: SipPlanStatePBField5Entry): (Long, Long) = (value.f0, value.f1)
  def encodeSipPlanStatePBField11(value: Map[Long, Long]): SipPlanStatePBField11 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField11Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField11(rows) }
  def decodeSipPlanStatePBField11(value: SipPlanStatePBField11): Map[Long, Long] = { val rows = value.f0.map(item => decodeSipPlanStatePBField11Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField11Entry(value: (Long, Long)): SipPlanStatePBField11Entry = SipPlanStatePBField11Entry(value._1, value._2)
  def decodeSipPlanStatePBField11Entry(value: SipPlanStatePBField11Entry): (Long, Long) = (value.f0, value.f1)
  def encodeSipPlanStatePBField12(value: Map[RevisionId, SipRevisionConfig]): SipPlanStatePBField12 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField12Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField12(rows) }
  def decodeSipPlanStatePBField12(value: SipPlanStatePBField12): Map[RevisionId, SipRevisionConfig] = { val rows = value.f0.map(item => decodeSipPlanStatePBField12Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField12Entry(value: (RevisionId, SipRevisionConfig)): SipPlanStatePBField12Entry = SipPlanStatePBField12Entry(Some(encodeRevisionIdPB(value._1)), Some(encodeSipRevisionConfigPB(value._2)))
  def decodeSipPlanStatePBField12Entry(value: SipPlanStatePBField12Entry): (RevisionId, SipRevisionConfig) = (decodeRevisionIdPB(req(value.f0)), decodeSipRevisionConfigPB(req(value.f1)))
  def encodeSipPlanStatePBField13(value: Map[RevisionId, Long]): SipPlanStatePBField13 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField13Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField13(rows) }
  def decodeSipPlanStatePBField13(value: SipPlanStatePBField13): Map[RevisionId, Long] = { val rows = value.f0.map(item => decodeSipPlanStatePBField13Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField13Entry(value: (RevisionId, Long)): SipPlanStatePBField13Entry = SipPlanStatePBField13Entry(Some(encodeRevisionIdPB(value._1)), value._2)
  def decodeSipPlanStatePBField13Entry(value: SipPlanStatePBField13Entry): (RevisionId, Long) = (decodeRevisionIdPB(req(value.f0)), value.f1)
  def encodeSipPlanStatePBField16(value: Map[Long, String]): SipPlanStatePBField16 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField16Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField16(rows) }
  def decodeSipPlanStatePBField16(value: SipPlanStatePBField16): Map[Long, String] = { val rows = value.f0.map(item => decodeSipPlanStatePBField16Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField16Entry(value: (Long, String)): SipPlanStatePBField16Entry = SipPlanStatePBField16Entry(value._1, value._2)
  def decodeSipPlanStatePBField16Entry(value: SipPlanStatePBField16Entry): (Long, String) = (value.f0, value.f1)
  def encodeSipPlanStatePBField17(value: Map[Long, SipOccurrence]): SipPlanStatePBField17 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField17Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField17(rows) }
  def decodeSipPlanStatePBField17(value: SipPlanStatePBField17): Map[Long, SipOccurrence] = { val rows = value.f0.map(item => decodeSipPlanStatePBField17Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField17Entry(value: (Long, SipOccurrence)): SipPlanStatePBField17Entry = SipPlanStatePBField17Entry(value._1, Some(encodeSipOccurrencePB(value._2)))
  def decodeSipPlanStatePBField17Entry(value: SipPlanStatePBField17Entry): (Long, SipOccurrence) = (value.f0, decodeSipOccurrencePB(req(value.f1)))
  def encodeSipPlanStatePBField18(value: Map[OccurrenceId, String]): SipPlanStatePBField18 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField18Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField18(rows) }
  def decodeSipPlanStatePBField18(value: SipPlanStatePBField18): Map[OccurrenceId, String] = { val rows = value.f0.map(item => decodeSipPlanStatePBField18Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField18Entry(value: (OccurrenceId, String)): SipPlanStatePBField18Entry = SipPlanStatePBField18Entry(Some(encodeOccurrenceIdPB(value._1)), value._2)
  def decodeSipPlanStatePBField18Entry(value: SipPlanStatePBField18Entry): (OccurrenceId, String) = (decodeOccurrenceIdPB(req(value.f0)), value.f1)
  def encodeSipPlanStatePBField19(value: Map[OccurrenceId, String]): SipPlanStatePBField19 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField19Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField19(rows) }
  def decodeSipPlanStatePBField19(value: SipPlanStatePBField19): Map[OccurrenceId, String] = { val rows = value.f0.map(item => decodeSipPlanStatePBField19Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField19Entry(value: (OccurrenceId, String)): SipPlanStatePBField19Entry = SipPlanStatePBField19Entry(Some(encodeOccurrenceIdPB(value._1)), value._2)
  def decodeSipPlanStatePBField19Entry(value: SipPlanStatePBField19Entry): (OccurrenceId, String) = (decodeOccurrenceIdPB(req(value.f0)), value.f1)
  def encodeSipPlanStatePBField20(value: Map[String, String]): SipPlanStatePBField20 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField20Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField20(rows) }
  def decodeSipPlanStatePBField20(value: SipPlanStatePBField20): Map[String, String] = { val rows = value.f0.map(item => decodeSipPlanStatePBField20Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField20Entry(value: (String, String)): SipPlanStatePBField20Entry = SipPlanStatePBField20Entry(value._1, value._2)
  def decodeSipPlanStatePBField20Entry(value: SipPlanStatePBField20Entry): (String, String) = (value.f0, value.f1)
  def encodeSipPlanStatePBField23(value: Option[BankSipCreateIntent]): SipPlanStatePBField23 = value match { case None => SipPlanStatePBField23(present = false); case Some(item) => SipPlanStatePBField23(present = true, f0 = Some(encodeBankSipCreateIntentPB(item))) }
  def decodeSipPlanStatePBField23(value: SipPlanStatePBField23): Option[BankSipCreateIntent] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankSipCreateIntentPB(req(value.f0)))
  def encodeSipPlanStatePBField24(value: Map[String, BankSipCreateIntent]): SipPlanStatePBField24 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField24Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField24(rows) }
  def decodeSipPlanStatePBField24(value: SipPlanStatePBField24): Map[String, BankSipCreateIntent] = { val rows = value.f0.map(item => decodeSipPlanStatePBField24Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField24Entry(value: (String, BankSipCreateIntent)): SipPlanStatePBField24Entry = SipPlanStatePBField24Entry(value._1, Some(encodeBankSipCreateIntentPB(value._2)))
  def decodeSipPlanStatePBField24Entry(value: SipPlanStatePBField24Entry): (String, BankSipCreateIntent) = (value.f0, decodeBankSipCreateIntentPB(req(value.f1)))
  def encodeSipPlanStatePBField25(value: Vector[Long]): SipPlanStatePBField25 = SipPlanStatePBField25(value.map(item => item))
  def decodeSipPlanStatePBField25(value: SipPlanStatePBField25): Vector[Long] = value.f0.map(item => item).toVector
  def encodeSipPlanStatePBField26(value: Map[Long, Long]): SipPlanStatePBField26 = { val rows = value.toVector.map(item => encodeSipPlanStatePBField26Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); SipPlanStatePBField26(rows) }
  def decodeSipPlanStatePBField26(value: SipPlanStatePBField26): Map[Long, Long] = { val rows = value.f0.map(item => decodeSipPlanStatePBField26Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeSipPlanStatePBField26Entry(value: (Long, Long)): SipPlanStatePBField26Entry = SipPlanStatePBField26Entry(value._1, value._2)
  def decodeSipPlanStatePBField26Entry(value: SipPlanStatePBField26Entry): (Long, Long) = (value.f0, value.f1)
  def encodeSipPlanStatePB(value: SipPlanState): SipPlanStatePB = SipPlanStatePB(
    Some(encodePlanIdPB(value.id)),
    value.initialized,
    value.scheduleSealed,
    value.scheduleCount,
    value.lastDueSlot,
    Some(encodeSipPlanStatePBField5(value.slots)),
    value.currentTick,
    value.observedCount,
    value.startCount,
    value.paused,
    value.pauseTick,
    Some(encodeSipPlanStatePBField11(value.pauseIntervals)),
    Some(encodeSipPlanStatePBField12(value.revisions)),
    Some(encodeSipPlanStatePBField13(value.revisionEnds)),
    Some(encodeRevisionIdPB(value.latestRevision)),
    value.latestEffectiveSlot,
    Some(encodeSipPlanStatePBField16(value.slotDisposition)),
    Some(encodeSipPlanStatePBField17(value.occurrences)),
    Some(encodeSipPlanStatePBField18(value.occurrenceProgress)),
    Some(encodeSipPlanStatePBField19(value.firstTerminals)),
    Some(encodeSipPlanStatePBField20(value.terminalReceiptBodies)),
    value.successTotal,
    value.failureTotal,
    Some(encodeSipPlanStatePBField23(value.createIntent)),
    Some(encodeSipPlanStatePBField24(value.sipCreateIntents)),
    Some(encodeSipPlanStatePBField25(value.createIntentDueSlots)),
    Some(encodeSipPlanStatePBField26(value.intentAppendedDueSlots))
  )
  def decodeSipPlanStatePB(value: SipPlanStatePB): SipPlanState = SipPlanState(
    decodePlanIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    value.f4,
    decodeSipPlanStatePBField5(req(value.f5)),
    value.f6,
    value.f7,
    value.f8,
    value.f9,
    value.f10,
    decodeSipPlanStatePBField11(req(value.f11)),
    decodeSipPlanStatePBField12(req(value.f12)),
    decodeSipPlanStatePBField13(req(value.f13)),
    decodeRevisionIdPB(req(value.f14)),
    value.f15,
    decodeSipPlanStatePBField16(req(value.f16)),
    decodeSipPlanStatePBField17(req(value.f17)),
    decodeSipPlanStatePBField18(req(value.f18)),
    decodeSipPlanStatePBField19(req(value.f19)),
    decodeSipPlanStatePBField20(req(value.f20)),
    value.f21,
    value.f22,
    decodeSipPlanStatePBField23(req(value.f23)),
    decodeSipPlanStatePBField24(req(value.f24)),
    decodeSipPlanStatePBField25(req(value.f25)),
    decodeSipPlanStatePBField26(req(value.f26))
  )
  def encodeSipPlanSipPlanCreatedPB(value: SipPlanProtocol.SipPlanCreated): SipPlanSipPlanCreatedPB = SipPlanSipPlanCreatedPB(Some(encodePlanIdPB(value.planId)), Some(encodeSipRevisionConfigPB(value.config)))
  def decodeSipPlanSipPlanCreatedPB(value: SipPlanSipPlanCreatedPB): SipPlanProtocol.SipPlanCreated = SipPlanProtocol.SipPlanCreated(decodePlanIdPB(req(value.f0)), decodeSipRevisionConfigPB(req(value.f1)))
  def encodeSipPlanSipDueSlotAppendedPB(value: SipPlanProtocol.SipDueSlotAppended): SipPlanSipDueSlotAppendedPB = SipPlanSipDueSlotAppendedPB(value.position, value.dueSlot)
  def decodeSipPlanSipDueSlotAppendedPB(value: SipPlanSipDueSlotAppendedPB): SipPlanProtocol.SipDueSlotAppended = SipPlanProtocol.SipDueSlotAppended(value.f0, value.f1)
  def encodeSipPlanSipScheduleSealedPB(value: SipPlanProtocol.SipScheduleSealed): SipPlanSipScheduleSealedPB = SipPlanSipScheduleSealedPB(value.`sealed`)
  def decodeSipPlanSipScheduleSealedPB(value: SipPlanSipScheduleSealedPB): SipPlanProtocol.SipScheduleSealed = SipPlanProtocol.SipScheduleSealed(value.f0)
  def encodeSipPlanSipPlanRevisedPB(value: SipPlanProtocol.SipPlanRevised): SipPlanSipPlanRevisedPB = SipPlanSipPlanRevisedPB(Some(encodeSipRevisionConfigPB(value.config)), Some(encodeRevisionIdPB(value.previousRevision)))
  def decodeSipPlanSipPlanRevisedPB(value: SipPlanSipPlanRevisedPB): SipPlanProtocol.SipPlanRevised = SipPlanProtocol.SipPlanRevised(decodeSipRevisionConfigPB(req(value.f0)), decodeRevisionIdPB(req(value.f1)))
  def encodeSipPlanSipClockAdvancedPB(value: SipPlanProtocol.SipClockAdvanced): SipPlanSipClockAdvancedPB = SipPlanSipClockAdvancedPB(value.tick)
  def decodeSipPlanSipClockAdvancedPB(value: SipPlanSipClockAdvancedPB): SipPlanProtocol.SipClockAdvanced = SipPlanProtocol.SipClockAdvanced(value.f0)
  def encodeSipPlanSipPlanPausedPB(value: SipPlanProtocol.SipPlanPaused): SipPlanSipPlanPausedPB = SipPlanSipPlanPausedPB(value.tick)
  def decodeSipPlanSipPlanPausedPB(value: SipPlanSipPlanPausedPB): SipPlanProtocol.SipPlanPaused = SipPlanProtocol.SipPlanPaused(value.f0)
  def encodeSipPlanSipPlanResumedPB(value: SipPlanProtocol.SipPlanResumed): SipPlanSipPlanResumedPB = SipPlanSipPlanResumedPB(value.tick, value.pauseTick)
  def decodeSipPlanSipPlanResumedPB(value: SipPlanSipPlanResumedPB): SipPlanProtocol.SipPlanResumed = SipPlanProtocol.SipPlanResumed(value.f0, value.f1)
  def encodeSipPlanSipDueSlotObservedPB(value: SipPlanProtocol.SipDueSlotObserved): SipPlanSipDueSlotObservedPB = SipPlanSipDueSlotObservedPB(value.position, value.dueSlot, value.disposition)
  def decodeSipPlanSipDueSlotObservedPB(value: SipPlanSipDueSlotObservedPB): SipPlanProtocol.SipDueSlotObserved = SipPlanProtocol.SipDueSlotObserved(value.f0, value.f1, value.f2)
  def encodeSipPlanSipPausedDueSlotSkippedPB(value: SipPlanProtocol.SipPausedDueSlotSkipped): SipPlanSipPausedDueSlotSkippedPB = SipPlanSipPausedDueSlotSkippedPB(value.position, value.dueSlot, value.disposition)
  def decodeSipPlanSipPausedDueSlotSkippedPB(value: SipPlanSipPausedDueSlotSkippedPB): SipPlanProtocol.SipPausedDueSlotSkipped = SipPlanProtocol.SipPausedDueSlotSkipped(value.f0, value.f1, value.f2)
  def encodeSipPlanSipSkippedSlotAdvancedPB(value: SipPlanProtocol.SipSkippedSlotAdvanced): SipPlanSipSkippedSlotAdvancedPB = SipPlanSipSkippedSlotAdvancedPB(value.position, value.dueSlot)
  def decodeSipPlanSipSkippedSlotAdvancedPB(value: SipPlanSipSkippedSlotAdvancedPB): SipPlanProtocol.SipSkippedSlotAdvanced = SipPlanProtocol.SipSkippedSlotAdvanced(value.f0, value.f1)
  def encodeSipPlanSipInstallmentTriggeredPB(value: SipPlanProtocol.SipInstallmentTriggered): SipPlanSipInstallmentTriggeredPB = SipPlanSipInstallmentTriggeredPB(value.position, Some(encodeSipOccurrencePB(value.occurrence)))
  def decodeSipPlanSipInstallmentTriggeredPB(value: SipPlanSipInstallmentTriggeredPB): SipPlanProtocol.SipInstallmentTriggered = SipPlanProtocol.SipInstallmentTriggered(value.f0, decodeSipOccurrencePB(req(value.f1)))
  def encodeSipPlanSipInstallmentPendingPB(value: SipPlanProtocol.SipInstallmentPending): SipPlanSipInstallmentPendingPB = SipPlanSipInstallmentPendingPB(Some(encodeSipOccurrencePB(value.occurrence)), value.outcome)
  def decodeSipPlanSipInstallmentPendingPB(value: SipPlanSipInstallmentPendingPB): SipPlanProtocol.SipInstallmentPending = SipPlanProtocol.SipInstallmentPending(decodeSipOccurrencePB(req(value.f0)), value.f1)
  def encodeSipPlanSipInstallmentOutcomeUnknownPB(value: SipPlanProtocol.SipInstallmentOutcomeUnknown): SipPlanSipInstallmentOutcomeUnknownPB = SipPlanSipInstallmentOutcomeUnknownPB(Some(encodeSipOccurrencePB(value.occurrence)), value.outcome)
  def decodeSipPlanSipInstallmentOutcomeUnknownPB(value: SipPlanSipInstallmentOutcomeUnknownPB): SipPlanProtocol.SipInstallmentOutcomeUnknown = SipPlanProtocol.SipInstallmentOutcomeUnknown(decodeSipOccurrencePB(req(value.f0)), value.f1)
  def encodeSipPlanSipInstallmentRecoveryRequiredPB(value: SipPlanProtocol.SipInstallmentRecoveryRequired): SipPlanSipInstallmentRecoveryRequiredPB = SipPlanSipInstallmentRecoveryRequiredPB(Some(encodeSipOccurrencePB(value.occurrence)), value.outcome)
  def decodeSipPlanSipInstallmentRecoveryRequiredPB(value: SipPlanSipInstallmentRecoveryRequiredPB): SipPlanProtocol.SipInstallmentRecoveryRequired = SipPlanProtocol.SipInstallmentRecoveryRequired(decodeSipOccurrencePB(req(value.f0)), value.f1)
  def encodeSipPlanSipInstallmentRefundInProgressPB(value: SipPlanProtocol.SipInstallmentRefundInProgress): SipPlanSipInstallmentRefundInProgressPB = SipPlanSipInstallmentRefundInProgressPB(Some(encodeSipOccurrencePB(value.occurrence)), value.outcome)
  def decodeSipPlanSipInstallmentRefundInProgressPB(value: SipPlanSipInstallmentRefundInProgressPB): SipPlanProtocol.SipInstallmentRefundInProgress = SipPlanProtocol.SipInstallmentRefundInProgress(decodeSipOccurrencePB(req(value.f0)), value.f1)
  def encodeSipPlanSipInstallmentSucceededPB(value: SipPlanProtocol.SipInstallmentSucceeded): SipPlanSipInstallmentSucceededPB = SipPlanSipInstallmentSucceededPB(
    Some(encodeSipOccurrencePB(value.occurrence)),
    value.evidence,
    value.receiptId,
    value.receiptBody,
    value.outcome
  )
  def decodeSipPlanSipInstallmentSucceededPB(value: SipPlanSipInstallmentSucceededPB): SipPlanProtocol.SipInstallmentSucceeded = SipPlanProtocol.SipInstallmentSucceeded(
    decodeSipOccurrencePB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    value.f4
  )
}
