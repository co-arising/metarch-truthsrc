package example.bankwealth.infrastructure.serialization

import example.bankwealth.domain._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.proto._
trait DomainConvertersPart0 { self: DomainConverters.type =>
  def encodeAccountIdPB(value: AccountId): AccountIdPB = AccountIdPB(value.value)
  def decodeAccountIdPB(value: AccountIdPB): AccountId = AccountId(value.f0)
  def encodeFundOrderIdPB(value: FundOrderId): FundOrderIdPB = FundOrderIdPB(value.value)
  def decodeFundOrderIdPB(value: FundOrderIdPB): FundOrderId = FundOrderId(value.f0)
  def encodeOperationIdPB(value: OperationId): OperationIdPB = OperationIdPB(value.value)
  def decodeOperationIdPB(value: OperationIdPB): OperationId = OperationId(value.f0)
  def encodeTxIdPB(value: TxId): TxIdPB = TxIdPB(value.value)
  def decodeTxIdPB(value: TxIdPB): TxId = TxId(value.f0)
  def encodePlanIdPB(value: PlanId): PlanIdPB = PlanIdPB(value.value)
  def decodePlanIdPB(value: PlanIdPB): PlanId = PlanId(value.f0)
  def encodeRevisionIdPB(value: RevisionId): RevisionIdPB = RevisionIdPB(value.value)
  def decodeRevisionIdPB(value: RevisionIdPB): RevisionId = RevisionId(value.f0)
  def encodeOccurrenceIdPB(value: OccurrenceId): OccurrenceIdPB = OccurrenceIdPB(value.value)
  def decodeOccurrenceIdPB(value: OccurrenceIdPB): OccurrenceId = OccurrenceId(value.f0)
  def encodeTaExactTextPB(value: TaExactText): TaExactTextPB = TaExactTextPB(value.value)
  def decodeTaExactTextPB(value: TaExactTextPB): TaExactText = TaExactText(value.f0)
  def AmountDecimalToWire(value: AmountDecimal): AmountDecimalWire = { val encoded = encodeAmountDecimalPB(value); AmountDecimalWire(encoded.f0) }
  def AmountDecimalFromWire(value: AmountDecimalWire): AmountDecimal = decodeAmountDecimalPB(AmountDecimalPB(value.value))
  def AmountDecimalToPO(value: AmountDecimal): AmountDecimalPO = { val encoded = encodeAmountDecimalPB(value); AmountDecimalPO(encoded.f0) }
  def AmountDecimalFromPO(value: AmountDecimalPO): AmountDecimal = decodeAmountDecimalPB(AmountDecimalPB(value.value))
  def encodeAmountDecimalPB(value: AmountDecimal): AmountDecimalPB = AmountDecimalPB(value.value.bigDecimal.setScale(2, java.math.RoundingMode.UNNECESSARY).unscaledValue.toString)
  def decodeAmountDecimalPB(value: AmountDecimalPB): AmountDecimal = AmountDecimal(readExact(value.f0, 2, true))
  def encodeAmountDecimalWirePB(value: AmountDecimalWire): AmountDecimalWirePB = AmountDecimalWirePB(value.value)
  def decodeAmountDecimalWirePB(value: AmountDecimalWirePB): AmountDecimalWire = AmountDecimalWire(value.f0)
  def encodeAmountDecimalPOPB(value: AmountDecimalPO): AmountDecimalPOPB = AmountDecimalPOPB(value.value)
  def decodeAmountDecimalPOPB(value: AmountDecimalPOPB): AmountDecimalPO = AmountDecimalPO(value.f0)
  def MoneyToWire(value: Money): MoneyWire = { val encoded = encodeMoneyPB(value); MoneyWire(encoded.f0, encoded.f1) }
  def MoneyFromWire(value: MoneyWire): Money = decodeMoneyPB(MoneyPB(value.minorUnits, value.currency))
  def MoneyToPO(value: Money): MoneyPO = { val encoded = encodeMoneyPB(value); MoneyPO(encoded.f0, encoded.f1) }
  def MoneyFromPO(value: MoneyPO): Money = decodeMoneyPB(MoneyPB(value.minorUnits, value.currency))
  def encodeMoneyPB(value: Money): MoneyPB = MoneyPB(value.amount.bigDecimal.setScale(2, java.math.RoundingMode.UNNECESSARY).unscaledValue.toString, value.currency)
  def decodeMoneyPB(value: MoneyPB): Money = Money(readExact(value.f0, 2, true), value.f1)
  def encodeMoneyWirePB(value: MoneyWire): MoneyWirePB = MoneyWirePB(value.minorUnits, value.currency)
  def decodeMoneyWirePB(value: MoneyWirePB): MoneyWire = MoneyWire(value.f0, value.f1)
  def encodeMoneyPOPB(value: MoneyPO): MoneyPOPB = MoneyPOPB(value.minorUnits, value.currency)
  def decodeMoneyPOPB(value: MoneyPOPB): MoneyPO = MoneyPO(value.f0, value.f1)
  def encodeFundSharePB(value: FundShare): FundSharePB = FundSharePB(value.fundCode, Some(encodeTaExactTextPB(value.shares)), Some(encodeTaExactTextPB(value.nav)))
  def decodeFundSharePB(value: FundSharePB): FundShare = FundShare(value.f0, decodeTaExactTextPB(req(value.f1)), decodeTaExactTextPB(req(value.f2)))
  def encodeTaRequestIdPB(value: TaRequestId): TaRequestIdPB = TaRequestIdPB(value.value)
  def decodeTaRequestIdPB(value: TaRequestIdPB): TaRequestId = TaRequestId(value.f0)
  def encodeSipRevisionConfigPB(value: SipRevisionConfig): SipRevisionConfigPB = SipRevisionConfigPB(
    Some(encodeRevisionIdPB(value.revision)),
    value.effectiveSlot,
    Some(encodeAccountIdPB(value.investorAccountId)),
    Some(encodeAccountIdPB(value.fundCollectionAccountId)),
    value.fundCode,
    Some(encodeMoneyPB(value.amount))
  )
  def decodeSipRevisionConfigPB(value: SipRevisionConfigPB): SipRevisionConfig = SipRevisionConfig(
    decodeRevisionIdPB(req(value.f0)),
    value.f1,
    decodeAccountIdPB(req(value.f2)),
    decodeAccountIdPB(req(value.f3)),
    value.f4,
    decodeMoneyPB(req(value.f5))
  )
  def encodeSipOccurrencePB(value: SipOccurrence): SipOccurrencePB = SipOccurrencePB(
    Some(encodePlanIdPB(value.planId)),
    Some(encodeRevisionIdPB(value.revision)),
    value.dueSlot,
    Some(encodeOccurrenceIdPB(value.occurrenceId)),
    Some(encodeOperationIdPB(value.operationId)),
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeSipRevisionConfigPB(value.config))
  )
  def decodeSipOccurrencePB(value: SipOccurrencePB): SipOccurrence = SipOccurrence(
    decodePlanIdPB(req(value.f0)),
    decodeRevisionIdPB(req(value.f1)),
    value.f2,
    decodeOccurrenceIdPB(req(value.f3)),
    decodeOperationIdPB(req(value.f4)),
    decodeFundOrderIdPB(req(value.f5)),
    decodeSipRevisionConfigPB(req(value.f6))
  )
  def encodeTaReceiptPB(value: TaReceipt): TaReceiptPB = TaReceiptPB(
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
  def decodeTaReceiptPB(value: TaReceiptPB): TaReceipt = TaReceipt(
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
  def encodeBankPaymentOriginalPB(value: BankPaymentOriginal): BankPaymentOriginalPB = BankPaymentOriginalPB(
    Some(encodeOperationIdPB(value.operationId)),
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeAccountIdPB(value.investorAccountId)),
    Some(encodeAccountIdPB(value.fundCollectionAccountId)),
    value.fundCode,
    Some(encodeMoneyPB(value.amount))
  )
  def decodeBankPaymentOriginalPB(value: BankPaymentOriginalPB): BankPaymentOriginal = BankPaymentOriginal(
    decodeOperationIdPB(req(value.f0)),
    decodeFundOrderIdPB(req(value.f1)),
    decodeAccountIdPB(req(value.f2)),
    decodeAccountIdPB(req(value.f3)),
    value.f4,
    decodeMoneyPB(req(value.f5))
  )
  def encodeBankPaymentArgsPB(value: BankPaymentArgs): BankPaymentArgsPB = BankPaymentArgsPB(
    Some(encodeAccountIdPB(value.investorAccountId)),
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeAccountIdPB(value.fundCollectionAccountId)),
    Some(encodeMoneyPB(value.amount))
  )
  def decodeBankPaymentArgsPB(value: BankPaymentArgsPB): BankPaymentArgs = BankPaymentArgs(
    decodeAccountIdPB(req(value.f0)),
    decodeFundOrderIdPB(req(value.f1)),
    decodeAccountIdPB(req(value.f2)),
    decodeMoneyPB(req(value.f3))
  )
  def encodeReserveInvestorFundsPrepareInputPB(value: ReserveInvestorFundsPrepareInput): ReserveInvestorFundsPrepareInputPB = ReserveInvestorFundsPrepareInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeReserveInvestorFundsPrepareInputPB(value: ReserveInvestorFundsPrepareInputPB): ReserveInvestorFundsPrepareInput = ReserveInvestorFundsPrepareInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeReserveInvestorFundsPrepareReceiptPB(value: ReserveInvestorFundsPrepareReceipt): ReserveInvestorFundsPrepareReceiptPB = ReserveInvestorFundsPrepareReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount)),
    value.payloadCurrency,
    Some(encodeMoneyPB(value.payloadAvailable))
  )
  def decodeReserveInvestorFundsPrepareReceiptPB(value: ReserveInvestorFundsPrepareReceiptPB): ReserveInvestorFundsPrepareReceipt = ReserveInvestorFundsPrepareReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9)),
    value.f10,
    decodeMoneyPB(req(value.f11))
  )
  def encodeReserveInvestorFundsPrepareQueryPB(value: ReserveInvestorFundsPrepareQuery): ReserveInvestorFundsPrepareQueryPB = ReserveInvestorFundsPrepareQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeReserveInvestorFundsPrepareQueryPB(value: ReserveInvestorFundsPrepareQueryPB): ReserveInvestorFundsPrepareQuery = ReserveInvestorFundsPrepareQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeReserveInvestorFundsCommitInputPB(value: ReserveInvestorFundsCommitInput): ReserveInvestorFundsCommitInputPB = ReserveInvestorFundsCommitInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeReserveInvestorFundsCommitInputPB(value: ReserveInvestorFundsCommitInputPB): ReserveInvestorFundsCommitInput = ReserveInvestorFundsCommitInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeReserveInvestorFundsCommitReceiptPB(value: ReserveInvestorFundsCommitReceipt): ReserveInvestorFundsCommitReceiptPB = ReserveInvestorFundsCommitReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount))
  )
  def decodeReserveInvestorFundsCommitReceiptPB(value: ReserveInvestorFundsCommitReceiptPB): ReserveInvestorFundsCommitReceipt = ReserveInvestorFundsCommitReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9))
  )
  def encodeReserveInvestorFundsCommitQueryPB(value: ReserveInvestorFundsCommitQuery): ReserveInvestorFundsCommitQueryPB = ReserveInvestorFundsCommitQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeReserveInvestorFundsCommitQueryPB(value: ReserveInvestorFundsCommitQueryPB): ReserveInvestorFundsCommitQuery = ReserveInvestorFundsCommitQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeReserveInvestorFundsCompensateInputPB(value: ReserveInvestorFundsCompensateInput): ReserveInvestorFundsCompensateInputPB = ReserveInvestorFundsCompensateInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeReserveInvestorFundsCompensateInputPB(value: ReserveInvestorFundsCompensateInputPB): ReserveInvestorFundsCompensateInput = ReserveInvestorFundsCompensateInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeReserveInvestorFundsCompensateReceiptPB(value: ReserveInvestorFundsCompensateReceipt): ReserveInvestorFundsCompensateReceiptPB = ReserveInvestorFundsCompensateReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount)),
    value.payloadCurrency,
    Some(encodeMoneyPB(value.payloadAvailable))
  )
  def decodeReserveInvestorFundsCompensateReceiptPB(value: ReserveInvestorFundsCompensateReceiptPB): ReserveInvestorFundsCompensateReceipt = ReserveInvestorFundsCompensateReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9)),
    value.f10,
    decodeMoneyPB(req(value.f11))
  )
  def encodeReserveInvestorFundsCompensateQueryPB(value: ReserveInvestorFundsCompensateQuery): ReserveInvestorFundsCompensateQueryPB = ReserveInvestorFundsCompensateQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeReserveInvestorFundsCompensateQueryPB(value: ReserveInvestorFundsCompensateQueryPB): ReserveInvestorFundsCompensateQuery = ReserveInvestorFundsCompensateQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeCreditFundCollectionPrepareInputPB(value: CreditFundCollectionPrepareInput): CreditFundCollectionPrepareInputPB = CreditFundCollectionPrepareInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeCreditFundCollectionPrepareInputPB(value: CreditFundCollectionPrepareInputPB): CreditFundCollectionPrepareInput = CreditFundCollectionPrepareInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeCreditFundCollectionPrepareReceiptPB(value: CreditFundCollectionPrepareReceipt): CreditFundCollectionPrepareReceiptPB = CreditFundCollectionPrepareReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount))
  )
  def decodeCreditFundCollectionPrepareReceiptPB(value: CreditFundCollectionPrepareReceiptPB): CreditFundCollectionPrepareReceipt = CreditFundCollectionPrepareReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9))
  )
  def encodeCreditFundCollectionPrepareQueryPB(value: CreditFundCollectionPrepareQuery): CreditFundCollectionPrepareQueryPB = CreditFundCollectionPrepareQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeCreditFundCollectionPrepareQueryPB(value: CreditFundCollectionPrepareQueryPB): CreditFundCollectionPrepareQuery = CreditFundCollectionPrepareQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeCreditFundCollectionCommitInputPB(value: CreditFundCollectionCommitInput): CreditFundCollectionCommitInputPB = CreditFundCollectionCommitInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeCreditFundCollectionCommitInputPB(value: CreditFundCollectionCommitInputPB): CreditFundCollectionCommitInput = CreditFundCollectionCommitInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeCreditFundCollectionCommitReceiptPB(value: CreditFundCollectionCommitReceipt): CreditFundCollectionCommitReceiptPB = CreditFundCollectionCommitReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount)),
    value.payloadCurrency,
    Some(encodeMoneyPB(value.payloadAvailable))
  )
  def decodeCreditFundCollectionCommitReceiptPB(value: CreditFundCollectionCommitReceiptPB): CreditFundCollectionCommitReceipt = CreditFundCollectionCommitReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9)),
    value.f10,
    decodeMoneyPB(req(value.f11))
  )
  def encodeCreditFundCollectionCommitQueryPB(value: CreditFundCollectionCommitQuery): CreditFundCollectionCommitQueryPB = CreditFundCollectionCommitQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeCreditFundCollectionCommitQueryPB(value: CreditFundCollectionCommitQueryPB): CreditFundCollectionCommitQuery = CreditFundCollectionCommitQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeCreditFundCollectionCompensateInputPB(value: CreditFundCollectionCompensateInput): CreditFundCollectionCompensateInputPB = CreditFundCollectionCompensateInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeCreditFundCollectionCompensateInputPB(value: CreditFundCollectionCompensateInputPB): CreditFundCollectionCompensateInput = CreditFundCollectionCompensateInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeCreditFundCollectionCompensateReceiptPB(value: CreditFundCollectionCompensateReceipt): CreditFundCollectionCompensateReceiptPB = CreditFundCollectionCompensateReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount))
  )
  def decodeCreditFundCollectionCompensateReceiptPB(value: CreditFundCollectionCompensateReceiptPB): CreditFundCollectionCompensateReceipt = CreditFundCollectionCompensateReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9))
  )
  def encodeCreditFundCollectionCompensateQueryPB(value: CreditFundCollectionCompensateQuery): CreditFundCollectionCompensateQueryPB = CreditFundCollectionCompensateQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeCreditFundCollectionCompensateQueryPB(value: CreditFundCollectionCompensateQueryPB): CreditFundCollectionCompensateQuery = CreditFundCollectionCompensateQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeReserveCashFundOrderPrepareInputPB(value: ReserveCashFundOrderPrepareInput): ReserveCashFundOrderPrepareInputPB = ReserveCashFundOrderPrepareInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeFundOrderIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeReserveCashFundOrderPrepareInputPB(value: ReserveCashFundOrderPrepareInputPB): ReserveCashFundOrderPrepareInput = ReserveCashFundOrderPrepareInput(decodeTxIdPB(req(value.f0)), decodeFundOrderIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeReserveCashFundOrderPrepareReceiptPB(value: ReserveCashFundOrderPrepareReceipt): ReserveCashFundOrderPrepareReceiptPB = ReserveCashFundOrderPrepareReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeFundOrderIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeFundOrderIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount))
  )
  def decodeReserveCashFundOrderPrepareReceiptPB(value: ReserveCashFundOrderPrepareReceiptPB): ReserveCashFundOrderPrepareReceipt = ReserveCashFundOrderPrepareReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeFundOrderIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeFundOrderIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9))
  )
  def encodeReserveCashFundOrderPrepareQueryPB(value: ReserveCashFundOrderPrepareQuery): ReserveCashFundOrderPrepareQueryPB = ReserveCashFundOrderPrepareQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeFundOrderIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeReserveCashFundOrderPrepareQueryPB(value: ReserveCashFundOrderPrepareQueryPB): ReserveCashFundOrderPrepareQuery = ReserveCashFundOrderPrepareQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeFundOrderIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeReserveCashFundOrderCommitInputPB(value: ReserveCashFundOrderCommitInput): ReserveCashFundOrderCommitInputPB = ReserveCashFundOrderCommitInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeFundOrderIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeReserveCashFundOrderCommitInputPB(value: ReserveCashFundOrderCommitInputPB): ReserveCashFundOrderCommitInput = ReserveCashFundOrderCommitInput(decodeTxIdPB(req(value.f0)), decodeFundOrderIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeReserveCashFundOrderCommitReceiptPB(value: ReserveCashFundOrderCommitReceipt): ReserveCashFundOrderCommitReceiptPB = ReserveCashFundOrderCommitReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeFundOrderIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeFundOrderIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount))
  )
  def decodeReserveCashFundOrderCommitReceiptPB(value: ReserveCashFundOrderCommitReceiptPB): ReserveCashFundOrderCommitReceipt = ReserveCashFundOrderCommitReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeFundOrderIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeFundOrderIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9))
  )
  def encodeReserveCashFundOrderCommitQueryPB(value: ReserveCashFundOrderCommitQuery): ReserveCashFundOrderCommitQueryPB = ReserveCashFundOrderCommitQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeFundOrderIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeReserveCashFundOrderCommitQueryPB(value: ReserveCashFundOrderCommitQueryPB): ReserveCashFundOrderCommitQuery = ReserveCashFundOrderCommitQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeFundOrderIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeReserveCashFundOrderCompensateInputPB(value: ReserveCashFundOrderCompensateInput): ReserveCashFundOrderCompensateInputPB = ReserveCashFundOrderCompensateInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeFundOrderIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeReserveCashFundOrderCompensateInputPB(value: ReserveCashFundOrderCompensateInputPB): ReserveCashFundOrderCompensateInput = ReserveCashFundOrderCompensateInput(decodeTxIdPB(req(value.f0)), decodeFundOrderIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeReserveCashFundOrderCompensateReceiptPB(value: ReserveCashFundOrderCompensateReceipt): ReserveCashFundOrderCompensateReceiptPB = ReserveCashFundOrderCompensateReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeFundOrderIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeFundOrderIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount))
  )
  def decodeReserveCashFundOrderCompensateReceiptPB(value: ReserveCashFundOrderCompensateReceiptPB): ReserveCashFundOrderCompensateReceipt = ReserveCashFundOrderCompensateReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeFundOrderIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeFundOrderIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9))
  )
  def encodeReserveCashFundOrderCompensateQueryPB(value: ReserveCashFundOrderCompensateQuery): ReserveCashFundOrderCompensateQueryPB = ReserveCashFundOrderCompensateQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeFundOrderIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeReserveCashFundOrderCompensateQueryPB(value: ReserveCashFundOrderCompensateQueryPB): ReserveCashFundOrderCompensateQuery = ReserveCashFundOrderCompensateQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeFundOrderIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeBankPaymentResultPB(value: BankPaymentResult): BankPaymentResultPB = BankPaymentResultPB(Some(encodeTxIdPB(value.txid)))
  def decodeBankPaymentResultPB(value: BankPaymentResultPB): BankPaymentResult = BankPaymentResult(decodeTxIdPB(req(value.f0)))
  def encodeBankRefundOriginalPB(value: BankRefundOriginal): BankRefundOriginalPB = BankRefundOriginalPB(
    Some(encodeFundOrderIdPB(value.fundOrderId)),
    Some(encodeTxIdPB(value.paymentTxId)),
    Some(encodeAccountIdPB(value.investorAccountId)),
    Some(encodeAccountIdPB(value.fundCollectionAccountId)),
    Some(encodeMoneyPB(value.amount)),
    Some(encodeOperationIdPB(value.refundOperationId))
  )
  def decodeBankRefundOriginalPB(value: BankRefundOriginalPB): BankRefundOriginal = BankRefundOriginal(
    decodeFundOrderIdPB(req(value.f0)),
    decodeTxIdPB(req(value.f1)),
    decodeAccountIdPB(req(value.f2)),
    decodeAccountIdPB(req(value.f3)),
    decodeMoneyPB(req(value.f4)),
    decodeOperationIdPB(req(value.f5))
  )
  def encodeBankRefundArgsPB(value: BankRefundArgs): BankRefundArgsPB = BankRefundArgsPB(Some(encodeAccountIdPB(value.fundCollectionAccountId)), Some(encodeAccountIdPB(value.investorAccountId)), Some(encodeMoneyPB(value.amount)))
  def decodeBankRefundArgsPB(value: BankRefundArgsPB): BankRefundArgs = BankRefundArgs(decodeAccountIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeDebitFundCollectionPrepareInputPB(value: DebitFundCollectionPrepareInput): DebitFundCollectionPrepareInputPB = DebitFundCollectionPrepareInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeDebitFundCollectionPrepareInputPB(value: DebitFundCollectionPrepareInputPB): DebitFundCollectionPrepareInput = DebitFundCollectionPrepareInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeDebitFundCollectionPrepareReceiptPB(value: DebitFundCollectionPrepareReceipt): DebitFundCollectionPrepareReceiptPB = DebitFundCollectionPrepareReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount)),
    value.payloadCurrency,
    Some(encodeMoneyPB(value.payloadAvailable))
  )
  def decodeDebitFundCollectionPrepareReceiptPB(value: DebitFundCollectionPrepareReceiptPB): DebitFundCollectionPrepareReceipt = DebitFundCollectionPrepareReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9)),
    value.f10,
    decodeMoneyPB(req(value.f11))
  )
  def encodeDebitFundCollectionPrepareQueryPB(value: DebitFundCollectionPrepareQuery): DebitFundCollectionPrepareQueryPB = DebitFundCollectionPrepareQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeDebitFundCollectionPrepareQueryPB(value: DebitFundCollectionPrepareQueryPB): DebitFundCollectionPrepareQuery = DebitFundCollectionPrepareQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeDebitFundCollectionCommitInputPB(value: DebitFundCollectionCommitInput): DebitFundCollectionCommitInputPB = DebitFundCollectionCommitInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeDebitFundCollectionCommitInputPB(value: DebitFundCollectionCommitInputPB): DebitFundCollectionCommitInput = DebitFundCollectionCommitInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeDebitFundCollectionCommitReceiptPB(value: DebitFundCollectionCommitReceipt): DebitFundCollectionCommitReceiptPB = DebitFundCollectionCommitReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount))
  )
  def decodeDebitFundCollectionCommitReceiptPB(value: DebitFundCollectionCommitReceiptPB): DebitFundCollectionCommitReceipt = DebitFundCollectionCommitReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9))
  )
  def encodeDebitFundCollectionCommitQueryPB(value: DebitFundCollectionCommitQuery): DebitFundCollectionCommitQueryPB = DebitFundCollectionCommitQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeDebitFundCollectionCommitQueryPB(value: DebitFundCollectionCommitQueryPB): DebitFundCollectionCommitQuery = DebitFundCollectionCommitQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeDebitFundCollectionCompensateInputPB(value: DebitFundCollectionCompensateInput): DebitFundCollectionCompensateInputPB = DebitFundCollectionCompensateInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeDebitFundCollectionCompensateInputPB(value: DebitFundCollectionCompensateInputPB): DebitFundCollectionCompensateInput = DebitFundCollectionCompensateInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeDebitFundCollectionCompensateReceiptPB(value: DebitFundCollectionCompensateReceipt): DebitFundCollectionCompensateReceiptPB = DebitFundCollectionCompensateReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount)),
    value.payloadCurrency,
    Some(encodeMoneyPB(value.payloadAvailable))
  )
  def decodeDebitFundCollectionCompensateReceiptPB(value: DebitFundCollectionCompensateReceiptPB): DebitFundCollectionCompensateReceipt = DebitFundCollectionCompensateReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9)),
    value.f10,
    decodeMoneyPB(req(value.f11))
  )
  def encodeDebitFundCollectionCompensateQueryPB(value: DebitFundCollectionCompensateQuery): DebitFundCollectionCompensateQueryPB = DebitFundCollectionCompensateQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeDebitFundCollectionCompensateQueryPB(value: DebitFundCollectionCompensateQueryPB): DebitFundCollectionCompensateQuery = DebitFundCollectionCompensateQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeCreditOriginalInvestorPrepareInputPB(value: CreditOriginalInvestorPrepareInput): CreditOriginalInvestorPrepareInputPB = CreditOriginalInvestorPrepareInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeCreditOriginalInvestorPrepareInputPB(value: CreditOriginalInvestorPrepareInputPB): CreditOriginalInvestorPrepareInput = CreditOriginalInvestorPrepareInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeCreditOriginalInvestorPrepareReceiptPB(value: CreditOriginalInvestorPrepareReceipt): CreditOriginalInvestorPrepareReceiptPB = CreditOriginalInvestorPrepareReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount))
  )
  def decodeCreditOriginalInvestorPrepareReceiptPB(value: CreditOriginalInvestorPrepareReceiptPB): CreditOriginalInvestorPrepareReceipt = CreditOriginalInvestorPrepareReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9))
  )
  def encodeCreditOriginalInvestorPrepareQueryPB(value: CreditOriginalInvestorPrepareQuery): CreditOriginalInvestorPrepareQueryPB = CreditOriginalInvestorPrepareQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeCreditOriginalInvestorPrepareQueryPB(value: CreditOriginalInvestorPrepareQueryPB): CreditOriginalInvestorPrepareQuery = CreditOriginalInvestorPrepareQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeCreditOriginalInvestorCommitInputPB(value: CreditOriginalInvestorCommitInput): CreditOriginalInvestorCommitInputPB = CreditOriginalInvestorCommitInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeCreditOriginalInvestorCommitInputPB(value: CreditOriginalInvestorCommitInputPB): CreditOriginalInvestorCommitInput = CreditOriginalInvestorCommitInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeCreditOriginalInvestorCommitReceiptPB(value: CreditOriginalInvestorCommitReceipt): CreditOriginalInvestorCommitReceiptPB = CreditOriginalInvestorCommitReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount)),
    value.payloadCurrency,
    Some(encodeMoneyPB(value.payloadAvailable))
  )
  def decodeCreditOriginalInvestorCommitReceiptPB(value: CreditOriginalInvestorCommitReceiptPB): CreditOriginalInvestorCommitReceipt = CreditOriginalInvestorCommitReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9)),
    value.f10,
    decodeMoneyPB(req(value.f11))
  )
  def encodeCreditOriginalInvestorCommitQueryPB(value: CreditOriginalInvestorCommitQuery): CreditOriginalInvestorCommitQueryPB = CreditOriginalInvestorCommitQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeCreditOriginalInvestorCommitQueryPB(value: CreditOriginalInvestorCommitQueryPB): CreditOriginalInvestorCommitQuery = CreditOriginalInvestorCommitQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeCreditOriginalInvestorCompensateInputPB(value: CreditOriginalInvestorCompensateInput): CreditOriginalInvestorCompensateInputPB = CreditOriginalInvestorCompensateInputPB(Some(encodeTxIdPB(value.txid)), Some(encodeAccountIdPB(value.resource)), Some(encodeMoneyPB(value.amount)))
  def decodeCreditOriginalInvestorCompensateInputPB(value: CreditOriginalInvestorCompensateInputPB): CreditOriginalInvestorCompensateInput = CreditOriginalInvestorCompensateInput(decodeTxIdPB(req(value.f0)), decodeAccountIdPB(req(value.f1)), decodeMoneyPB(req(value.f2)))
  def encodeCreditOriginalInvestorCompensateReceiptPB(value: CreditOriginalInvestorCompensateReceipt): CreditOriginalInvestorCompensateReceiptPB = CreditOriginalInvestorCompensateReceiptPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase,
    Some(encodeTxIdPB(value.payloadTxid)),
    Some(encodeAccountIdPB(value.payloadResource)),
    Some(encodeMoneyPB(value.payloadAmount))
  )
  def decodeCreditOriginalInvestorCompensateReceiptPB(value: CreditOriginalInvestorCompensateReceiptPB): CreditOriginalInvestorCompensateReceipt = CreditOriginalInvestorCompensateReceipt(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6,
    decodeTxIdPB(req(value.f7)),
    decodeAccountIdPB(req(value.f8)),
    decodeMoneyPB(req(value.f9))
  )
  def encodeCreditOriginalInvestorCompensateQueryPB(value: CreditOriginalInvestorCompensateQuery): CreditOriginalInvestorCompensateQueryPB = CreditOriginalInvestorCompensateQueryPB(
    Some(encodeTxIdPB(value.transaction)),
    value.definitionVersion,
    value.argsDigest,
    value.participant,
    Some(encodeAccountIdPB(value.resource)),
    value.step,
    value.phase
  )
  def decodeCreditOriginalInvestorCompensateQueryPB(value: CreditOriginalInvestorCompensateQueryPB): CreditOriginalInvestorCompensateQuery = CreditOriginalInvestorCompensateQuery(
    decodeTxIdPB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    decodeAccountIdPB(req(value.f4)),
    value.f5,
    value.f6
  )
  def encodeBankRefundResultPB(value: BankRefundResult): BankRefundResultPB = BankRefundResultPB(Some(encodeTxIdPB(value.txid)))
  def decodeBankRefundResultPB(value: BankRefundResultPB): BankRefundResult = BankRefundResult(decodeTxIdPB(req(value.f0)))
  def encodeBankTaEffectRequestPB(value: BankTaEffectRequest): BankTaEffectRequestPB = BankTaEffectRequestPB(Some(encodeTaRequestIdPB(value.taRequestId)), Some(encodeFundOrderIdPB(value.fundOrderId)), Some(encodeTxIdPB(value.paymentTxId)))
  def decodeBankTaEffectRequestPB(value: BankTaEffectRequestPB): BankTaEffectRequest = BankTaEffectRequest(decodeTaRequestIdPB(req(value.f0)), decodeFundOrderIdPB(req(value.f1)), decodeTxIdPB(req(value.f2)))
  def encodeBankTaEffectResultPB(value: BankTaEffectResult): BankTaEffectResultPB = BankTaEffectResultPB(Some(encodeTaRequestIdPB(value.taRequestId)))
  def decodeBankTaEffectResultPB(value: BankTaEffectResultPB): BankTaEffectResult = BankTaEffectResult(decodeTaRequestIdPB(req(value.f0)))
  def encodeBankTaEffectOperationPB(value: BankTaEffectOperation): BankTaEffectOperationPB = BankTaEffectOperationPB(value.operation, Some(encodeBankTaEffectRequestPB(value.request)))
  def decodeBankTaEffectOperationPB(value: BankTaEffectOperationPB): BankTaEffectOperation = BankTaEffectOperation(value.f0, decodeBankTaEffectRequestPB(req(value.f1)))
  def encodeBankTaEffectObservationPB(value: BankTaEffectObservation): BankTaEffectObservationPB = BankTaEffectObservationPB(
    value.operation,
    Some(encodeBankTaEffectRequestPB(value.request)),
    value.status,
    value.evidence,
    Some(encodeBankTaEffectObservationPBField4(value.result))
  )
  def decodeBankTaEffectObservationPB(value: BankTaEffectObservationPB): BankTaEffectObservation = BankTaEffectObservation(
    value.f0,
    decodeBankTaEffectRequestPB(req(value.f1)),
    value.f2,
    value.f3,
    decodeBankTaEffectObservationPBField4(req(value.f4))
  )
  def encodeBankTaEffectObservationPBField4(value: Option[BankTaEffectResult]): BankTaEffectObservationPBField4 = value match { case None => BankTaEffectObservationPBField4(present = false); case Some(item) => BankTaEffectObservationPBField4(present = true, f0 = Some(encodeBankTaEffectResultPB(item))) }
  def decodeBankTaEffectObservationPBField4(value: BankTaEffectObservationPBField4): Option[BankTaEffectResult] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankTaEffectResultPB(req(value.f0)))
  def encodeBankTaEffectReconcilePB(value: BankTaEffectReconcile): BankTaEffectReconcilePB = BankTaEffectReconcilePB(
    value.operation,
    Some(encodeBankTaEffectRequestPB(value.request)),
    value.decision,
    Some(encodeBankTaEffectReconcilePBField3(value.evidence)),
    value.authorization
  )
  def decodeBankTaEffectReconcilePB(value: BankTaEffectReconcilePB): BankTaEffectReconcile = BankTaEffectReconcile(
    value.f0,
    decodeBankTaEffectRequestPB(req(value.f1)),
    value.f2,
    decodeBankTaEffectReconcilePBField3(req(value.f3)),
    value.f4
  )
  def encodeBankTaEffectReconcilePBField3(value: Option[BankTaEffectObservation]): BankTaEffectReconcilePBField3 = value match { case None => BankTaEffectReconcilePBField3(present = false); case Some(item) => BankTaEffectReconcilePBField3(present = true, f0 = Some(encodeBankTaEffectObservationPB(item))) }
  def decodeBankTaEffectReconcilePBField3(value: BankTaEffectReconcilePBField3): Option[BankTaEffectObservation] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankTaEffectObservationPB(req(value.f0)))
  def encodeBankSipDispatchRequestPB(value: BankSipDispatchRequest): BankSipDispatchRequestPB = BankSipDispatchRequestPB(Some(encodeOccurrenceIdPB(value.occurrenceId)), Some(encodeSipOccurrencePB(value.occurrence)))
  def decodeBankSipDispatchRequestPB(value: BankSipDispatchRequestPB): BankSipDispatchRequest = BankSipDispatchRequest(decodeOccurrenceIdPB(req(value.f0)), decodeSipOccurrencePB(req(value.f1)))
  def encodeBankSipDispatchResultPB(value: BankSipDispatchResult): BankSipDispatchResultPB = BankSipDispatchResultPB(Some(encodeOperationIdPB(value.operationId)))
  def decodeBankSipDispatchResultPB(value: BankSipDispatchResultPB): BankSipDispatchResult = BankSipDispatchResult(decodeOperationIdPB(req(value.f0)))
  def encodeBankSipDispatchOperationPB(value: BankSipDispatchOperation): BankSipDispatchOperationPB = BankSipDispatchOperationPB(value.operation, Some(encodeBankSipDispatchRequestPB(value.request)))
  def decodeBankSipDispatchOperationPB(value: BankSipDispatchOperationPB): BankSipDispatchOperation = BankSipDispatchOperation(value.f0, decodeBankSipDispatchRequestPB(req(value.f1)))
  def encodeBankSipDispatchObservationPB(value: BankSipDispatchObservation): BankSipDispatchObservationPB = BankSipDispatchObservationPB(
    value.operation,
    Some(encodeBankSipDispatchRequestPB(value.request)),
    value.status,
    value.evidence,
    Some(encodeBankSipDispatchObservationPBField4(value.result))
  )
  def decodeBankSipDispatchObservationPB(value: BankSipDispatchObservationPB): BankSipDispatchObservation = BankSipDispatchObservation(
    value.f0,
    decodeBankSipDispatchRequestPB(req(value.f1)),
    value.f2,
    value.f3,
    decodeBankSipDispatchObservationPBField4(req(value.f4))
  )
  def encodeBankSipDispatchObservationPBField4(value: Option[BankSipDispatchResult]): BankSipDispatchObservationPBField4 = value match { case None => BankSipDispatchObservationPBField4(present = false); case Some(item) => BankSipDispatchObservationPBField4(present = true, f0 = Some(encodeBankSipDispatchResultPB(item))) }
  def decodeBankSipDispatchObservationPBField4(value: BankSipDispatchObservationPBField4): Option[BankSipDispatchResult] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankSipDispatchResultPB(req(value.f0)))
}
