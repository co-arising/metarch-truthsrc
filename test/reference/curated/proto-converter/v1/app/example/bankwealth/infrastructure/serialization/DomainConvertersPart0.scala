package example.bankwealth.infrastructure.serialization

import example.bankwealth.domain._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.{proto => pb}
trait DomainConvertersPart0 { self: DomainConverters.type =>
  def encodeAccountIdPO(value: AccountId): pb.AccountIdPO = pb.AccountIdPO(value = value.value)
  def decodeAccountIdPO(value: pb.AccountIdPO): AccountId = AccountId(value = value.value)

  def encodeFundOrderIdPO(value: FundOrderId): pb.FundOrderIdPO = pb.FundOrderIdPO(value = value.value)
  def decodeFundOrderIdPO(value: pb.FundOrderIdPO): FundOrderId = FundOrderId(value = value.value)

  def encodeOperationIdPO(value: OperationId): pb.OperationIdPO = pb.OperationIdPO(value = value.value)
  def decodeOperationIdPO(value: pb.OperationIdPO): OperationId = OperationId(value = value.value)

  def encodeTxIdPO(value: TxId): pb.TxIdPO = pb.TxIdPO(value = value.value)
  def decodeTxIdPO(value: pb.TxIdPO): TxId = TxId(value = value.value)

  def encodePlanIdPO(value: PlanId): pb.PlanIdPO = pb.PlanIdPO(value = value.value)
  def decodePlanIdPO(value: pb.PlanIdPO): PlanId = PlanId(value = value.value)

  def encodeRevisionIdPO(value: RevisionId): pb.RevisionIdPO = pb.RevisionIdPO(value = value.value)
  def decodeRevisionIdPO(value: pb.RevisionIdPO): RevisionId = RevisionId(value = value.value)

  def encodeOccurrenceIdPO(value: OccurrenceId): pb.OccurrenceIdPO = pb.OccurrenceIdPO(value = value.value)
  def decodeOccurrenceIdPO(value: pb.OccurrenceIdPO): OccurrenceId = OccurrenceId(value = value.value)

  def encodeTaExactTextPO(value: TaExactText): pb.TaExactTextPO = pb.TaExactTextPO(value = value.value)
  def decodeTaExactTextPO(value: pb.TaExactTextPO): TaExactText = TaExactText(value = value.value)

  def AmountDecimalToWire(value: AmountDecimal): AmountDecimalWire = { val encoded = encodeAmountDecimalPO(value); AmountDecimalWire(encoded.value) }
  def AmountDecimalFromWire(value: AmountDecimalWire): AmountDecimal = decodeAmountDecimalPO(pb.AmountDecimalPO(value = value.value))
  def AmountDecimalToPO(value: AmountDecimal): AmountDecimalPO = { val encoded = encodeAmountDecimalPO(value); AmountDecimalPO(encoded.value) }
  def AmountDecimalFromPO(value: AmountDecimalPO): AmountDecimal = decodeAmountDecimalPO(pb.AmountDecimalPO(value = value.value))
  def encodeAmountDecimalPO(value: AmountDecimal): pb.AmountDecimalPO = pb.AmountDecimalPO(value = value.value.bigDecimal.setScale(2, java.math.RoundingMode.UNNECESSARY).unscaledValue.toString)
  def decodeAmountDecimalPO(value: pb.AmountDecimalPO): AmountDecimal = AmountDecimal(readExact(value.value, 2, true))

  def encodeAmountDecimalWirePO(value: AmountDecimalWire): pb.AmountDecimalWirePO = pb.AmountDecimalWirePO(value = value.value)
  def decodeAmountDecimalWirePO(value: pb.AmountDecimalWirePO): AmountDecimalWire = AmountDecimalWire(value = value.value)

  def encodeAmountDecimalStoragePO(value: AmountDecimalPO): pb.AmountDecimalStoragePO = pb.AmountDecimalStoragePO(value = value.value)
  def decodeAmountDecimalStoragePO(value: pb.AmountDecimalStoragePO): AmountDecimalPO = AmountDecimalPO(value = value.value)

  def MoneyToWire(value: Money): MoneyWire = { val encoded = encodeMoneyPO(value); MoneyWire(encoded.amount, encoded.currency) }
  def MoneyFromWire(value: MoneyWire): Money = decodeMoneyPO(pb.MoneyPO(amount = value.minorUnits, currency = value.currency))
  def MoneyToPO(value: Money): MoneyPO = { val encoded = encodeMoneyPO(value); MoneyPO(encoded.amount, encoded.currency) }
  def MoneyFromPO(value: MoneyPO): Money = decodeMoneyPO(pb.MoneyPO(amount = value.minorUnits, currency = value.currency))
  def encodeMoneyPO(value: Money): pb.MoneyPO = pb.MoneyPO(amount = value.amount.bigDecimal.setScale(2, java.math.RoundingMode.UNNECESSARY).unscaledValue.toString, currency = value.currency)
  def decodeMoneyPO(value: pb.MoneyPO): Money = Money(readExact(value.amount, 2, true), value.currency)

  def encodeMoneyWirePO(value: MoneyWire): pb.MoneyWirePO = pb.MoneyWirePO(minorUnits = value.minorUnits, currency = value.currency)
  def decodeMoneyWirePO(value: pb.MoneyWirePO): MoneyWire = MoneyWire(minorUnits = value.minorUnits, currency = value.currency)

  def encodeMoneyStoragePO(value: MoneyPO): pb.MoneyStoragePO = pb.MoneyStoragePO(minorUnits = value.minorUnits, currency = value.currency)
  def decodeMoneyStoragePO(value: pb.MoneyStoragePO): MoneyPO = MoneyPO(minorUnits = value.minorUnits, currency = value.currency)

  def encodeFundSharePO(value: FundShare): pb.FundSharePO = pb.FundSharePO(fundCode = value.fundCode, shares = Some(encodeTaExactTextPO(value.shares)), nav = Some(encodeTaExactTextPO(value.nav)))
  def decodeFundSharePO(value: pb.FundSharePO): FundShare = FundShare(fundCode = value.fundCode, shares = decodeTaExactTextPO(req(value.shares)), nav = decodeTaExactTextPO(req(value.nav)))

  def encodeTaRequestIdPO(value: TaRequestId): pb.TaRequestIdPO = pb.TaRequestIdPO(value = value.value)
  def decodeTaRequestIdPO(value: pb.TaRequestIdPO): TaRequestId = TaRequestId(value = value.value)

  def encodeSipRevisionConfigPO(value: SipRevisionConfig): pb.SipRevisionConfigPO = pb.SipRevisionConfigPO(
    revision = Some(encodeRevisionIdPO(value.revision)),
    effectiveSlot = value.effectiveSlot,
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = Some(encodeMoneyPO(value.amount))
  )
  def decodeSipRevisionConfigPO(value: pb.SipRevisionConfigPO): SipRevisionConfig = SipRevisionConfig(
    revision = decodeRevisionIdPO(req(value.revision)),
    effectiveSlot = value.effectiveSlot,
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = decodeMoneyPO(req(value.amount))
  )

  def encodeSipOccurrencePO(value: SipOccurrence): pb.SipOccurrencePO = pb.SipOccurrencePO(
    planId = Some(encodePlanIdPO(value.planId)),
    revision = Some(encodeRevisionIdPO(value.revision)),
    dueSlot = value.dueSlot,
    occurrenceId = Some(encodeOccurrenceIdPO(value.occurrenceId)),
    operationId = Some(encodeOperationIdPO(value.operationId)),
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    config = Some(encodeSipRevisionConfigPO(value.config))
  )
  def decodeSipOccurrencePO(value: pb.SipOccurrencePO): SipOccurrence = SipOccurrence(
    planId = decodePlanIdPO(req(value.planId)),
    revision = decodeRevisionIdPO(req(value.revision)),
    dueSlot = value.dueSlot,
    occurrenceId = decodeOccurrenceIdPO(req(value.occurrenceId)),
    operationId = decodeOperationIdPO(req(value.operationId)),
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    config = decodeSipRevisionConfigPO(req(value.config))
  )

  def encodeTaReceiptPO(value: TaReceipt): pb.TaReceiptPO = pb.TaReceiptPO(
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
  def decodeTaReceiptPO(value: pb.TaReceiptPO): TaReceipt = TaReceipt(
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

  def encodeBankPaymentOriginalPO(value: BankPaymentOriginal): pb.BankPaymentOriginalPO = pb.BankPaymentOriginalPO(
    operationId = Some(encodeOperationIdPO(value.operationId)),
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = Some(encodeMoneyPO(value.amount))
  )
  def decodeBankPaymentOriginalPO(value: pb.BankPaymentOriginalPO): BankPaymentOriginal = BankPaymentOriginal(
    operationId = decodeOperationIdPO(req(value.operationId)),
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    fundCode = value.fundCode,
    amount = decodeMoneyPO(req(value.amount))
  )

  def encodeBankPaymentArgsPO(value: BankPaymentArgs): pb.BankPaymentArgsPO = pb.BankPaymentArgsPO(
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    amount = Some(encodeMoneyPO(value.amount))
  )
  def decodeBankPaymentArgsPO(value: pb.BankPaymentArgsPO): BankPaymentArgs = BankPaymentArgs(
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    amount = decodeMoneyPO(req(value.amount))
  )

  def encodeReserveInvestorFundsPrepareInputPO(value: ReserveInvestorFundsPrepareInput): pb.ReserveInvestorFundsPrepareInputPO = pb.ReserveInvestorFundsPrepareInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeReserveInvestorFundsPrepareInputPO(value: pb.ReserveInvestorFundsPrepareInputPO): ReserveInvestorFundsPrepareInput = ReserveInvestorFundsPrepareInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeReserveInvestorFundsPrepareReceiptPO(value: ReserveInvestorFundsPrepareReceipt): pb.ReserveInvestorFundsPrepareReceiptPO = pb.ReserveInvestorFundsPrepareReceiptPO(
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
  def decodeReserveInvestorFundsPrepareReceiptPO(value: pb.ReserveInvestorFundsPrepareReceiptPO): ReserveInvestorFundsPrepareReceipt = ReserveInvestorFundsPrepareReceipt(
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

  def encodeReserveInvestorFundsPrepareQueryPO(value: ReserveInvestorFundsPrepareQuery): pb.ReserveInvestorFundsPrepareQueryPO = pb.ReserveInvestorFundsPrepareQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeReserveInvestorFundsPrepareQueryPO(value: pb.ReserveInvestorFundsPrepareQueryPO): ReserveInvestorFundsPrepareQuery = ReserveInvestorFundsPrepareQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeReserveInvestorFundsCommitInputPO(value: ReserveInvestorFundsCommitInput): pb.ReserveInvestorFundsCommitInputPO = pb.ReserveInvestorFundsCommitInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeReserveInvestorFundsCommitInputPO(value: pb.ReserveInvestorFundsCommitInputPO): ReserveInvestorFundsCommitInput = ReserveInvestorFundsCommitInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeReserveInvestorFundsCommitReceiptPO(value: ReserveInvestorFundsCommitReceipt): pb.ReserveInvestorFundsCommitReceiptPO = pb.ReserveInvestorFundsCommitReceiptPO(
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
  def decodeReserveInvestorFundsCommitReceiptPO(value: pb.ReserveInvestorFundsCommitReceiptPO): ReserveInvestorFundsCommitReceipt = ReserveInvestorFundsCommitReceipt(
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

  def encodeReserveInvestorFundsCommitQueryPO(value: ReserveInvestorFundsCommitQuery): pb.ReserveInvestorFundsCommitQueryPO = pb.ReserveInvestorFundsCommitQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeReserveInvestorFundsCommitQueryPO(value: pb.ReserveInvestorFundsCommitQueryPO): ReserveInvestorFundsCommitQuery = ReserveInvestorFundsCommitQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeReserveInvestorFundsCompensateInputPO(value: ReserveInvestorFundsCompensateInput): pb.ReserveInvestorFundsCompensateInputPO = pb.ReserveInvestorFundsCompensateInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeReserveInvestorFundsCompensateInputPO(value: pb.ReserveInvestorFundsCompensateInputPO): ReserveInvestorFundsCompensateInput = ReserveInvestorFundsCompensateInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeReserveInvestorFundsCompensateReceiptPO(value: ReserveInvestorFundsCompensateReceipt): pb.ReserveInvestorFundsCompensateReceiptPO = pb.ReserveInvestorFundsCompensateReceiptPO(
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
  def decodeReserveInvestorFundsCompensateReceiptPO(value: pb.ReserveInvestorFundsCompensateReceiptPO): ReserveInvestorFundsCompensateReceipt = ReserveInvestorFundsCompensateReceipt(
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

  def encodeReserveInvestorFundsCompensateQueryPO(value: ReserveInvestorFundsCompensateQuery): pb.ReserveInvestorFundsCompensateQueryPO = pb.ReserveInvestorFundsCompensateQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeReserveInvestorFundsCompensateQueryPO(value: pb.ReserveInvestorFundsCompensateQueryPO): ReserveInvestorFundsCompensateQuery = ReserveInvestorFundsCompensateQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeCreditFundCollectionPrepareInputPO(value: CreditFundCollectionPrepareInput): pb.CreditFundCollectionPrepareInputPO = pb.CreditFundCollectionPrepareInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCreditFundCollectionPrepareInputPO(value: pb.CreditFundCollectionPrepareInputPO): CreditFundCollectionPrepareInput = CreditFundCollectionPrepareInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeCreditFundCollectionPrepareReceiptPO(value: CreditFundCollectionPrepareReceipt): pb.CreditFundCollectionPrepareReceiptPO = pb.CreditFundCollectionPrepareReceiptPO(
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
  def decodeCreditFundCollectionPrepareReceiptPO(value: pb.CreditFundCollectionPrepareReceiptPO): CreditFundCollectionPrepareReceipt = CreditFundCollectionPrepareReceipt(
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

  def encodeCreditFundCollectionPrepareQueryPO(value: CreditFundCollectionPrepareQuery): pb.CreditFundCollectionPrepareQueryPO = pb.CreditFundCollectionPrepareQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeCreditFundCollectionPrepareQueryPO(value: pb.CreditFundCollectionPrepareQueryPO): CreditFundCollectionPrepareQuery = CreditFundCollectionPrepareQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeCreditFundCollectionCommitInputPO(value: CreditFundCollectionCommitInput): pb.CreditFundCollectionCommitInputPO = pb.CreditFundCollectionCommitInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCreditFundCollectionCommitInputPO(value: pb.CreditFundCollectionCommitInputPO): CreditFundCollectionCommitInput = CreditFundCollectionCommitInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeCreditFundCollectionCommitReceiptPO(value: CreditFundCollectionCommitReceipt): pb.CreditFundCollectionCommitReceiptPO = pb.CreditFundCollectionCommitReceiptPO(
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
  def decodeCreditFundCollectionCommitReceiptPO(value: pb.CreditFundCollectionCommitReceiptPO): CreditFundCollectionCommitReceipt = CreditFundCollectionCommitReceipt(
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

  def encodeCreditFundCollectionCommitQueryPO(value: CreditFundCollectionCommitQuery): pb.CreditFundCollectionCommitQueryPO = pb.CreditFundCollectionCommitQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeCreditFundCollectionCommitQueryPO(value: pb.CreditFundCollectionCommitQueryPO): CreditFundCollectionCommitQuery = CreditFundCollectionCommitQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeCreditFundCollectionCompensateInputPO(value: CreditFundCollectionCompensateInput): pb.CreditFundCollectionCompensateInputPO = pb.CreditFundCollectionCompensateInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCreditFundCollectionCompensateInputPO(value: pb.CreditFundCollectionCompensateInputPO): CreditFundCollectionCompensateInput = CreditFundCollectionCompensateInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeCreditFundCollectionCompensateReceiptPO(value: CreditFundCollectionCompensateReceipt): pb.CreditFundCollectionCompensateReceiptPO = pb.CreditFundCollectionCompensateReceiptPO(
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
  def decodeCreditFundCollectionCompensateReceiptPO(value: pb.CreditFundCollectionCompensateReceiptPO): CreditFundCollectionCompensateReceipt = CreditFundCollectionCompensateReceipt(
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

  def encodeCreditFundCollectionCompensateQueryPO(value: CreditFundCollectionCompensateQuery): pb.CreditFundCollectionCompensateQueryPO = pb.CreditFundCollectionCompensateQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeCreditFundCollectionCompensateQueryPO(value: pb.CreditFundCollectionCompensateQueryPO): CreditFundCollectionCompensateQuery = CreditFundCollectionCompensateQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeReserveCashFundOrderPrepareInputPO(value: ReserveCashFundOrderPrepareInput): pb.ReserveCashFundOrderPrepareInputPO = pb.ReserveCashFundOrderPrepareInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeFundOrderIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeReserveCashFundOrderPrepareInputPO(value: pb.ReserveCashFundOrderPrepareInputPO): ReserveCashFundOrderPrepareInput = ReserveCashFundOrderPrepareInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeFundOrderIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeReserveCashFundOrderPrepareReceiptPO(value: ReserveCashFundOrderPrepareReceipt): pb.ReserveCashFundOrderPrepareReceiptPO = pb.ReserveCashFundOrderPrepareReceiptPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeFundOrderIdPO(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = Some(encodeTxIdPO(value.payloadTxid)),
    payloadResource = Some(encodeFundOrderIdPO(value.payloadResource)),
    payloadAmount = Some(encodeMoneyPO(value.payloadAmount))
  )
  def decodeReserveCashFundOrderPrepareReceiptPO(value: pb.ReserveCashFundOrderPrepareReceiptPO): ReserveCashFundOrderPrepareReceipt = ReserveCashFundOrderPrepareReceipt(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeFundOrderIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = decodeTxIdPO(req(value.payloadTxid)),
    payloadResource = decodeFundOrderIdPO(req(value.payloadResource)),
    payloadAmount = decodeMoneyPO(req(value.payloadAmount))
  )

  def encodeReserveCashFundOrderPrepareQueryPO(value: ReserveCashFundOrderPrepareQuery): pb.ReserveCashFundOrderPrepareQueryPO = pb.ReserveCashFundOrderPrepareQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeFundOrderIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeReserveCashFundOrderPrepareQueryPO(value: pb.ReserveCashFundOrderPrepareQueryPO): ReserveCashFundOrderPrepareQuery = ReserveCashFundOrderPrepareQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeFundOrderIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeReserveCashFundOrderCommitInputPO(value: ReserveCashFundOrderCommitInput): pb.ReserveCashFundOrderCommitInputPO = pb.ReserveCashFundOrderCommitInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeFundOrderIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeReserveCashFundOrderCommitInputPO(value: pb.ReserveCashFundOrderCommitInputPO): ReserveCashFundOrderCommitInput = ReserveCashFundOrderCommitInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeFundOrderIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeReserveCashFundOrderCommitReceiptPO(value: ReserveCashFundOrderCommitReceipt): pb.ReserveCashFundOrderCommitReceiptPO = pb.ReserveCashFundOrderCommitReceiptPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeFundOrderIdPO(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = Some(encodeTxIdPO(value.payloadTxid)),
    payloadResource = Some(encodeFundOrderIdPO(value.payloadResource)),
    payloadAmount = Some(encodeMoneyPO(value.payloadAmount))
  )
  def decodeReserveCashFundOrderCommitReceiptPO(value: pb.ReserveCashFundOrderCommitReceiptPO): ReserveCashFundOrderCommitReceipt = ReserveCashFundOrderCommitReceipt(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeFundOrderIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = decodeTxIdPO(req(value.payloadTxid)),
    payloadResource = decodeFundOrderIdPO(req(value.payloadResource)),
    payloadAmount = decodeMoneyPO(req(value.payloadAmount))
  )

  def encodeReserveCashFundOrderCommitQueryPO(value: ReserveCashFundOrderCommitQuery): pb.ReserveCashFundOrderCommitQueryPO = pb.ReserveCashFundOrderCommitQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeFundOrderIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeReserveCashFundOrderCommitQueryPO(value: pb.ReserveCashFundOrderCommitQueryPO): ReserveCashFundOrderCommitQuery = ReserveCashFundOrderCommitQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeFundOrderIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeReserveCashFundOrderCompensateInputPO(value: ReserveCashFundOrderCompensateInput): pb.ReserveCashFundOrderCompensateInputPO = pb.ReserveCashFundOrderCompensateInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeFundOrderIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeReserveCashFundOrderCompensateInputPO(value: pb.ReserveCashFundOrderCompensateInputPO): ReserveCashFundOrderCompensateInput = ReserveCashFundOrderCompensateInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeFundOrderIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeReserveCashFundOrderCompensateReceiptPO(value: ReserveCashFundOrderCompensateReceipt): pb.ReserveCashFundOrderCompensateReceiptPO = pb.ReserveCashFundOrderCompensateReceiptPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeFundOrderIdPO(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = Some(encodeTxIdPO(value.payloadTxid)),
    payloadResource = Some(encodeFundOrderIdPO(value.payloadResource)),
    payloadAmount = Some(encodeMoneyPO(value.payloadAmount))
  )
  def decodeReserveCashFundOrderCompensateReceiptPO(value: pb.ReserveCashFundOrderCompensateReceiptPO): ReserveCashFundOrderCompensateReceipt = ReserveCashFundOrderCompensateReceipt(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeFundOrderIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase,
    payloadTxid = decodeTxIdPO(req(value.payloadTxid)),
    payloadResource = decodeFundOrderIdPO(req(value.payloadResource)),
    payloadAmount = decodeMoneyPO(req(value.payloadAmount))
  )

  def encodeReserveCashFundOrderCompensateQueryPO(value: ReserveCashFundOrderCompensateQuery): pb.ReserveCashFundOrderCompensateQueryPO = pb.ReserveCashFundOrderCompensateQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeFundOrderIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeReserveCashFundOrderCompensateQueryPO(value: pb.ReserveCashFundOrderCompensateQueryPO): ReserveCashFundOrderCompensateQuery = ReserveCashFundOrderCompensateQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeFundOrderIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeBankPaymentResultPO(value: BankPaymentResult): pb.BankPaymentResultPO = pb.BankPaymentResultPO(txid = Some(encodeTxIdPO(value.txid)))
  def decodeBankPaymentResultPO(value: pb.BankPaymentResultPO): BankPaymentResult = BankPaymentResult(txid = decodeTxIdPO(req(value.txid)))

  def encodeBankRefundOriginalPO(value: BankRefundOriginal): pb.BankRefundOriginalPO = pb.BankRefundOriginalPO(
    fundOrderId = Some(encodeFundOrderIdPO(value.fundOrderId)),
    paymentTxId = Some(encodeTxIdPO(value.paymentTxId)),
    investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)),
    fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)),
    amount = Some(encodeMoneyPO(value.amount)),
    refundOperationId = Some(encodeOperationIdPO(value.refundOperationId))
  )
  def decodeBankRefundOriginalPO(value: pb.BankRefundOriginalPO): BankRefundOriginal = BankRefundOriginal(
    fundOrderId = decodeFundOrderIdPO(req(value.fundOrderId)),
    paymentTxId = decodeTxIdPO(req(value.paymentTxId)),
    investorAccountId = decodeAccountIdPO(req(value.investorAccountId)),
    fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)),
    amount = decodeMoneyPO(req(value.amount)),
    refundOperationId = decodeOperationIdPO(req(value.refundOperationId))
  )

  def encodeBankRefundArgsPO(value: BankRefundArgs): pb.BankRefundArgsPO = pb.BankRefundArgsPO(fundCollectionAccountId = Some(encodeAccountIdPO(value.fundCollectionAccountId)), investorAccountId = Some(encodeAccountIdPO(value.investorAccountId)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeBankRefundArgsPO(value: pb.BankRefundArgsPO): BankRefundArgs = BankRefundArgs(fundCollectionAccountId = decodeAccountIdPO(req(value.fundCollectionAccountId)), investorAccountId = decodeAccountIdPO(req(value.investorAccountId)), amount = decodeMoneyPO(req(value.amount)))

  def encodeDebitFundCollectionPrepareInputPO(value: DebitFundCollectionPrepareInput): pb.DebitFundCollectionPrepareInputPO = pb.DebitFundCollectionPrepareInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeDebitFundCollectionPrepareInputPO(value: pb.DebitFundCollectionPrepareInputPO): DebitFundCollectionPrepareInput = DebitFundCollectionPrepareInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeDebitFundCollectionPrepareReceiptPO(value: DebitFundCollectionPrepareReceipt): pb.DebitFundCollectionPrepareReceiptPO = pb.DebitFundCollectionPrepareReceiptPO(
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
  def decodeDebitFundCollectionPrepareReceiptPO(value: pb.DebitFundCollectionPrepareReceiptPO): DebitFundCollectionPrepareReceipt = DebitFundCollectionPrepareReceipt(
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

  def encodeDebitFundCollectionPrepareQueryPO(value: DebitFundCollectionPrepareQuery): pb.DebitFundCollectionPrepareQueryPO = pb.DebitFundCollectionPrepareQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeDebitFundCollectionPrepareQueryPO(value: pb.DebitFundCollectionPrepareQueryPO): DebitFundCollectionPrepareQuery = DebitFundCollectionPrepareQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeDebitFundCollectionCommitInputPO(value: DebitFundCollectionCommitInput): pb.DebitFundCollectionCommitInputPO = pb.DebitFundCollectionCommitInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeDebitFundCollectionCommitInputPO(value: pb.DebitFundCollectionCommitInputPO): DebitFundCollectionCommitInput = DebitFundCollectionCommitInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeDebitFundCollectionCommitReceiptPO(value: DebitFundCollectionCommitReceipt): pb.DebitFundCollectionCommitReceiptPO = pb.DebitFundCollectionCommitReceiptPO(
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
  def decodeDebitFundCollectionCommitReceiptPO(value: pb.DebitFundCollectionCommitReceiptPO): DebitFundCollectionCommitReceipt = DebitFundCollectionCommitReceipt(
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

  def encodeDebitFundCollectionCommitQueryPO(value: DebitFundCollectionCommitQuery): pb.DebitFundCollectionCommitQueryPO = pb.DebitFundCollectionCommitQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeDebitFundCollectionCommitQueryPO(value: pb.DebitFundCollectionCommitQueryPO): DebitFundCollectionCommitQuery = DebitFundCollectionCommitQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeDebitFundCollectionCompensateInputPO(value: DebitFundCollectionCompensateInput): pb.DebitFundCollectionCompensateInputPO = pb.DebitFundCollectionCompensateInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeDebitFundCollectionCompensateInputPO(value: pb.DebitFundCollectionCompensateInputPO): DebitFundCollectionCompensateInput = DebitFundCollectionCompensateInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

  def encodeDebitFundCollectionCompensateReceiptPO(value: DebitFundCollectionCompensateReceipt): pb.DebitFundCollectionCompensateReceiptPO = pb.DebitFundCollectionCompensateReceiptPO(
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
  def decodeDebitFundCollectionCompensateReceiptPO(value: pb.DebitFundCollectionCompensateReceiptPO): DebitFundCollectionCompensateReceipt = DebitFundCollectionCompensateReceipt(
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

  def encodeDebitFundCollectionCompensateQueryPO(value: DebitFundCollectionCompensateQuery): pb.DebitFundCollectionCompensateQueryPO = pb.DebitFundCollectionCompensateQueryPO(
    transaction = Some(encodeTxIdPO(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = Some(encodeAccountIdPO(value.resource)),
    step = value.step,
    phase = value.phase
  )
  def decodeDebitFundCollectionCompensateQueryPO(value: pb.DebitFundCollectionCompensateQueryPO): DebitFundCollectionCompensateQuery = DebitFundCollectionCompensateQuery(
    transaction = decodeTxIdPO(req(value.transaction)),
    definitionVersion = value.definitionVersion,
    argsDigest = value.argsDigest,
    participant = value.participant,
    resource = decodeAccountIdPO(req(value.resource)),
    step = value.step,
    phase = value.phase
  )

  def encodeCreditOriginalInvestorPrepareInputPO(value: CreditOriginalInvestorPrepareInput): pb.CreditOriginalInvestorPrepareInputPO = pb.CreditOriginalInvestorPrepareInputPO(txid = Some(encodeTxIdPO(value.txid)), resource = Some(encodeAccountIdPO(value.resource)), amount = Some(encodeMoneyPO(value.amount)))
  def decodeCreditOriginalInvestorPrepareInputPO(value: pb.CreditOriginalInvestorPrepareInputPO): CreditOriginalInvestorPrepareInput = CreditOriginalInvestorPrepareInput(txid = decodeTxIdPO(req(value.txid)), resource = decodeAccountIdPO(req(value.resource)), amount = decodeMoneyPO(req(value.amount)))

}
