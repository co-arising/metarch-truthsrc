package example.bankwealth.infrastructure.persistence.converters

import example.bankwealth.domain.entities._
import example.bankwealth.application.api._
import example.bankwealth.application.integration._
import example.bankwealth.application.process._
import example.bankwealth.application.projection._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.persistence._
import example.bankwealth.infrastructure.{proto => pb}
trait DomainConvertersPart1 { self: DomainConverters.type =>
  def encodeCreditOriginalInvestorPrepareReceiptPO(value: CreditOriginalInvestorPrepareReceipt): pb.CreditOriginalInvestorPrepareReceiptPO = pb.CreditOriginalInvestorPrepareReceiptPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = Some(encodeTxIdPO(value.payloadTxid)),
    payloadResource = Some(encodeAccountIdPO(value.payloadResource)),
    payloadAmount = Some(encodeMoneyPO(value.payloadAmount))
  )
  def decodeCreditOriginalInvestorPrepareReceiptPO(value: pb.CreditOriginalInvestorPrepareReceiptPO): CreditOriginalInvestorPrepareReceipt = CreditOriginalInvestorPrepareReceipt(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = decodeTxIdPO(req(value.payloadTxid)),
    payloadResource = decodeAccountIdPO(req(value.payloadResource)),
    payloadAmount = decodeMoneyPO(req(value.payloadAmount))
  )

  def encodeCreditOriginalInvestorPrepareQueryPO(value: CreditOriginalInvestorPrepareQuery): pb.CreditOriginalInvestorPrepareQueryPO = pb.CreditOriginalInvestorPrepareQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeCreditOriginalInvestorPrepareQueryPO(value: pb.CreditOriginalInvestorPrepareQueryPO): CreditOriginalInvestorPrepareQuery = CreditOriginalInvestorPrepareQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeCreditOriginalInvestorCommitInputPO(value: CreditOriginalInvestorCommitInput): pb.CreditOriginalInvestorCommitInputPO = pb.CreditOriginalInvestorCommitInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCreditOriginalInvestorCommitInputPO(value: pb.CreditOriginalInvestorCommitInputPO): CreditOriginalInvestorCommitInput = CreditOriginalInvestorCommitInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeCreditOriginalInvestorCommitReceiptPO(value: CreditOriginalInvestorCommitReceipt): pb.CreditOriginalInvestorCommitReceiptPO = pb.CreditOriginalInvestorCommitReceiptPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = Some(encodeTxIdPO(value.payloadTxid)),
    payloadResource = Some(encodeAccountIdPO(value.payloadResource)),
    payloadAmount = Some(encodeMoneyPO(value.payloadAmount)),
    payloadCurrency = value.payloadCurrency,
    payloadAvailable = Some(encodeMoneyPO(value.payloadAvailable))
  )
  def decodeCreditOriginalInvestorCommitReceiptPO(value: pb.CreditOriginalInvestorCommitReceiptPO): CreditOriginalInvestorCommitReceipt = CreditOriginalInvestorCommitReceipt(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = decodeTxIdPO(req(value.payloadTxid)),
    payloadResource = decodeAccountIdPO(req(value.payloadResource)),
    payloadAmount = decodeMoneyPO(req(value.payloadAmount)),
    payloadCurrency = value.payloadCurrency,
    payloadAvailable = decodeMoneyPO(req(value.payloadAvailable))
  )

  def encodeCreditOriginalInvestorCommitQueryPO(value: CreditOriginalInvestorCommitQuery): pb.CreditOriginalInvestorCommitQueryPO = pb.CreditOriginalInvestorCommitQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeCreditOriginalInvestorCommitQueryPO(value: pb.CreditOriginalInvestorCommitQueryPO): CreditOriginalInvestorCommitQuery = CreditOriginalInvestorCommitQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeCreditOriginalInvestorCompensateInputPO(value: CreditOriginalInvestorCompensateInput): pb.CreditOriginalInvestorCompensateInputPO = pb.CreditOriginalInvestorCompensateInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCreditOriginalInvestorCompensateInputPO(value: pb.CreditOriginalInvestorCompensateInputPO): CreditOriginalInvestorCompensateInput = CreditOriginalInvestorCompensateInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeCreditOriginalInvestorCompensateReceiptPO(value: CreditOriginalInvestorCompensateReceipt): pb.CreditOriginalInvestorCompensateReceiptPO = pb.CreditOriginalInvestorCompensateReceiptPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = Some(encodeTxIdPO(value.payloadTxid)),
    payloadResource = Some(encodeAccountIdPO(value.payloadResource)),
    payloadAmount = Some(encodeMoneyPO(value.payloadAmount))
  )
  def decodeCreditOriginalInvestorCompensateReceiptPO(value: pb.CreditOriginalInvestorCompensateReceiptPO): CreditOriginalInvestorCompensateReceipt = CreditOriginalInvestorCompensateReceipt(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = decodeTxIdPO(req(value.payloadTxid)),
    payloadResource = decodeAccountIdPO(req(value.payloadResource)),
    payloadAmount = decodeMoneyPO(req(value.payloadAmount))
  )

  def encodeCreditOriginalInvestorCompensateQueryPO(value: CreditOriginalInvestorCompensateQuery): pb.CreditOriginalInvestorCompensateQueryPO = pb.CreditOriginalInvestorCompensateQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeCreditOriginalInvestorCompensateQueryPO(value: pb.CreditOriginalInvestorCompensateQueryPO): CreditOriginalInvestorCompensateQuery = CreditOriginalInvestorCompensateQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeBankRefundResultPO(value: BankRefundResult): pb.BankRefundResultPO = pb.BankRefundResultPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankRefundResultPO(value: pb.BankRefundResultPO): BankRefundResult = BankRefundResult(txid = decodeTxIdPO(req(value.txid)))

  def encodeBankTaEffectRequestPO(value: BankTaEffectRequest): pb.BankTaEffectRequestPO = pb.BankTaEffectRequestPO(taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)), fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)), paymentTxId = Some(encodeTxIdPO(value.paymentTxId)))
  def decodeBankTaEffectRequestPO(value: pb.BankTaEffectRequestPO): BankTaEffectRequest = BankTaEffectRequest(taRequestId = decodeTaRequestIdPO(req(value.taRequestId)), fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)), paymentTxId = decodeTxIdPO(req(value.paymentTxId)))

  def encodeBankTaEffectResultPO(value: BankTaEffectResult): pb.BankTaEffectResultPO = pb.BankTaEffectResultPO(taRequestId = Some(encodeTaRequestIdPO(value.taRequestId)))
  def decodeBankTaEffectResultPO(value: pb.BankTaEffectResultPO): BankTaEffectResult = BankTaEffectResult(taRequestId = decodeTaRequestIdPO(req(value.taRequestId)))

  def encodeBankTaEffectOperationPO(value: BankTaEffectOperation): pb.BankTaEffectOperationPO = pb.BankTaEffectOperationPO(operation = value.operation, request = Some(encodeBankTaEffectRequestPO(value.request)))
  def decodeBankTaEffectOperationPO(value: pb.BankTaEffectOperationPO): BankTaEffectOperation = BankTaEffectOperation(operation = value.operation, request = decodeBankTaEffectRequestPO(req(value.request)))

  def encodeBankTaEffectObservationPO(value: BankTaEffectObservation): pb.BankTaEffectObservationPO = pb.BankTaEffectObservationPO(
    operation = value.operation,
    request = Some(encodeBankTaEffectRequestPO(value.request)),
    status = value.status,
    evidence = value.evidence,
    result = value.result.map(encodeBankTaEffectResultPO)
  )
  def decodeBankTaEffectObservationPO(value: pb.BankTaEffectObservationPO): BankTaEffectObservation = BankTaEffectObservation(
    operation = value.operation,
    request = decodeBankTaEffectRequestPO(req(value.request)),
    status = value.status,
    evidence = value.evidence,
    result = value.result.map(decodeBankTaEffectResultPO)
  )

  def encodeBankTaEffectReconcilePO(value: BankTaEffectReconcile): pb.BankTaEffectReconcilePO = pb.BankTaEffectReconcilePO(
    operation = value.operation,
    request = Some(encodeBankTaEffectRequestPO(value.request)),
    decision = value.decision,
    evidence = value.evidence.map(encodeBankTaEffectObservationPO),
    authorization = value.authorization
  )
  def decodeBankTaEffectReconcilePO(value: pb.BankTaEffectReconcilePO): BankTaEffectReconcile = BankTaEffectReconcile(
    operation = value.operation,
    request = decodeBankTaEffectRequestPO(req(value.request)),
    decision = value.decision,
    evidence = value.evidence.map(decodeBankTaEffectObservationPO),
    authorization = value.authorization
  )

  def encodeBankSipDispatchRequestPO(value: BankSipDispatchRequest): pb.BankSipDispatchRequestPO = pb.BankSipDispatchRequestPO(occurrenceId = Some(encodeOccurrenceIdPO(value.occurrenceId)), occurrence = Some(encodeSipOccurrencePO(value.occurrence)))
  def decodeBankSipDispatchRequestPO(value: pb.BankSipDispatchRequestPO): BankSipDispatchRequest = BankSipDispatchRequest(occurrenceId = decodeOccurrenceIdPO(req(value.occurrenceId)), occurrence = decodeSipOccurrencePO(req(value.occurrence)))

  def encodeBankSipDispatchResultPO(value: BankSipDispatchResult): pb.BankSipDispatchResultPO = pb.BankSipDispatchResultPO(operationId = Some(encodeOperationIdPO(value.operationId)))
  def decodeBankSipDispatchResultPO(value: pb.BankSipDispatchResultPO): BankSipDispatchResult = BankSipDispatchResult(operationId = decodeOperationIdPO(req(value.operationId)))

  def encodeBankSipDispatchOperationPO(value: BankSipDispatchOperation): pb.BankSipDispatchOperationPO = pb.BankSipDispatchOperationPO(operation = value.operation, request = Some(encodeBankSipDispatchRequestPO(value.request)))
  def decodeBankSipDispatchOperationPO(value: pb.BankSipDispatchOperationPO): BankSipDispatchOperation = BankSipDispatchOperation(operation = value.operation, request = decodeBankSipDispatchRequestPO(req(value.request)))

  def encodeBankSipDispatchObservationPO(value: BankSipDispatchObservation): pb.BankSipDispatchObservationPO = pb.BankSipDispatchObservationPO(
    operation = value.operation,
    request = Some(encodeBankSipDispatchRequestPO(value.request)),
    status = value.status,
    evidence = value.evidence,
    result = value.result.map(encodeBankSipDispatchResultPO)
  )
  def decodeBankSipDispatchObservationPO(value: pb.BankSipDispatchObservationPO): BankSipDispatchObservation = BankSipDispatchObservation(
    operation = value.operation,
    request = decodeBankSipDispatchRequestPO(req(value.request)),
    status = value.status,
    evidence = value.evidence,
    result = value.result.map(decodeBankSipDispatchResultPO)
  )

  def encodeBankSipDispatchReconcilePO(value: BankSipDispatchReconcile): pb.BankSipDispatchReconcilePO = pb.BankSipDispatchReconcilePO(
    operation = value.operation,
    request = Some(encodeBankSipDispatchRequestPO(value.request)),
    decision = value.decision,
    evidence = value.evidence.map(encodeBankSipDispatchObservationPO),
    authorization = value.authorization
  )
  def decodeBankSipDispatchReconcilePO(value: pb.BankSipDispatchReconcilePO): BankSipDispatchReconcile = BankSipDispatchReconcile(
    operation = value.operation,
    request = decodeBankSipDispatchRequestPO(req(value.request)),
    decision = value.decision,
    evidence = value.evidence.map(decodeBankSipDispatchObservationPO),
    authorization = value.authorization
  )

  def encodeBankCashSubmitPO(value: BankCashSubmit): pb.BankCashSubmitPO = pb.BankCashSubmitPO(clientRequestId = value.clientRequestId, fundCode = value.fundCode, amount = Some(encodeMoneyWirePO(value.amount)))
  def decodeBankCashSubmitPO(value: pb.BankCashSubmitPO): BankCashSubmit = BankCashSubmit(clientRequestId = value.clientRequestId, fundCode = value.fundCode, amount = decodeMoneyWirePO(req(value.amount)))

  def encodeBankCashOriginalPO(value: BankCashOriginal): pb.BankCashOriginalPO = pb.BankCashOriginalPO(
    principalId = value.principalId,
    clientRequestId = value.clientRequestId,
    authorityVersion = value.authorityVersion,
    request = Some(encodeBankCashSubmitPO(value.request)),
    payment = Some(encodeBankPaymentOriginalPO(value.payment))
  )
  def decodeBankCashOriginalPO(value: pb.BankCashOriginalPO): BankCashOriginal = BankCashOriginal(
    principalId = value.principalId,
    clientRequestId = value.clientRequestId,
    authorityVersion = value.authorityVersion,
    request = decodeBankCashSubmitPO(req(value.request)),
    payment = decodeBankPaymentOriginalPO(req(value.payment))
  )

  def encodeBankCashAcknowledgementPO(value: BankCashAcknowledgement): pb.BankCashAcknowledgementPO = pb.BankCashAcknowledgementPO(original = Some(encodeBankCashOriginalPO(value.original)), status = value.status)
  def decodeBankCashAcknowledgementPO(value: pb.BankCashAcknowledgementPO): BankCashAcknowledgement = BankCashAcknowledgement(original = decodeBankCashOriginalPO(req(value.original)), status = value.status)

  def encodeBankSipCreatePO(value: BankSipCreate): pb.BankSipCreatePO = pb.BankSipCreatePO(
    clientRequestId = value.clientRequestId,
    fundCode = value.fundCode,
    amount = Some(encodeMoneyWirePO(value.amount)),
    effectiveSlot = value.effectiveSlot,
    dueSlots = value.dueSlots
  )
  def decodeBankSipCreatePO(value: pb.BankSipCreatePO): BankSipCreate = BankSipCreate(
    clientRequestId = value.clientRequestId,
    fundCode = value.fundCode,
    amount = decodeMoneyWirePO(req(value.amount)),
    effectiveSlot = value.effectiveSlot,
    dueSlots = value.dueSlots.toVector
  )

  def encodeBankSipCreateIntentPO(value: BankSipCreateIntent): pb.BankSipCreateIntentPO = pb.BankSipCreateIntentPO(
    principalId = value.principalId,
    clientRequestId = value.clientRequestId,
    authorityVersion = value.authorityVersion,
    request = Some(encodeBankSipCreatePO(value.request)),
    planId = Some(encodePlanIdPO(value.planId)),
    config = Some(encodeSipRevisionConfigPO(value.config))
  )
  def decodeBankSipCreateIntentPO(value: pb.BankSipCreateIntentPO): BankSipCreateIntent = BankSipCreateIntent(
    principalId = value.principalId,
    clientRequestId = value.clientRequestId,
    authorityVersion = value.authorityVersion,
    request = decodeBankSipCreatePO(req(value.request)),
    planId = decodePlanIdPO(req(value.planId)),
    config = decodeSipRevisionConfigPO(req(value.config))
  )

  def encodeBankSipAcknowledgementPO(value: BankSipAcknowledgement): pb.BankSipAcknowledgementPO = pb.BankSipAcknowledgementPO(planId = Some(encodePlanIdPO(value.planId)), status = value.status)
  def decodeBankSipAcknowledgementPO(value: pb.BankSipAcknowledgementPO): BankSipAcknowledgement = BankSipAcknowledgement(planId = decodePlanIdPO(req(value.planId)), status = value.status)

  def encodeBankSipRevisePO(value: BankSipRevise): pb.BankSipRevisePO = pb.BankSipRevisePO(
    revision = Some(encodeRevisionIdPO(value.revision)),
    effectiveSlot = value.effectiveSlot,
    fundCode = value.fundCode,
    amount = Some(encodeMoneyWirePO(value.amount))
  )
  def decodeBankSipRevisePO(value: pb.BankSipRevisePO): BankSipRevise = BankSipRevise(
    revision = decodeRevisionIdPO(req(value.revision)),
    effectiveSlot = value.effectiveSlot,
    fundCode = value.fundCode,
    amount = decodeMoneyWirePO(req(value.amount))
  )

  def encodeBankSipRevisionInputPO(value: BankSipRevisionInput): pb.BankSipRevisionInputPO = pb.BankSipRevisionInputPO(planId = Some(encodePlanIdPO(value.planId)), request = Some(encodeBankSipRevisePO(value.request)))
  def decodeBankSipRevisionInputPO(value: pb.BankSipRevisionInputPO): BankSipRevisionInput = BankSipRevisionInput(planId = decodePlanIdPO(req(value.planId)), request = decodeBankSipRevisePO(req(value.request)))

  def encodeBankTickPO(value: BankTick): pb.BankTickPO = pb.BankTickPO(slot = value.slot)
  def decodeBankTickPO(value: pb.BankTickPO): BankTick = BankTick(slot = value.slot)

  def encodeBankTickAcknowledgementPO(value: BankTickAcknowledgement): pb.BankTickAcknowledgementPO = pb.BankTickAcknowledgementPO(slot = value.slot, plans = value.plans)
  def decodeBankTickAcknowledgementPO(value: pb.BankTickAcknowledgementPO): BankTickAcknowledgement = BankTickAcknowledgement(slot = value.slot, plans = value.plans)

  def encodeBankAccountKeyPO(value: BankAccountKey): pb.BankAccountKeyPO = pb.BankAccountKeyPO(schemaVersion = value.schemaVersion)
  def decodeBankAccountKeyPO(value: pb.BankAccountKeyPO): BankAccountKey = BankAccountKey(schemaVersion = value.schemaVersion)

  def encodeBankCashRequestKeyPO(value: BankCashRequestKey): pb.BankCashRequestKeyPO = pb.BankCashRequestKeyPO(clientRequestId = value.clientRequestId)
  def decodeBankCashRequestKeyPO(value: pb.BankCashRequestKeyPO): BankCashRequestKey = BankCashRequestKey(clientRequestId = value.clientRequestId)

  def encodeBankOrderKeyPO(value: BankOrderKey): pb.BankOrderKeyPO = pb.BankOrderKeyPO(orderId = Some(encodeFundOrderIdPO(value.orderId)))
  def decodeBankOrderKeyPO(value: pb.BankOrderKeyPO): BankOrderKey = BankOrderKey(orderId = decodeFundOrderIdPO(req(value.orderId)))

  def encodeBankPlanKeyPO(value: BankPlanKey): pb.BankPlanKeyPO = pb.BankPlanKeyPO(planId = Some(encodePlanIdPO(value.planId)))
  def decodeBankPlanKeyPO(value: pb.BankPlanKeyPO): BankPlanKey = BankPlanKey(planId = decodePlanIdPO(req(value.planId)))

  def encodeBankPlanPageKeyPO(value: BankPlanPageKey): pb.BankPlanPageKeyPO = pb.BankPlanPageKeyPO(limit = value.limit, after = value.after)
  def decodeBankPlanPageKeyPO(value: pb.BankPlanPageKeyPO): BankPlanPageKey = BankPlanPageKey(limit = value.limit, after = value.after)

  def encodeBankOccurrencePageKeyPO(value: BankOccurrencePageKey): pb.BankOccurrencePageKeyPO = pb.BankOccurrencePageKeyPO(planId = Some(encodePlanIdPO(value.planId)), limit = value.limit, after = value.after)
  def decodeBankOccurrencePageKeyPO(value: pb.BankOccurrencePageKeyPO): BankOccurrencePageKey = BankOccurrencePageKey(planId = decodePlanIdPO(req(value.planId)), limit = value.limit, after = value.after)

  def encodeBankPendingPageKeyPO(value: BankPendingPageKey): pb.BankPendingPageKeyPO = pb.BankPendingPageKeyPO(limit = value.limit, after = value.after)
  def decodeBankPendingPageKeyPO(value: pb.BankPendingPageKeyPO): BankPendingPageKey = BankPendingPageKey(limit = value.limit, after = value.after)

  def encodeBankOperationKeyPO(value: BankOperationKey): pb.BankOperationKeyPO = pb.BankOperationKeyPO(operationId = Some(encodeOperationIdPO(value.operationId)))
  def decodeBankOperationKeyPO(value: pb.BankOperationKeyPO): BankOperationKey = BankOperationKey(operationId = decodeOperationIdPO(req(value.operationId)))

  def encodeBankProjectionWatermarkPO(value: BankProjectionWatermark): pb.BankProjectionWatermarkPO = pb.BankProjectionWatermarkPO(
    persistenceId = value.persistenceId,
    lastSequence = value.lastSequence,
    observedSequence = value.observedSequence,
    disposition = value.disposition
  )
  def decodeBankProjectionWatermarkPO(value: pb.BankProjectionWatermarkPO): BankProjectionWatermark = BankProjectionWatermark(
    persistenceId = value.persistenceId,
    lastSequence = value.lastSequence,
    observedSequence = value.observedSequence,
    disposition = value.disposition
  )

  def encodeBankReadMetadataPO(value: BankReadMetadata): pb.BankReadMetadataPO = pb.BankReadMetadataPO(schemaVersion = value.schemaVersion, disposition = value.disposition, watermarks = value.watermarks.map(encodeBankProjectionWatermarkPO))
  def decodeBankReadMetadataPO(value: pb.BankReadMetadataPO): BankReadMetadata = BankReadMetadata(schemaVersion = value.schemaVersion, disposition = value.disposition, watermarks = value.watermarks.map(decodeBankProjectionWatermarkPO).toVector)

  def encodeBankAccountViewPO(value: BankAccountView): pb.BankAccountViewPO = pb.BankAccountViewPO(
    accountId = Some(encodeAccountIdPO(value.accountId)),
    initialized = value.initialized,
    available = Some(encodeMoneyWirePO(value.available)),
    reserved = Some(encodeMoneyWirePO(value.reserved))
  )
  def decodeBankAccountViewPO(value: pb.BankAccountViewPO): BankAccountView = BankAccountView(
    accountId = decodeAccountIdPO(req(value.accountId)),
    initialized = value.initialized,
    available = decodeMoneyWirePO(req(value.available)),
    reserved = decodeMoneyWirePO(req(value.reserved))
  )

  def encodeBankCashRequestViewPO(value: BankCashRequestView): pb.BankCashRequestViewPO = pb.BankCashRequestViewPO(
    original = Some(encodeBankCashOriginalPO(value.original)),
    paymentStatus = value.paymentStatus,
    taStatus = value.taStatus,
    refundStatus = value.refundStatus
  )
  def decodeBankCashRequestViewPO(value: pb.BankCashRequestViewPO): BankCashRequestView = BankCashRequestView(
    original = decodeBankCashOriginalPO(req(value.original)),
    paymentStatus = value.paymentStatus,
    taStatus = value.taStatus,
    refundStatus = value.refundStatus
  )

  def encodeBankTaSharesViewPO(value: BankTaSharesView): pb.BankTaSharesViewPO = pb.BankTaSharesViewPO(fundCode = value.fundCode, shares = Some(encodeTaExactTextPO(value.shares)), nav = Some(encodeTaExactTextPO(value.nav)))
  def decodeBankTaSharesViewPO(value: pb.BankTaSharesViewPO): BankTaSharesView = BankTaSharesView(fundCode = value.fundCode, shares = decodeTaExactTextPO(req(value.shares)), nav = decodeTaExactTextPO(req(value.nav)))

  def encodeBankOrderViewPO(value: BankOrderView): pb.BankOrderViewPO = pb.BankOrderViewPO(
    orderId = Some(encodeFundOrderIdPO(value.orderId)),
    operationId = Some(encodeOperationIdPO(value.operationId)),
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = Some(encodeMoneyWirePO(value.amount)),
    paymentTxId = value.paymentTxId.map(encodeTxIdPO),
    paymentStatus = value.paymentStatus,
    taRequestId = value.taRequestId.map(encodeTaRequestIdPO),
    taStatus = value.taStatus,
    taReference = value.taReference,
    taShares = value.taShares.map(encodeBankTaSharesViewPO),
    taRejectionReason = value.taRejectionReason,
    refundOperationId = value.refundOperationId.map(encodeOperationIdPO),
    refundStatus = value.refundStatus
  )
  def decodeBankOrderViewPO(value: pb.BankOrderViewPO): BankOrderView = BankOrderView(
    orderId = decodeFundOrderIdPO(req(value.orderId)),
    operationId = decodeOperationIdPO(req(value.operationId)),
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = decodeMoneyWirePO(req(value.amount)),
    paymentTxId = value.paymentTxId.map(decodeTxIdPO),
    paymentStatus = value.paymentStatus,
    taRequestId = value.taRequestId.map(decodeTaRequestIdPO),
    taStatus = value.taStatus,
    taReference = value.taReference,
    taShares = value.taShares.map(decodeBankTaSharesViewPO),
    taRejectionReason = value.taRejectionReason,
    refundOperationId = value.refundOperationId.map(decodeOperationIdPO),
    refundStatus = value.refundStatus
  )

  def encodeBankSipRevisionViewPO(value: BankSipRevisionView): pb.BankSipRevisionViewPO = pb.BankSipRevisionViewPO(config = Some(encodeSipRevisionConfigPO(value.config)), endSlot = value.endSlot)
  def decodeBankSipRevisionViewPO(value: pb.BankSipRevisionViewPO): BankSipRevisionView = BankSipRevisionView(config = decodeSipRevisionConfigPO(req(value.config)), endSlot = value.endSlot)

  def encodeBankSipPlanViewPO(value: BankSipPlanView): pb.BankSipPlanViewPO = pb.BankSipPlanViewPO(
    planId = Some(encodePlanIdPO(value.planId)),
    original = value.original.map(encodeBankSipCreateIntentPO),
    initialized = value.initialized,
    scheduleSealed = value.scheduleSealed,
    paused = value.paused,
    currentTick = value.currentTick,
    dueSlots = value.dueSlots,
    revisions = value.revisions.map(encodeBankSipRevisionViewPO),
    scheduleCount = value.scheduleCount,
    observedCount = value.observedCount,
    startCount = value.startCount,
    successTotal = value.successTotal,
    failureTotal = value.failureTotal
  )
  def decodeBankSipPlanViewPO(value: pb.BankSipPlanViewPO): BankSipPlanView = BankSipPlanView(
    planId = decodePlanIdPO(req(value.planId)),
    original = value.original.map(decodeBankSipCreateIntentPO),
    initialized = value.initialized,
    scheduleSealed = value.scheduleSealed,
    paused = value.paused,
    currentTick = value.currentTick,
    dueSlots = value.dueSlots.toVector,
    revisions = value.revisions.map(decodeBankSipRevisionViewPO).toVector,
    scheduleCount = value.scheduleCount,
    observedCount = value.observedCount,
    startCount = value.startCount,
    successTotal = value.successTotal,
    failureTotal = value.failureTotal
  )

  def encodeBankSipOccurrenceViewPO(value: BankSipOccurrenceView): pb.BankSipOccurrenceViewPO = pb.BankSipOccurrenceViewPO(
    occurrence = Some(encodeSipOccurrencePO(value.occurrence)),
    slotDisposition = value.slotDisposition,
    progress = value.progress,
    paymentStatus = value.paymentStatus,
    taStatus = value.taStatus,
    refundStatus = value.refundStatus,
    firstTerminal = value.firstTerminal
  )
  def decodeBankSipOccurrenceViewPO(value: pb.BankSipOccurrenceViewPO): BankSipOccurrenceView = BankSipOccurrenceView(
    occurrence = decodeSipOccurrencePO(req(value.occurrence)),
    slotDisposition = value.slotDisposition,
    progress = value.progress,
    paymentStatus = value.paymentStatus,
    taStatus = value.taStatus,
    refundStatus = value.refundStatus,
    firstTerminal = value.firstTerminal
  )

  def encodeBankPendingOperationViewPO(value: BankPendingOperationView): pb.BankPendingOperationViewPO = pb.BankPendingOperationViewPO(
    operationId = Some(encodeOperationIdPO(value.operationId)),
    flow = value.flow,
    orderId = value.orderId.map(encodeFundOrderIdPO),
    planId = value.planId.map(encodePlanIdPO),
    occurrenceId = value.occurrenceId.map(encodeOccurrenceIdPO),
    phase = value.phase,
    status = value.status,
    recoverable = value.recoverable
  )
  def decodeBankPendingOperationViewPO(value: pb.BankPendingOperationViewPO): BankPendingOperationView = BankPendingOperationView(
    operationId = decodeOperationIdPO(req(value.operationId)),
    flow = value.flow,
    orderId = value.orderId.map(decodeFundOrderIdPO),
    planId = value.planId.map(decodePlanIdPO),
    occurrenceId = value.occurrenceId.map(decodeOccurrenceIdPO),
    phase = value.phase,
    status = value.status,
    recoverable = value.recoverable
  )

  def encodeBankAccountResponsePO(value: BankAccountResponse): pb.BankAccountResponsePO = pb.BankAccountResponsePO(metadata = Some(encodeBankReadMetadataPO(value.metadata)), account = value.account.map(encodeBankAccountViewPO))
  def decodeBankAccountResponsePO(value: pb.BankAccountResponsePO): BankAccountResponse = BankAccountResponse(metadata = decodeBankReadMetadataPO(req(value.metadata)), account = value.account.map(decodeBankAccountViewPO))

  def encodeBankCashRequestResponsePO(value: BankCashRequestResponse): pb.BankCashRequestResponsePO = pb.BankCashRequestResponsePO(metadata = Some(encodeBankReadMetadataPO(value.metadata)), request = value.request.map(encodeBankCashRequestViewPO))
  def decodeBankCashRequestResponsePO(value: pb.BankCashRequestResponsePO): BankCashRequestResponse = BankCashRequestResponse(metadata = decodeBankReadMetadataPO(req(value.metadata)), request = value.request.map(decodeBankCashRequestViewPO))

  def encodeBankOrderResponsePO(value: BankOrderResponse): pb.BankOrderResponsePO = pb.BankOrderResponsePO(metadata = Some(encodeBankReadMetadataPO(value.metadata)), order = value.order.map(encodeBankOrderViewPO))
  def decodeBankOrderResponsePO(value: pb.BankOrderResponsePO): BankOrderResponse = BankOrderResponse(metadata = decodeBankReadMetadataPO(req(value.metadata)), order = value.order.map(decodeBankOrderViewPO))

  def encodeBankSipPlanResponsePO(value: BankSipPlanResponse): pb.BankSipPlanResponsePO = pb.BankSipPlanResponsePO(metadata = Some(encodeBankReadMetadataPO(value.metadata)), plan = value.plan.map(encodeBankSipPlanViewPO))
  def decodeBankSipPlanResponsePO(value: pb.BankSipPlanResponsePO): BankSipPlanResponse = BankSipPlanResponse(metadata = decodeBankReadMetadataPO(req(value.metadata)), plan = value.plan.map(decodeBankSipPlanViewPO))

  def encodeBankSipPlanPagePO(value: BankSipPlanPage): pb.BankSipPlanPagePO = pb.BankSipPlanPagePO(metadata = Some(encodeBankReadMetadataPO(value.metadata)), plans = value.plans.map(encodeBankSipPlanViewPO), nextAfter = value.nextAfter)
  def decodeBankSipPlanPagePO(value: pb.BankSipPlanPagePO): BankSipPlanPage = BankSipPlanPage(metadata = decodeBankReadMetadataPO(req(value.metadata)), plans = value.plans.map(decodeBankSipPlanViewPO).toVector, nextAfter = value.nextAfter)

  def encodeBankSipOccurrencePagePO(value: BankSipOccurrencePage): pb.BankSipOccurrencePagePO = pb.BankSipOccurrencePagePO(metadata = Some(encodeBankReadMetadataPO(value.metadata)), occurrences = value.occurrences.map(encodeBankSipOccurrenceViewPO), nextAfter = value.nextAfter)
  def decodeBankSipOccurrencePagePO(value: pb.BankSipOccurrencePagePO): BankSipOccurrencePage = BankSipOccurrencePage(metadata = decodeBankReadMetadataPO(req(value.metadata)), occurrences = value.occurrences.map(decodeBankSipOccurrenceViewPO).toVector, nextAfter = value.nextAfter)

  def encodeBankPendingResponsePO(value: BankPendingResponse): pb.BankPendingResponsePO = pb.BankPendingResponsePO(metadata = Some(encodeBankReadMetadataPO(value.metadata)), operations = value.operations.map(encodeBankPendingOperationViewPO), nextAfter = value.nextAfter)
  def decodeBankPendingResponsePO(value: pb.BankPendingResponsePO): BankPendingResponse = BankPendingResponse(metadata = decodeBankReadMetadataPO(req(value.metadata)), operations = value.operations.map(decodeBankPendingOperationViewPO).toVector, nextAfter = value.nextAfter)

  def encodeBankRecoveryAcknowledgementPO(value: BankRecoveryAcknowledgement): pb.BankRecoveryAcknowledgementPO = pb.BankRecoveryAcknowledgementPO(operationId = Some(encodeOperationIdPO(value.operationId)), status = value.status)
  def decodeBankRecoveryAcknowledgementPO(value: pb.BankRecoveryAcknowledgementPO): BankRecoveryAcknowledgement = BankRecoveryAcknowledgement(operationId = decodeOperationIdPO(req(value.operationId)), status = value.status)

  def encodeBankServiceBootstrapInputPO(value: BankServiceBootstrapInput): pb.BankServiceBootstrapInputPO = pb.BankServiceBootstrapInputPO(namespace = value.namespace)
  def decodeBankServiceBootstrapInputPO(value: pb.BankServiceBootstrapInputPO): BankServiceBootstrapInput = BankServiceBootstrapInput(namespace = value.namespace)

  def encodeBankServiceBootstrapAcknowledgementPO(value: BankServiceBootstrapAcknowledgement): pb.BankServiceBootstrapAcknowledgementPO = pb.BankServiceBootstrapAcknowledgementPO(namespace = value.namespace, status = value.status)
  def decodeBankServiceBootstrapAcknowledgementPO(value: pb.BankServiceBootstrapAcknowledgementPO): BankServiceBootstrapAcknowledgement = BankServiceBootstrapAcknowledgement(namespace = value.namespace, status = value.status)

  def encodeCreditBalanceStatePO(value: CreditBalanceEntity.State): pb.CreditBalanceStatePO = pb.CreditBalanceStatePO(
    id = Some(encodeAccountIdPO(value.id)),
    initialized = value.initialized,
    accountBalance = value.accountBalance.map { case (k, v) => k -> encodeMoneyPO(v) },
    reservedAmount = value.reservedAmount.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    incomingCredits = value.incomingCredits.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    committedOutgoing = value.committedOutgoing.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    committedIncoming = value.committedIncoming.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    compensatedOutgoing = value.compensatedOutgoing.map { case (k, v) => k.value -> encodeMoneyPO(v) },
    compensatedIncoming = value.compensatedIncoming.map { case (k, v) => k.value -> encodeMoneyPO(v) }
  )
  def decodeCreditBalanceStatePO(value: pb.CreditBalanceStatePO): CreditBalanceEntity.State = CreditBalanceEntity.State(
    id = decodeAccountIdPO(req(value.id)),
    initialized = value.initialized,
    accountBalance = value.accountBalance.map { case (k, v) => k -> decodeMoneyPO(v) },
    reservedAmount = value.reservedAmount.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    incomingCredits = value.incomingCredits.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    committedOutgoing = value.committedOutgoing.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    committedIncoming = value.committedIncoming.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    compensatedOutgoing = value.compensatedOutgoing.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) },
    compensatedIncoming = value.compensatedIncoming.map { case (k, v) => TxId(k) -> decodeMoneyPO(v) }
  )
  def encodeAccountInitializedPO(value: CreditBalanceEntity.AccountInitialized): pb.AccountInitializedPO = pb.AccountInitializedPO(resource = Some(encodeAccountIdPO(value.resource)), currency = value.currency, amount = Some(encodeMoneyPO(value.amount)))
  def decodeAccountInitializedPO(value: pb.AccountInitializedPO): CreditBalanceEntity.AccountInitialized = CreditBalanceEntity.AccountInitialized(resource = decodeAccountIdPO(req(value.resource)), currency = value.currency, amount = decodeMoneyPO(req(value.amount)))
  def encodeReserveFundsConfirmedPO(value: CreditBalanceEntity.ReserveFundsConfirmed): pb.ReserveFundsConfirmedPO = pb.ReserveFundsConfirmedPO(
    txid = Some(encodeTxIdPO(value.txid)),
    resource = Some(encodeAccountIdPO(value.resource)),
    amount = Some(encodeMoneyPO(value.amount)),
    currency = value.currency,
    available = Some(encodeMoneyPO(value.available))
  )
  def decodeReserveFundsConfirmedPO(value: pb.ReserveFundsConfirmedPO): CreditBalanceEntity.ReserveFundsConfirmed = CreditBalanceEntity.ReserveFundsConfirmed(
    txid = decodeTxIdPO(req(value.txid)),
    resource = decodeAccountIdPO(req(value.resource)),
    amount = decodeMoneyPO(req(value.amount)),
    currency = value.currency,
    available = decodeMoneyPO(req(value.available))
  )
  def encodeDeductFundsConfirmedPO(value: CreditBalanceEntity.DeductFundsConfirmed): pb.DeductFundsConfirmedPO = pb.DeductFundsConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeDeductFundsConfirmedPO(value: pb.DeductFundsConfirmedPO): CreditBalanceEntity.DeductFundsConfirmed = CreditBalanceEntity.DeductFundsConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeReleaseReservedFundsConfirmedPO(value: CreditBalanceEntity.ReleaseReservedFundsConfirmed): pb.ReleaseReservedFundsConfirmedPO = pb.ReleaseReservedFundsConfirmedPO(
    txid = Some(encodeTxIdPO(value.txid)),
    resource = Some(encodeAccountIdPO(value.resource)),
    amount = Some(encodeMoneyPO(value.amount)),
    currency = value.currency,
    available = Some(encodeMoneyPO(value.available))
  )
  def decodeReleaseReservedFundsConfirmedPO(value: pb.ReleaseReservedFundsConfirmedPO): CreditBalanceEntity.ReleaseReservedFundsConfirmed = CreditBalanceEntity.ReleaseReservedFundsConfirmed(
    txid = decodeTxIdPO(req(value.txid)),
    resource = decodeAccountIdPO(req(value.resource)),
    amount = decodeMoneyPO(req(value.amount)),
    currency = value.currency,
    available = decodeMoneyPO(req(value.available))
  )
  def encodeRecordIncomingCreditsConfirmedPO(value: CreditBalanceEntity.RecordIncomingCreditsConfirmed): pb.RecordIncomingCreditsConfirmedPO = pb.RecordIncomingCreditsConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeRecordIncomingCreditsConfirmedPO(value: pb.RecordIncomingCreditsConfirmedPO): CreditBalanceEntity.RecordIncomingCreditsConfirmed = CreditBalanceEntity.RecordIncomingCreditsConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeCommitIncomingCreditsConfirmedPO(value: CreditBalanceEntity.CommitIncomingCreditsConfirmed): pb.CommitIncomingCreditsConfirmedPO = pb.CommitIncomingCreditsConfirmedPO(
    txid = Some(encodeTxIdPO(value.txid)),
    resource = Some(encodeAccountIdPO(value.resource)),
    amount = Some(encodeMoneyPO(value.amount)),
    currency = value.currency,
    available = Some(encodeMoneyPO(value.available))
  )
  def decodeCommitIncomingCreditsConfirmedPO(value: pb.CommitIncomingCreditsConfirmedPO): CreditBalanceEntity.CommitIncomingCreditsConfirmed = CreditBalanceEntity.CommitIncomingCreditsConfirmed(
    txid = decodeTxIdPO(req(value.txid)),
    resource = decodeAccountIdPO(req(value.resource)),
    amount = decodeMoneyPO(req(value.amount)),
    currency = value.currency,
    available = decodeMoneyPO(req(value.available))
  )
  def encodeCancelIncomingCreditConfirmedPO(value: CreditBalanceEntity.CancelIncomingCreditConfirmed): pb.CancelIncomingCreditConfirmedPO = pb.CancelIncomingCreditConfirmedPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCancelIncomingCreditConfirmedPO(value: pb.CancelIncomingCreditConfirmedPO): CreditBalanceEntity.CancelIncomingCreditConfirmed = CreditBalanceEntity.CancelIncomingCreditConfirmed(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))
  def encodeCreditBalanceEventPO(value: CreditBalanceEntity.Event): pb.CreditBalanceEventPO = value match {
    case e: CreditBalanceEntity.AccountInitialized => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.AccountInitialized(encodeAccountInitializedPO(e)))
    case e: CreditBalanceEntity.ReserveFundsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.ReserveFundsConfirmed(encodeReserveFundsConfirmedPO(e)))
    case e: CreditBalanceEntity.DeductFundsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.DeductFundsConfirmed(encodeDeductFundsConfirmedPO(e)))
    case e: CreditBalanceEntity.ReleaseReservedFundsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.ReleaseReservedFundsConfirmed(encodeReleaseReservedFundsConfirmedPO(e)))
    case e: CreditBalanceEntity.RecordIncomingCreditsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.RecordIncomingCreditsConfirmed(encodeRecordIncomingCreditsConfirmedPO(e)))
    case e: CreditBalanceEntity.CommitIncomingCreditsConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.CommitIncomingCreditsConfirmed(encodeCommitIncomingCreditsConfirmedPO(e)))
    case e: CreditBalanceEntity.CancelIncomingCreditConfirmed => pb.CreditBalanceEventPO(pb.CreditBalanceEventPO.Event.CancelIncomingCreditConfirmed(encodeCancelIncomingCreditConfirmedPO(e)))
  }
  def decodeCreditBalanceEventPO(value: pb.CreditBalanceEventPO): CreditBalanceEntity.Event = value.event match {
    case pb.CreditBalanceEventPO.Event.AccountInitialized(e) => decodeAccountInitializedPO(e)
    case pb.CreditBalanceEventPO.Event.ReserveFundsConfirmed(e) => decodeReserveFundsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.DeductFundsConfirmed(e) => decodeDeductFundsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.ReleaseReservedFundsConfirmed(e) => decodeReleaseReservedFundsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.RecordIncomingCreditsConfirmed(e) => decodeRecordIncomingCreditsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.CommitIncomingCreditsConfirmed(e) => decodeCommitIncomingCreditsConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.CancelIncomingCreditConfirmed(e) => decodeCancelIncomingCreditConfirmedPO(e)
    case pb.CreditBalanceEventPO.Event.Empty => throw new IllegalArgumentException("empty CreditBalanceEventPO event")
  }

}
