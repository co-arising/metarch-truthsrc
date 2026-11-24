package example.bankwealth.infrastructure.serialization

import example.bankwealth.domain._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.proto._
trait DomainConvertersPart1 { self: DomainConverters.type =>
  def encodeBankSipDispatchReconcilePB(value: BankSipDispatchReconcile): BankSipDispatchReconcilePB = BankSipDispatchReconcilePB(
    value.operation,
    Some(encodeBankSipDispatchRequestPB(value.request)),
    value.decision,
    Some(encodeBankSipDispatchReconcilePBField3(value.evidence)),
    value.authorization
  )
  def decodeBankSipDispatchReconcilePB(value: BankSipDispatchReconcilePB): BankSipDispatchReconcile = BankSipDispatchReconcile(
    value.f0,
    decodeBankSipDispatchRequestPB(req(value.f1)),
    value.f2,
    decodeBankSipDispatchReconcilePBField3(req(value.f3)),
    value.f4
  )
  def encodeBankSipDispatchReconcilePBField3(value: Option[BankSipDispatchObservation]): BankSipDispatchReconcilePBField3 = value match { case None => BankSipDispatchReconcilePBField3(present = false); case Some(item) => BankSipDispatchReconcilePBField3(present = true, f0 = Some(encodeBankSipDispatchObservationPB(item))) }
  def decodeBankSipDispatchReconcilePBField3(value: BankSipDispatchReconcilePBField3): Option[BankSipDispatchObservation] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankSipDispatchObservationPB(req(value.f0)))
  def encodeBankCashSubmitPB(value: BankCashSubmit): BankCashSubmitPB = BankCashSubmitPB(value.clientRequestId, value.fundCode, Some(encodeMoneyWirePB(value.amount)))
  def decodeBankCashSubmitPB(value: BankCashSubmitPB): BankCashSubmit = BankCashSubmit(value.f0, value.f1, decodeMoneyWirePB(req(value.f2)))
  def encodeBankCashOriginalPB(value: BankCashOriginal): BankCashOriginalPB = BankCashOriginalPB(
    value.principalId,
    value.clientRequestId,
    value.authorityVersion,
    Some(encodeBankCashSubmitPB(value.request)),
    Some(encodeBankPaymentOriginalPB(value.payment))
  )
  def decodeBankCashOriginalPB(value: BankCashOriginalPB): BankCashOriginal = BankCashOriginal(
    value.f0,
    value.f1,
    value.f2,
    decodeBankCashSubmitPB(req(value.f3)),
    decodeBankPaymentOriginalPB(req(value.f4))
  )
  def encodeBankCashAcknowledgementPB(value: BankCashAcknowledgement): BankCashAcknowledgementPB = BankCashAcknowledgementPB(Some(encodeBankCashOriginalPB(value.original)), value.status)
  def decodeBankCashAcknowledgementPB(value: BankCashAcknowledgementPB): BankCashAcknowledgement = BankCashAcknowledgement(decodeBankCashOriginalPB(req(value.f0)), value.f1)
  def encodeBankSipCreatePB(value: BankSipCreate): BankSipCreatePB = BankSipCreatePB(
    value.clientRequestId,
    value.fundCode,
    Some(encodeMoneyWirePB(value.amount)),
    value.effectiveSlot,
    Some(encodeBankSipCreatePBField4(value.dueSlots))
  )
  def decodeBankSipCreatePB(value: BankSipCreatePB): BankSipCreate = BankSipCreate(
    value.f0,
    value.f1,
    decodeMoneyWirePB(req(value.f2)),
    value.f3,
    decodeBankSipCreatePBField4(req(value.f4))
  )
  def encodeBankSipCreatePBField4(value: Vector[Long]): BankSipCreatePBField4 = BankSipCreatePBField4(value.map(item => item))
  def decodeBankSipCreatePBField4(value: BankSipCreatePBField4): Vector[Long] = value.f0.map(item => item).toVector
  def encodeBankSipCreateIntentPB(value: BankSipCreateIntent): BankSipCreateIntentPB = BankSipCreateIntentPB(
    value.principalId,
    value.clientRequestId,
    value.authorityVersion,
    Some(encodeBankSipCreatePB(value.request)),
    Some(encodePlanIdPB(value.planId)),
    Some(encodeSipRevisionConfigPB(value.config))
  )
  def decodeBankSipCreateIntentPB(value: BankSipCreateIntentPB): BankSipCreateIntent = BankSipCreateIntent(
    value.f0,
    value.f1,
    value.f2,
    decodeBankSipCreatePB(req(value.f3)),
    decodePlanIdPB(req(value.f4)),
    decodeSipRevisionConfigPB(req(value.f5))
  )
  def encodeBankSipAcknowledgementPB(value: BankSipAcknowledgement): BankSipAcknowledgementPB = BankSipAcknowledgementPB(Some(encodePlanIdPB(value.planId)), value.status)
  def decodeBankSipAcknowledgementPB(value: BankSipAcknowledgementPB): BankSipAcknowledgement = BankSipAcknowledgement(decodePlanIdPB(req(value.f0)), value.f1)
  def encodeBankSipRevisePB(value: BankSipRevise): BankSipRevisePB = BankSipRevisePB(
    Some(encodeRevisionIdPB(value.revision)),
    value.effectiveSlot,
    value.fundCode,
    Some(encodeMoneyWirePB(value.amount))
  )
  def decodeBankSipRevisePB(value: BankSipRevisePB): BankSipRevise = BankSipRevise(
    decodeRevisionIdPB(req(value.f0)),
    value.f1,
    value.f2,
    decodeMoneyWirePB(req(value.f3))
  )
  def encodeBankSipRevisionInputPB(value: BankSipRevisionInput): BankSipRevisionInputPB = BankSipRevisionInputPB(Some(encodePlanIdPB(value.planId)), Some(encodeBankSipRevisePB(value.request)))
  def decodeBankSipRevisionInputPB(value: BankSipRevisionInputPB): BankSipRevisionInput = BankSipRevisionInput(decodePlanIdPB(req(value.f0)), decodeBankSipRevisePB(req(value.f1)))
  def encodeBankTickPB(value: BankTick): BankTickPB = BankTickPB(value.slot)
  def decodeBankTickPB(value: BankTickPB): BankTick = BankTick(value.f0)
  def encodeBankTickAcknowledgementPB(value: BankTickAcknowledgement): BankTickAcknowledgementPB = BankTickAcknowledgementPB(value.slot, value.plans)
  def decodeBankTickAcknowledgementPB(value: BankTickAcknowledgementPB): BankTickAcknowledgement = BankTickAcknowledgement(value.f0, value.f1)
  def encodeBankAccountKeyPB(value: BankAccountKey): BankAccountKeyPB = BankAccountKeyPB(value.schemaVersion)
  def decodeBankAccountKeyPB(value: BankAccountKeyPB): BankAccountKey = BankAccountKey(value.f0)
  def encodeBankCashRequestKeyPB(value: BankCashRequestKey): BankCashRequestKeyPB = BankCashRequestKeyPB(value.clientRequestId)
  def decodeBankCashRequestKeyPB(value: BankCashRequestKeyPB): BankCashRequestKey = BankCashRequestKey(value.f0)
  def encodeBankOrderKeyPB(value: BankOrderKey): BankOrderKeyPB = BankOrderKeyPB(Some(encodeFundOrderIdPB(value.orderId)))
  def decodeBankOrderKeyPB(value: BankOrderKeyPB): BankOrderKey = BankOrderKey(decodeFundOrderIdPB(req(value.f0)))
  def encodeBankPlanKeyPB(value: BankPlanKey): BankPlanKeyPB = BankPlanKeyPB(Some(encodePlanIdPB(value.planId)))
  def decodeBankPlanKeyPB(value: BankPlanKeyPB): BankPlanKey = BankPlanKey(decodePlanIdPB(req(value.f0)))
  def encodeBankPlanPageKeyPB(value: BankPlanPageKey): BankPlanPageKeyPB = BankPlanPageKeyPB(value.limit, value.after)
  def decodeBankPlanPageKeyPB(value: BankPlanPageKeyPB): BankPlanPageKey = BankPlanPageKey(value.f0, value.f1)
  def encodeBankOccurrencePageKeyPB(value: BankOccurrencePageKey): BankOccurrencePageKeyPB = BankOccurrencePageKeyPB(Some(encodePlanIdPB(value.planId)), value.limit, value.after)
  def decodeBankOccurrencePageKeyPB(value: BankOccurrencePageKeyPB): BankOccurrencePageKey = BankOccurrencePageKey(decodePlanIdPB(req(value.f0)), value.f1, value.f2)
  def encodeBankPendingPageKeyPB(value: BankPendingPageKey): BankPendingPageKeyPB = BankPendingPageKeyPB(value.limit, value.after)
  def decodeBankPendingPageKeyPB(value: BankPendingPageKeyPB): BankPendingPageKey = BankPendingPageKey(value.f0, value.f1)
  def encodeBankOperationKeyPB(value: BankOperationKey): BankOperationKeyPB = BankOperationKeyPB(Some(encodeOperationIdPB(value.operationId)))
  def decodeBankOperationKeyPB(value: BankOperationKeyPB): BankOperationKey = BankOperationKey(decodeOperationIdPB(req(value.f0)))
  def encodeBankProjectionWatermarkPB(value: BankProjectionWatermark): BankProjectionWatermarkPB = BankProjectionWatermarkPB(
    value.persistenceId,
    value.lastSequence,
    Some(encodeBankProjectionWatermarkPBField2(value.observedSequence)),
    value.disposition
  )
  def decodeBankProjectionWatermarkPB(value: BankProjectionWatermarkPB): BankProjectionWatermark = BankProjectionWatermark(
    value.f0,
    value.f1,
    decodeBankProjectionWatermarkPBField2(req(value.f2)),
    value.f3
  )
  def encodeBankProjectionWatermarkPBField2(value: Option[Long]): BankProjectionWatermarkPBField2 = value match { case None => BankProjectionWatermarkPBField2(present = false); case Some(item) => BankProjectionWatermarkPBField2(present = true, f0 = item) }
  def decodeBankProjectionWatermarkPBField2(value: BankProjectionWatermarkPBField2): Option[Long] = if (!value.present) { require(value.f0 == 0L, "absent optional contains a value"); None } else Some(value.f0)
  def encodeBankReadMetadataPB(value: BankReadMetadata): BankReadMetadataPB = BankReadMetadataPB(value.schemaVersion, value.disposition, Some(encodeBankReadMetadataPBField2(value.watermarks)))
  def decodeBankReadMetadataPB(value: BankReadMetadataPB): BankReadMetadata = BankReadMetadata(value.f0, value.f1, decodeBankReadMetadataPBField2(req(value.f2)))
  def encodeBankReadMetadataPBField2(value: Vector[BankProjectionWatermark]): BankReadMetadataPBField2 = BankReadMetadataPBField2(value.map(item => encodeBankProjectionWatermarkPB(item)))
  def decodeBankReadMetadataPBField2(value: BankReadMetadataPBField2): Vector[BankProjectionWatermark] = value.f0.map(item => decodeBankProjectionWatermarkPB(item)).toVector
  def encodeBankAccountViewPB(value: BankAccountView): BankAccountViewPB = BankAccountViewPB(
    Some(encodeAccountIdPB(value.accountId)),
    value.initialized,
    Some(encodeMoneyWirePB(value.available)),
    Some(encodeMoneyWirePB(value.reserved))
  )
  def decodeBankAccountViewPB(value: BankAccountViewPB): BankAccountView = BankAccountView(
    decodeAccountIdPB(req(value.f0)),
    value.f1,
    decodeMoneyWirePB(req(value.f2)),
    decodeMoneyWirePB(req(value.f3))
  )
  def encodeBankCashRequestViewPB(value: BankCashRequestView): BankCashRequestViewPB = BankCashRequestViewPB(
    Some(encodeBankCashOriginalPB(value.original)),
    value.paymentStatus,
    value.taStatus,
    value.refundStatus
  )
  def decodeBankCashRequestViewPB(value: BankCashRequestViewPB): BankCashRequestView = BankCashRequestView(
    decodeBankCashOriginalPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3
  )
  def encodeBankTaSharesViewPB(value: BankTaSharesView): BankTaSharesViewPB = BankTaSharesViewPB(value.fundCode, Some(encodeTaExactTextPB(value.shares)), Some(encodeTaExactTextPB(value.nav)))
  def decodeBankTaSharesViewPB(value: BankTaSharesViewPB): BankTaSharesView = BankTaSharesView(value.f0, decodeTaExactTextPB(req(value.f1)), decodeTaExactTextPB(req(value.f2)))
  def encodeBankOrderViewPB(value: BankOrderView): BankOrderViewPB = BankOrderViewPB(
    Some(encodeFundOrderIdPB(value.orderId)),
    Some(encodeOperationIdPB(value.operationId)),
    Some(encodeAccountIdPB(value.investorAccountId)),
    Some(encodeAccountIdPB(value.fundCollectionAccountId)),
    value.fundCode,
    Some(encodeMoneyWirePB(value.amount)),
    Some(encodeBankOrderViewPBField6(value.paymentTxId)),
    value.paymentStatus,
    Some(encodeBankOrderViewPBField8(value.taRequestId)),
    value.taStatus,
    Some(encodeBankOrderViewPBField10(value.taReference)),
    Some(encodeBankOrderViewPBField11(value.taShares)),
    Some(encodeBankOrderViewPBField12(value.taRejectionReason)),
    Some(encodeBankOrderViewPBField13(value.refundOperationId)),
    value.refundStatus
  )
  def decodeBankOrderViewPB(value: BankOrderViewPB): BankOrderView = BankOrderView(
    decodeFundOrderIdPB(req(value.f0)),
    decodeOperationIdPB(req(value.f1)),
    decodeAccountIdPB(req(value.f2)),
    decodeAccountIdPB(req(value.f3)),
    value.f4,
    decodeMoneyWirePB(req(value.f5)),
    decodeBankOrderViewPBField6(req(value.f6)),
    value.f7,
    decodeBankOrderViewPBField8(req(value.f8)),
    value.f9,
    decodeBankOrderViewPBField10(req(value.f10)),
    decodeBankOrderViewPBField11(req(value.f11)),
    decodeBankOrderViewPBField12(req(value.f12)),
    decodeBankOrderViewPBField13(req(value.f13)),
    value.f14
  )
  def encodeBankOrderViewPBField6(value: Option[TxId]): BankOrderViewPBField6 = value match { case None => BankOrderViewPBField6(present = false); case Some(item) => BankOrderViewPBField6(present = true, f0 = Some(encodeTxIdPB(item))) }
  def decodeBankOrderViewPBField6(value: BankOrderViewPBField6): Option[TxId] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeTxIdPB(req(value.f0)))
  def encodeBankOrderViewPBField8(value: Option[TaRequestId]): BankOrderViewPBField8 = value match { case None => BankOrderViewPBField8(present = false); case Some(item) => BankOrderViewPBField8(present = true, f0 = Some(encodeTaRequestIdPB(item))) }
  def decodeBankOrderViewPBField8(value: BankOrderViewPBField8): Option[TaRequestId] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeTaRequestIdPB(req(value.f0)))
  def encodeBankOrderViewPBField10(value: Option[String]): BankOrderViewPBField10 = value match { case None => BankOrderViewPBField10(present = false); case Some(item) => BankOrderViewPBField10(present = true, f0 = item) }
  def decodeBankOrderViewPBField10(value: BankOrderViewPBField10): Option[String] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(value.f0)
  def encodeBankOrderViewPBField11(value: Option[BankTaSharesView]): BankOrderViewPBField11 = value match { case None => BankOrderViewPBField11(present = false); case Some(item) => BankOrderViewPBField11(present = true, f0 = Some(encodeBankTaSharesViewPB(item))) }
  def decodeBankOrderViewPBField11(value: BankOrderViewPBField11): Option[BankTaSharesView] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankTaSharesViewPB(req(value.f0)))
  def encodeBankOrderViewPBField12(value: Option[String]): BankOrderViewPBField12 = value match { case None => BankOrderViewPBField12(present = false); case Some(item) => BankOrderViewPBField12(present = true, f0 = item) }
  def decodeBankOrderViewPBField12(value: BankOrderViewPBField12): Option[String] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(value.f0)
  def encodeBankOrderViewPBField13(value: Option[OperationId]): BankOrderViewPBField13 = value match { case None => BankOrderViewPBField13(present = false); case Some(item) => BankOrderViewPBField13(present = true, f0 = Some(encodeOperationIdPB(item))) }
  def decodeBankOrderViewPBField13(value: BankOrderViewPBField13): Option[OperationId] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeOperationIdPB(req(value.f0)))
  def encodeBankSipRevisionViewPB(value: BankSipRevisionView): BankSipRevisionViewPB = BankSipRevisionViewPB(Some(encodeSipRevisionConfigPB(value.config)), Some(encodeBankSipRevisionViewPBField1(value.endSlot)))
  def decodeBankSipRevisionViewPB(value: BankSipRevisionViewPB): BankSipRevisionView = BankSipRevisionView(decodeSipRevisionConfigPB(req(value.f0)), decodeBankSipRevisionViewPBField1(req(value.f1)))
  def encodeBankSipRevisionViewPBField1(value: Option[Long]): BankSipRevisionViewPBField1 = value match { case None => BankSipRevisionViewPBField1(present = false); case Some(item) => BankSipRevisionViewPBField1(present = true, f0 = item) }
  def decodeBankSipRevisionViewPBField1(value: BankSipRevisionViewPBField1): Option[Long] = if (!value.present) { require(value.f0 == 0L, "absent optional contains a value"); None } else Some(value.f0)
  def encodeBankSipPlanViewPB(value: BankSipPlanView): BankSipPlanViewPB = BankSipPlanViewPB(
    Some(encodePlanIdPB(value.planId)),
    Some(encodeBankSipPlanViewPBField1(value.original)),
    value.initialized,
    value.scheduleSealed,
    value.paused,
    value.currentTick,
    Some(encodeBankSipPlanViewPBField6(value.dueSlots)),
    Some(encodeBankSipPlanViewPBField7(value.revisions)),
    value.scheduleCount,
    value.observedCount,
    value.startCount,
    value.successTotal,
    value.failureTotal
  )
  def decodeBankSipPlanViewPB(value: BankSipPlanViewPB): BankSipPlanView = BankSipPlanView(
    decodePlanIdPB(req(value.f0)),
    decodeBankSipPlanViewPBField1(req(value.f1)),
    value.f2,
    value.f3,
    value.f4,
    value.f5,
    decodeBankSipPlanViewPBField6(req(value.f6)),
    decodeBankSipPlanViewPBField7(req(value.f7)),
    value.f8,
    value.f9,
    value.f10,
    value.f11,
    value.f12
  )
  def encodeBankSipPlanViewPBField1(value: Option[BankSipCreateIntent]): BankSipPlanViewPBField1 = value match { case None => BankSipPlanViewPBField1(present = false); case Some(item) => BankSipPlanViewPBField1(present = true, f0 = Some(encodeBankSipCreateIntentPB(item))) }
  def decodeBankSipPlanViewPBField1(value: BankSipPlanViewPBField1): Option[BankSipCreateIntent] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankSipCreateIntentPB(req(value.f0)))
  def encodeBankSipPlanViewPBField6(value: Vector[Long]): BankSipPlanViewPBField6 = BankSipPlanViewPBField6(value.map(item => item))
  def decodeBankSipPlanViewPBField6(value: BankSipPlanViewPBField6): Vector[Long] = value.f0.map(item => item).toVector
  def encodeBankSipPlanViewPBField7(value: Vector[BankSipRevisionView]): BankSipPlanViewPBField7 = BankSipPlanViewPBField7(value.map(item => encodeBankSipRevisionViewPB(item)))
  def decodeBankSipPlanViewPBField7(value: BankSipPlanViewPBField7): Vector[BankSipRevisionView] = value.f0.map(item => decodeBankSipRevisionViewPB(item)).toVector
  def encodeBankSipOccurrenceViewPB(value: BankSipOccurrenceView): BankSipOccurrenceViewPB = BankSipOccurrenceViewPB(
    Some(encodeSipOccurrencePB(value.occurrence)),
    value.slotDisposition,
    value.progress,
    value.paymentStatus,
    value.taStatus,
    value.refundStatus,
    Some(encodeBankSipOccurrenceViewPBField6(value.firstTerminal))
  )
  def decodeBankSipOccurrenceViewPB(value: BankSipOccurrenceViewPB): BankSipOccurrenceView = BankSipOccurrenceView(
    decodeSipOccurrencePB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    value.f4,
    value.f5,
    decodeBankSipOccurrenceViewPBField6(req(value.f6))
  )
  def encodeBankSipOccurrenceViewPBField6(value: Option[String]): BankSipOccurrenceViewPBField6 = value match { case None => BankSipOccurrenceViewPBField6(present = false); case Some(item) => BankSipOccurrenceViewPBField6(present = true, f0 = item) }
  def decodeBankSipOccurrenceViewPBField6(value: BankSipOccurrenceViewPBField6): Option[String] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(value.f0)
  def encodeBankPendingOperationViewPB(value: BankPendingOperationView): BankPendingOperationViewPB = BankPendingOperationViewPB(
    Some(encodeOperationIdPB(value.operationId)),
    value.flow,
    Some(encodeBankPendingOperationViewPBField2(value.orderId)),
    Some(encodeBankPendingOperationViewPBField3(value.planId)),
    Some(encodeBankPendingOperationViewPBField4(value.occurrenceId)),
    value.phase,
    value.status,
    value.recoverable
  )
  def decodeBankPendingOperationViewPB(value: BankPendingOperationViewPB): BankPendingOperationView = BankPendingOperationView(
    decodeOperationIdPB(req(value.f0)),
    value.f1,
    decodeBankPendingOperationViewPBField2(req(value.f2)),
    decodeBankPendingOperationViewPBField3(req(value.f3)),
    decodeBankPendingOperationViewPBField4(req(value.f4)),
    value.f5,
    value.f6,
    value.f7
  )
  def encodeBankPendingOperationViewPBField2(value: Option[FundOrderId]): BankPendingOperationViewPBField2 = value match { case None => BankPendingOperationViewPBField2(present = false); case Some(item) => BankPendingOperationViewPBField2(present = true, f0 = Some(encodeFundOrderIdPB(item))) }
  def decodeBankPendingOperationViewPBField2(value: BankPendingOperationViewPBField2): Option[FundOrderId] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeFundOrderIdPB(req(value.f0)))
  def encodeBankPendingOperationViewPBField3(value: Option[PlanId]): BankPendingOperationViewPBField3 = value match { case None => BankPendingOperationViewPBField3(present = false); case Some(item) => BankPendingOperationViewPBField3(present = true, f0 = Some(encodePlanIdPB(item))) }
  def decodeBankPendingOperationViewPBField3(value: BankPendingOperationViewPBField3): Option[PlanId] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodePlanIdPB(req(value.f0)))
  def encodeBankPendingOperationViewPBField4(value: Option[OccurrenceId]): BankPendingOperationViewPBField4 = value match { case None => BankPendingOperationViewPBField4(present = false); case Some(item) => BankPendingOperationViewPBField4(present = true, f0 = Some(encodeOccurrenceIdPB(item))) }
  def decodeBankPendingOperationViewPBField4(value: BankPendingOperationViewPBField4): Option[OccurrenceId] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeOccurrenceIdPB(req(value.f0)))
  def encodeBankAccountResponsePB(value: BankAccountResponse): BankAccountResponsePB = BankAccountResponsePB(Some(encodeBankReadMetadataPB(value.metadata)), Some(encodeBankAccountResponsePBField1(value.account)))
  def decodeBankAccountResponsePB(value: BankAccountResponsePB): BankAccountResponse = BankAccountResponse(decodeBankReadMetadataPB(req(value.f0)), decodeBankAccountResponsePBField1(req(value.f1)))
  def encodeBankAccountResponsePBField1(value: Option[BankAccountView]): BankAccountResponsePBField1 = value match { case None => BankAccountResponsePBField1(present = false); case Some(item) => BankAccountResponsePBField1(present = true, f0 = Some(encodeBankAccountViewPB(item))) }
  def decodeBankAccountResponsePBField1(value: BankAccountResponsePBField1): Option[BankAccountView] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankAccountViewPB(req(value.f0)))
  def encodeBankCashRequestResponsePB(value: BankCashRequestResponse): BankCashRequestResponsePB = BankCashRequestResponsePB(Some(encodeBankReadMetadataPB(value.metadata)), Some(encodeBankCashRequestResponsePBField1(value.request)))
  def decodeBankCashRequestResponsePB(value: BankCashRequestResponsePB): BankCashRequestResponse = BankCashRequestResponse(decodeBankReadMetadataPB(req(value.f0)), decodeBankCashRequestResponsePBField1(req(value.f1)))
  def encodeBankCashRequestResponsePBField1(value: Option[BankCashRequestView]): BankCashRequestResponsePBField1 = value match { case None => BankCashRequestResponsePBField1(present = false); case Some(item) => BankCashRequestResponsePBField1(present = true, f0 = Some(encodeBankCashRequestViewPB(item))) }
  def decodeBankCashRequestResponsePBField1(value: BankCashRequestResponsePBField1): Option[BankCashRequestView] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankCashRequestViewPB(req(value.f0)))
  def encodeBankOrderResponsePB(value: BankOrderResponse): BankOrderResponsePB = BankOrderResponsePB(Some(encodeBankReadMetadataPB(value.metadata)), Some(encodeBankOrderResponsePBField1(value.order)))
  def decodeBankOrderResponsePB(value: BankOrderResponsePB): BankOrderResponse = BankOrderResponse(decodeBankReadMetadataPB(req(value.f0)), decodeBankOrderResponsePBField1(req(value.f1)))
  def encodeBankOrderResponsePBField1(value: Option[BankOrderView]): BankOrderResponsePBField1 = value match { case None => BankOrderResponsePBField1(present = false); case Some(item) => BankOrderResponsePBField1(present = true, f0 = Some(encodeBankOrderViewPB(item))) }
  def decodeBankOrderResponsePBField1(value: BankOrderResponsePBField1): Option[BankOrderView] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankOrderViewPB(req(value.f0)))
  def encodeBankSipPlanResponsePB(value: BankSipPlanResponse): BankSipPlanResponsePB = BankSipPlanResponsePB(Some(encodeBankReadMetadataPB(value.metadata)), Some(encodeBankSipPlanResponsePBField1(value.plan)))
  def decodeBankSipPlanResponsePB(value: BankSipPlanResponsePB): BankSipPlanResponse = BankSipPlanResponse(decodeBankReadMetadataPB(req(value.f0)), decodeBankSipPlanResponsePBField1(req(value.f1)))
  def encodeBankSipPlanResponsePBField1(value: Option[BankSipPlanView]): BankSipPlanResponsePBField1 = value match { case None => BankSipPlanResponsePBField1(present = false); case Some(item) => BankSipPlanResponsePBField1(present = true, f0 = Some(encodeBankSipPlanViewPB(item))) }
  def decodeBankSipPlanResponsePBField1(value: BankSipPlanResponsePBField1): Option[BankSipPlanView] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankSipPlanViewPB(req(value.f0)))
  def encodeBankSipPlanPagePB(value: BankSipPlanPage): BankSipPlanPagePB = BankSipPlanPagePB(Some(encodeBankReadMetadataPB(value.metadata)), Some(encodeBankSipPlanPagePBField1(value.plans)), Some(encodeBankSipPlanPagePBField2(value.nextAfter)))
  def decodeBankSipPlanPagePB(value: BankSipPlanPagePB): BankSipPlanPage = BankSipPlanPage(decodeBankReadMetadataPB(req(value.f0)), decodeBankSipPlanPagePBField1(req(value.f1)), decodeBankSipPlanPagePBField2(req(value.f2)))
  def encodeBankSipPlanPagePBField1(value: Vector[BankSipPlanView]): BankSipPlanPagePBField1 = BankSipPlanPagePBField1(value.map(item => encodeBankSipPlanViewPB(item)))
  def decodeBankSipPlanPagePBField1(value: BankSipPlanPagePBField1): Vector[BankSipPlanView] = value.f0.map(item => decodeBankSipPlanViewPB(item)).toVector
  def encodeBankSipPlanPagePBField2(value: Option[Long]): BankSipPlanPagePBField2 = value match { case None => BankSipPlanPagePBField2(present = false); case Some(item) => BankSipPlanPagePBField2(present = true, f0 = item) }
  def decodeBankSipPlanPagePBField2(value: BankSipPlanPagePBField2): Option[Long] = if (!value.present) { require(value.f0 == 0L, "absent optional contains a value"); None } else Some(value.f0)
  def encodeBankSipOccurrencePagePB(value: BankSipOccurrencePage): BankSipOccurrencePagePB = BankSipOccurrencePagePB(Some(encodeBankReadMetadataPB(value.metadata)), Some(encodeBankSipOccurrencePagePBField1(value.occurrences)), Some(encodeBankSipOccurrencePagePBField2(value.nextAfter)))
  def decodeBankSipOccurrencePagePB(value: BankSipOccurrencePagePB): BankSipOccurrencePage = BankSipOccurrencePage(decodeBankReadMetadataPB(req(value.f0)), decodeBankSipOccurrencePagePBField1(req(value.f1)), decodeBankSipOccurrencePagePBField2(req(value.f2)))
  def encodeBankSipOccurrencePagePBField1(value: Vector[BankSipOccurrenceView]): BankSipOccurrencePagePBField1 = BankSipOccurrencePagePBField1(value.map(item => encodeBankSipOccurrenceViewPB(item)))
  def decodeBankSipOccurrencePagePBField1(value: BankSipOccurrencePagePBField1): Vector[BankSipOccurrenceView] = value.f0.map(item => decodeBankSipOccurrenceViewPB(item)).toVector
  def encodeBankSipOccurrencePagePBField2(value: Option[Long]): BankSipOccurrencePagePBField2 = value match { case None => BankSipOccurrencePagePBField2(present = false); case Some(item) => BankSipOccurrencePagePBField2(present = true, f0 = item) }
  def decodeBankSipOccurrencePagePBField2(value: BankSipOccurrencePagePBField2): Option[Long] = if (!value.present) { require(value.f0 == 0L, "absent optional contains a value"); None } else Some(value.f0)
  def encodeBankPendingResponsePB(value: BankPendingResponse): BankPendingResponsePB = BankPendingResponsePB(Some(encodeBankReadMetadataPB(value.metadata)), Some(encodeBankPendingResponsePBField1(value.operations)), Some(encodeBankPendingResponsePBField2(value.nextAfter)))
  def decodeBankPendingResponsePB(value: BankPendingResponsePB): BankPendingResponse = BankPendingResponse(decodeBankReadMetadataPB(req(value.f0)), decodeBankPendingResponsePBField1(req(value.f1)), decodeBankPendingResponsePBField2(req(value.f2)))
  def encodeBankPendingResponsePBField1(value: Vector[BankPendingOperationView]): BankPendingResponsePBField1 = BankPendingResponsePBField1(value.map(item => encodeBankPendingOperationViewPB(item)))
  def decodeBankPendingResponsePBField1(value: BankPendingResponsePBField1): Vector[BankPendingOperationView] = value.f0.map(item => decodeBankPendingOperationViewPB(item)).toVector
  def encodeBankPendingResponsePBField2(value: Option[Long]): BankPendingResponsePBField2 = value match { case None => BankPendingResponsePBField2(present = false); case Some(item) => BankPendingResponsePBField2(present = true, f0 = item) }
  def decodeBankPendingResponsePBField2(value: BankPendingResponsePBField2): Option[Long] = if (!value.present) { require(value.f0 == 0L, "absent optional contains a value"); None } else Some(value.f0)
  def encodeBankRecoveryAcknowledgementPB(value: BankRecoveryAcknowledgement): BankRecoveryAcknowledgementPB = BankRecoveryAcknowledgementPB(Some(encodeOperationIdPB(value.operationId)), value.status)
  def decodeBankRecoveryAcknowledgementPB(value: BankRecoveryAcknowledgementPB): BankRecoveryAcknowledgement = BankRecoveryAcknowledgement(decodeOperationIdPB(req(value.f0)), value.f1)
  def encodeBankServiceBootstrapInputPB(value: BankServiceBootstrapInput): BankServiceBootstrapInputPB = BankServiceBootstrapInputPB(value.namespace)
  def decodeBankServiceBootstrapInputPB(value: BankServiceBootstrapInputPB): BankServiceBootstrapInput = BankServiceBootstrapInput(value.f0)
  def encodeBankServiceBootstrapAcknowledgementPB(value: BankServiceBootstrapAcknowledgement): BankServiceBootstrapAcknowledgementPB = BankServiceBootstrapAcknowledgementPB(value.namespace, value.status)
  def decodeBankServiceBootstrapAcknowledgementPB(value: BankServiceBootstrapAcknowledgementPB): BankServiceBootstrapAcknowledgement = BankServiceBootstrapAcknowledgement(value.f0, value.f1)
  def encodeCreditBalanceStatePBField2(value: Map[String, Money]): CreditBalanceStatePBField2 = { val rows = value.toVector.map(item => encodeCreditBalanceStatePBField2Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); CreditBalanceStatePBField2(rows) }
  def decodeCreditBalanceStatePBField2(value: CreditBalanceStatePBField2): Map[String, Money] = { val rows = value.f0.map(item => decodeCreditBalanceStatePBField2Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeCreditBalanceStatePBField2Entry(value: (String, Money)): CreditBalanceStatePBField2Entry = CreditBalanceStatePBField2Entry(value._1, Some(encodeMoneyPB(value._2)))
  def decodeCreditBalanceStatePBField2Entry(value: CreditBalanceStatePBField2Entry): (String, Money) = (value.f0, decodeMoneyPB(req(value.f1)))
  def encodeCreditBalanceStatePBField3(value: Map[TxId, Money]): CreditBalanceStatePBField3 = { val rows = value.toVector.map(item => encodeCreditBalanceStatePBField3Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); CreditBalanceStatePBField3(rows) }
  def decodeCreditBalanceStatePBField3(value: CreditBalanceStatePBField3): Map[TxId, Money] = { val rows = value.f0.map(item => decodeCreditBalanceStatePBField3Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeCreditBalanceStatePBField3Entry(value: (TxId, Money)): CreditBalanceStatePBField3Entry = CreditBalanceStatePBField3Entry(Some(encodeTxIdPB(value._1)), Some(encodeMoneyPB(value._2)))
  def decodeCreditBalanceStatePBField3Entry(value: CreditBalanceStatePBField3Entry): (TxId, Money) = (decodeTxIdPB(req(value.f0)), decodeMoneyPB(req(value.f1)))
  def encodeCreditBalanceStatePBField4(value: Map[TxId, Money]): CreditBalanceStatePBField4 = { val rows = value.toVector.map(item => encodeCreditBalanceStatePBField4Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); CreditBalanceStatePBField4(rows) }
  def decodeCreditBalanceStatePBField4(value: CreditBalanceStatePBField4): Map[TxId, Money] = { val rows = value.f0.map(item => decodeCreditBalanceStatePBField4Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeCreditBalanceStatePBField4Entry(value: (TxId, Money)): CreditBalanceStatePBField4Entry = CreditBalanceStatePBField4Entry(Some(encodeTxIdPB(value._1)), Some(encodeMoneyPB(value._2)))
  def decodeCreditBalanceStatePBField4Entry(value: CreditBalanceStatePBField4Entry): (TxId, Money) = (decodeTxIdPB(req(value.f0)), decodeMoneyPB(req(value.f1)))
  def encodeCreditBalanceStatePBField5(value: Map[TxId, Money]): CreditBalanceStatePBField5 = { val rows = value.toVector.map(item => encodeCreditBalanceStatePBField5Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); CreditBalanceStatePBField5(rows) }
  def decodeCreditBalanceStatePBField5(value: CreditBalanceStatePBField5): Map[TxId, Money] = { val rows = value.f0.map(item => decodeCreditBalanceStatePBField5Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeCreditBalanceStatePBField5Entry(value: (TxId, Money)): CreditBalanceStatePBField5Entry = CreditBalanceStatePBField5Entry(Some(encodeTxIdPB(value._1)), Some(encodeMoneyPB(value._2)))
  def decodeCreditBalanceStatePBField5Entry(value: CreditBalanceStatePBField5Entry): (TxId, Money) = (decodeTxIdPB(req(value.f0)), decodeMoneyPB(req(value.f1)))
  def encodeCreditBalanceStatePBField6(value: Map[TxId, Money]): CreditBalanceStatePBField6 = { val rows = value.toVector.map(item => encodeCreditBalanceStatePBField6Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); CreditBalanceStatePBField6(rows) }
  def decodeCreditBalanceStatePBField6(value: CreditBalanceStatePBField6): Map[TxId, Money] = { val rows = value.f0.map(item => decodeCreditBalanceStatePBField6Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeCreditBalanceStatePBField6Entry(value: (TxId, Money)): CreditBalanceStatePBField6Entry = CreditBalanceStatePBField6Entry(Some(encodeTxIdPB(value._1)), Some(encodeMoneyPB(value._2)))
  def decodeCreditBalanceStatePBField6Entry(value: CreditBalanceStatePBField6Entry): (TxId, Money) = (decodeTxIdPB(req(value.f0)), decodeMoneyPB(req(value.f1)))
  def encodeCreditBalanceStatePBField7(value: Map[TxId, Money]): CreditBalanceStatePBField7 = { val rows = value.toVector.map(item => encodeCreditBalanceStatePBField7Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); CreditBalanceStatePBField7(rows) }
  def decodeCreditBalanceStatePBField7(value: CreditBalanceStatePBField7): Map[TxId, Money] = { val rows = value.f0.map(item => decodeCreditBalanceStatePBField7Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeCreditBalanceStatePBField7Entry(value: (TxId, Money)): CreditBalanceStatePBField7Entry = CreditBalanceStatePBField7Entry(Some(encodeTxIdPB(value._1)), Some(encodeMoneyPB(value._2)))
  def decodeCreditBalanceStatePBField7Entry(value: CreditBalanceStatePBField7Entry): (TxId, Money) = (decodeTxIdPB(req(value.f0)), decodeMoneyPB(req(value.f1)))
  def encodeCreditBalanceStatePBField8(value: Map[TxId, Money]): CreditBalanceStatePBField8 = { val rows = value.toVector.map(item => encodeCreditBalanceStatePBField8Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); CreditBalanceStatePBField8(rows) }
  def decodeCreditBalanceStatePBField8(value: CreditBalanceStatePBField8): Map[TxId, Money] = { val rows = value.f0.map(item => decodeCreditBalanceStatePBField8Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeCreditBalanceStatePBField8Entry(value: (TxId, Money)): CreditBalanceStatePBField8Entry = CreditBalanceStatePBField8Entry(Some(encodeTxIdPB(value._1)), Some(encodeMoneyPB(value._2)))
  def decodeCreditBalanceStatePBField8Entry(value: CreditBalanceStatePBField8Entry): (TxId, Money) = (decodeTxIdPB(req(value.f0)), decodeMoneyPB(req(value.f1)))
  def encodeCreditBalanceStatePB(value: CreditBalanceState): CreditBalanceStatePB = CreditBalanceStatePB(
    Some(encodeAccountIdPB(value.id)),
    value.initialized,
    Some(encodeCreditBalanceStatePBField2(value.accountBalance)),
    Some(encodeCreditBalanceStatePBField3(value.reservedAmount)),
    Some(encodeCreditBalanceStatePBField4(value.incomingCredits)),
    Some(encodeCreditBalanceStatePBField5(value.committedOutgoing)),
    Some(encodeCreditBalanceStatePBField6(value.committedIncoming)),
    Some(encodeCreditBalanceStatePBField7(value.compensatedOutgoing)),
    Some(encodeCreditBalanceStatePBField8(value.compensatedIncoming))
  )
  def decodeCreditBalanceStatePB(value: CreditBalanceStatePB): CreditBalanceState = CreditBalanceState(
    decodeAccountIdPB(req(value.f0)),
    value.f1,
    decodeCreditBalanceStatePBField2(req(value.f2)),
    decodeCreditBalanceStatePBField3(req(value.f3)),
    decodeCreditBalanceStatePBField4(req(value.f4)),
    decodeCreditBalanceStatePBField5(req(value.f5)),
    decodeCreditBalanceStatePBField6(req(value.f6)),
    decodeCreditBalanceStatePBField7(req(value.f7)),
    decodeCreditBalanceStatePBField8(req(value.f8))
  )
  def encodeCreditBalanceAccountInitializedPB(value: CreditBalanceProtocol.AccountInitialized): CreditBalanceAccountInitializedPB = CreditBalanceAccountInitializedPB(Some(encodeAccountIdPB(value.resource)), value.currency, Some(encodeMoneyPB(value.amount)))
  def decodeCreditBalanceAccountInitializedPB(value: CreditBalanceAccountInitializedPB): CreditBalanceProtocol.AccountInitialized = CreditBalanceProtocol.AccountInitialized(decodeAccountIdPB(req(value.f0)), value.f1, decodeMoneyPB(req(value.f2)))
  def encodeCreditBalanceReserveFundsConfirmedPB(value: CreditBalanceProtocol.ReserveFundsConfirmed): CreditBalanceReserveFundsConfirmedPB = CreditBalanceReserveFundsConfirmedPB(
    Some(encodeTxIdPB(value.txid)),
    Some(encodeAccountIdPB(value.resource)),
    Some(encodeMoneyPB(value.amount)),
    value.currency,
    Some(encodeMoneyPB(value.available))
  )
  def decodeCreditBalanceReserveFundsConfirmedPB(value: CreditBalanceReserveFundsConfirmedPB): CreditBalanceProtocol.ReserveFundsConfirmed = CreditBalanceProtocol.ReserveFundsConfirmed(
    decodeTxIdPB(req(value.f0)),
    decodeAccountIdPB(req(value.f1)),
    decodeMoneyPB(req(value.f2)),
    value.f3,
    decodeMoneyPB(req(value.f4))
  )
  def encodeCreditBalanceDeductFundsConfirmedPB(value: CreditBalanceProtocol.DeductFundsConfirmed): CreditBalanceDeductFundsConfirmedPB = CreditBalanceDeductFundsConfirmedPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeCreditBalanceDeductFundsConfirmedPB(value: CreditBalanceDeductFundsConfirmedPB): CreditBalanceProtocol.DeductFundsConfirmed = CreditBalanceProtocol.DeductFundsConfirmed(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeCreditBalanceReleaseReservedFundsConfirmedPB(value: CreditBalanceProtocol.ReleaseReservedFundsConfirmed): CreditBalanceReleaseReservedFundsConfirmedPB = CreditBalanceReleaseReservedFundsConfirmedPB(
    Some(encodeTxIdPB(value.txid)),
    Some(encodeAccountIdPB(value.resource)),
    Some(encodeMoneyPB(value.amount)),
    value.currency,
    Some(encodeMoneyPB(value.available))
  )
  def decodeCreditBalanceReleaseReservedFundsConfirmedPB(value: CreditBalanceReleaseReservedFundsConfirmedPB): CreditBalanceProtocol.ReleaseReservedFundsConfirmed = CreditBalanceProtocol.ReleaseReservedFundsConfirmed(
    decodeTxIdPB(req(value.f0)),
    decodeAccountIdPB(req(value.f1)),
    decodeMoneyPB(req(value.f2)),
    value.f3,
    decodeMoneyPB(req(value.f4))
  )
  def encodeCreditBalanceRecordIncomingCreditsConfirmedPB(value: CreditBalanceProtocol.RecordIncomingCreditsConfirmed): CreditBalanceRecordIncomingCreditsConfirmedPB = CreditBalanceRecordIncomingCreditsConfirmedPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeCreditBalanceRecordIncomingCreditsConfirmedPB(value: CreditBalanceRecordIncomingCreditsConfirmedPB): CreditBalanceProtocol.RecordIncomingCreditsConfirmed = CreditBalanceProtocol.RecordIncomingCreditsConfirmed(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeCreditBalanceCommitIncomingCreditsConfirmedPB(value: CreditBalanceProtocol.CommitIncomingCreditsConfirmed): CreditBalanceCommitIncomingCreditsConfirmedPB = CreditBalanceCommitIncomingCreditsConfirmedPB(
    Some(encodeTxIdPB(value.txid)),
    Some(encodeAccountIdPB(value.resource)),
    Some(encodeMoneyPB(value.amount)),
    value.currency,
    Some(encodeMoneyPB(value.available))
  )
  def decodeCreditBalanceCommitIncomingCreditsConfirmedPB(value: CreditBalanceCommitIncomingCreditsConfirmedPB): CreditBalanceProtocol.CommitIncomingCreditsConfirmed = CreditBalanceProtocol.CommitIncomingCreditsConfirmed(
    decodeTxIdPB(req(value.f0)),
    decodeAccountIdPB(req(value.f1)),
    decodeMoneyPB(req(value.f2)),
    value.f3,
    decodeMoneyPB(req(value.f4))
  )
  def encodeCreditBalanceCancelIncomingCreditConfirmedPB(value: CreditBalanceProtocol.CancelIncomingCreditConfirmed): CreditBalanceCancelIncomingCreditConfirmedPB = CreditBalanceCancelIncomingCreditConfirmedPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeCreditBalanceCancelIncomingCreditConfirmedPB(value: CreditBalanceCancelIncomingCreditConfirmedPB): CreditBalanceProtocol.CancelIncomingCreditConfirmed = CreditBalanceProtocol.CancelIncomingCreditConfirmed(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeFundOrderStatePBField7(value: Map[TxId, Money]): FundOrderStatePBField7 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField7Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField7(rows) }
  def decodeFundOrderStatePBField7(value: FundOrderStatePBField7): Map[TxId, Money] = { val rows = value.f0.map(item => decodeFundOrderStatePBField7Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField7Entry(value: (TxId, Money)): FundOrderStatePBField7Entry = FundOrderStatePBField7Entry(Some(encodeTxIdPB(value._1)), Some(encodeMoneyPB(value._2)))
  def decodeFundOrderStatePBField7Entry(value: FundOrderStatePBField7Entry): (TxId, Money) = (decodeTxIdPB(req(value.f0)), decodeMoneyPB(req(value.f1)))
  def encodeFundOrderStatePBField8(value: Map[TxId, Money]): FundOrderStatePBField8 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField8Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField8(rows) }
  def decodeFundOrderStatePBField8(value: FundOrderStatePBField8): Map[TxId, Money] = { val rows = value.f0.map(item => decodeFundOrderStatePBField8Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField8Entry(value: (TxId, Money)): FundOrderStatePBField8Entry = FundOrderStatePBField8Entry(Some(encodeTxIdPB(value._1)), Some(encodeMoneyPB(value._2)))
  def decodeFundOrderStatePBField8Entry(value: FundOrderStatePBField8Entry): (TxId, Money) = (decodeTxIdPB(req(value.f0)), decodeMoneyPB(req(value.f1)))
  def encodeFundOrderStatePBField9(value: Map[TxId, Money]): FundOrderStatePBField9 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField9Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField9(rows) }
  def decodeFundOrderStatePBField9(value: FundOrderStatePBField9): Map[TxId, Money] = { val rows = value.f0.map(item => decodeFundOrderStatePBField9Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField9Entry(value: (TxId, Money)): FundOrderStatePBField9Entry = FundOrderStatePBField9Entry(Some(encodeTxIdPB(value._1)), Some(encodeMoneyPB(value._2)))
  def decodeFundOrderStatePBField9Entry(value: FundOrderStatePBField9Entry): (TxId, Money) = (decodeTxIdPB(req(value.f0)), decodeMoneyPB(req(value.f1)))
  def encodeFundOrderStatePBField12(value: Map[TxId, String]): FundOrderStatePBField12 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField12Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField12(rows) }
  def decodeFundOrderStatePBField12(value: FundOrderStatePBField12): Map[TxId, String] = { val rows = value.f0.map(item => decodeFundOrderStatePBField12Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField12Entry(value: (TxId, String)): FundOrderStatePBField12Entry = FundOrderStatePBField12Entry(Some(encodeTxIdPB(value._1)), value._2)
  def decodeFundOrderStatePBField12Entry(value: FundOrderStatePBField12Entry): (TxId, String) = (decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderStatePBField13(value: Map[TxId, String]): FundOrderStatePBField13 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField13Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField13(rows) }
  def decodeFundOrderStatePBField13(value: FundOrderStatePBField13): Map[TxId, String] = { val rows = value.f0.map(item => decodeFundOrderStatePBField13Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField13Entry(value: (TxId, String)): FundOrderStatePBField13Entry = FundOrderStatePBField13Entry(Some(encodeTxIdPB(value._1)), value._2)
  def decodeFundOrderStatePBField13Entry(value: FundOrderStatePBField13Entry): (TxId, String) = (decodeTxIdPB(req(value.f0)), value.f1)
  def encodeFundOrderStatePBField17(value: Map[String, String]): FundOrderStatePBField17 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField17Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField17(rows) }
  def decodeFundOrderStatePBField17(value: FundOrderStatePBField17): Map[String, String] = { val rows = value.f0.map(item => decodeFundOrderStatePBField17Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField17Entry(value: (String, String)): FundOrderStatePBField17Entry = FundOrderStatePBField17Entry(value._1, value._2)
  def decodeFundOrderStatePBField17Entry(value: FundOrderStatePBField17Entry): (String, String) = (value.f0, value.f1)
  def encodeFundOrderStatePBField18(value: Map[String, String]): FundOrderStatePBField18 = { val rows = value.toVector.map(item => encodeFundOrderStatePBField18Entry(item)).sortBy(item => item.toByteArray.iterator.map(b => f"${b & 0xff}%02x").mkString); FundOrderStatePBField18(rows) }
  def decodeFundOrderStatePBField18(value: FundOrderStatePBField18): Map[String, String] = { val rows = value.f0.map(item => decodeFundOrderStatePBField18Entry(item)).toVector; require(rows.map(_._1).distinct.size == rows.size, "duplicate typed map key"); rows.toMap }
  def encodeFundOrderStatePBField18Entry(value: (String, String)): FundOrderStatePBField18Entry = FundOrderStatePBField18Entry(value._1, value._2)
  def decodeFundOrderStatePBField18Entry(value: FundOrderStatePBField18Entry): (String, String) = (value.f0, value.f1)
}
