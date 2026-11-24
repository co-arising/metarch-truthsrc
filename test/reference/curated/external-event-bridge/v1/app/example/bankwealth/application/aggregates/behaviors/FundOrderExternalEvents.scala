package example.bankwealth.application.aggregates.behaviors

import example.bankwealth.domain.events.FundOrderEvents._
import example.bankwealth.application.saga._
import example.bankwealth.domain.values._

object FundOrderExternalEvents {
  def bankPaymentResultCompensated(output: BankPaymentResult): BankPaymentResultCompensated = BankPaymentResultCompensated(output.txid)
  def bankPaymentResultCompensatedIdentity(output: BankPaymentResult): Vector[String] = Vector(output.txid.value)
  def bankPaymentResultOutcomeUnknown(output: BankPaymentResult): BankPaymentResultOutcomeUnknown = BankPaymentResultOutcomeUnknown(output.txid)
  def bankPaymentResultOutcomeUnknownIdentity(output: BankPaymentResult): Vector[String] = Vector(output.txid.value)
  def bankPaymentResultRecoveryRequired(output: BankPaymentResult): BankPaymentResultRecoveryRequired = BankPaymentResultRecoveryRequired(output.txid)
  def bankPaymentResultRecoveryRequiredIdentity(output: BankPaymentResult): Vector[String] = Vector(output.txid.value)
  def bankPaymentResultRejectedBeforeEffects(output: BankPaymentResult): BankPaymentResultRejectedBeforeEffects = BankPaymentResultRejectedBeforeEffects(output.txid)
  def bankPaymentResultRejectedBeforeEffectsIdentity(output: BankPaymentResult): Vector[String] = Vector(output.txid.value)
  def bankPaymentResultSucceeded(output: BankPaymentResult): BankPaymentResultSucceeded = BankPaymentResultSucceeded(output.txid)
  def bankPaymentResultSucceededIdentity(output: BankPaymentResult): Vector[String] = Vector(output.txid.value)
  def bankRefundResultCompensated(output: BankRefundResult): BankRefundResultCompensated = BankRefundResultCompensated(output.txid)
  def bankRefundResultCompensatedIdentity(output: BankRefundResult): Vector[String] = Vector(output.txid.value)
  def bankRefundResultOutcomeUnknown(output: BankRefundResult): BankRefundResultOutcomeUnknown = BankRefundResultOutcomeUnknown(output.txid)
  def bankRefundResultOutcomeUnknownIdentity(output: BankRefundResult): Vector[String] = Vector(output.txid.value)
  def bankRefundResultRecoveryRequired(output: BankRefundResult): BankRefundResultRecoveryRequired = BankRefundResultRecoveryRequired(output.txid)
  def bankRefundResultRecoveryRequiredIdentity(output: BankRefundResult): Vector[String] = Vector(output.txid.value)
  def bankRefundResultRejectedBeforeEffects(output: BankRefundResult): BankRefundResultRejectedBeforeEffects = BankRefundResultRejectedBeforeEffects(output.txid)
  def bankRefundResultRejectedBeforeEffectsIdentity(output: BankRefundResult): Vector[String] = Vector(output.txid.value)
  def bankRefundResultSucceeded(output: BankRefundResult): BankRefundResultSucceeded = BankRefundResultSucceeded(output.txid)
  def bankRefundResultSucceededIdentity(output: BankRefundResult): Vector[String] = Vector(output.txid.value)
  def bankTaReceiptObservation(output: TaReceipt): FundTAReceiptObserved = FundTAReceiptObserved(output.fundOrderId, output.paymentTxId, output.taRequestId, output.investorAccountId, output.fundCollectionAccountId, output.fundCode, output.amount, output.principal, output.receiptId, output.receiptBody, output.taReference, output.status, output.shares, output.nav, output.reason)
  def bankTaReceiptObservationIdentity(output: TaReceipt): Vector[String] = Vector(output.taRequestId.value, output.receiptId)
}
