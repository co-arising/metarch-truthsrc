package example.bankwealth.application

import scala.concurrent.Future

import net.imadz.infra.saga.strict.OperationIdentity
import net.imadz.infra.saga.strict.TransactionIdentity

/** Technical port surface of the payment pipeline invocation face — the one
  * file that says what this face depends on. Grouped by role: the admission
  * gates, the three participant phase pairs, the result-kind completion
  * pairs. Implementations are supplied exclusively by the handwritten
  * composition root through `BankPaymentPortBindings.install`; this surface
  * owns declarations only.
  *
  * Phase member names compose from the saga payload's participant step ids
  * (reserve-investor-funds / credit-fund-collection / reserve-cash-fund-order);
  * the domain value types keep their knowledge-side names. */
trait BankPaymentPorts {

  /** Declared identity of every bound implementation — evidence derived from
    * the binding obligations at install time, never hand-maintained. */
  def declarations: Map[String, (String, String)]

  // ---- admission gates -------------------------------------------------------

  def entry(input: BankPaymentOriginal): Future[Boolean]
  def association(input: BankPaymentOriginal): Future[Boolean]

  // ---- reserve-investor-funds (investorCreditBalance) ------------------------

  def reserveInvestorFundsPrepareExecute(input: BankPayment0PrepareInput, identity: OperationIdentity): Future[BankPayment0PrepareReceipt]
  def reserveInvestorFundsPrepareQuery(input: BankPayment0PrepareQuery, identity: OperationIdentity): Future[Option[BankPayment0PrepareReceipt]]
  def reserveInvestorFundsCommitExecute(input: BankPayment0CommitInput, identity: OperationIdentity): Future[BankPayment0CommitReceipt]
  def reserveInvestorFundsCommitQuery(input: BankPayment0CommitQuery, identity: OperationIdentity): Future[Option[BankPayment0CommitReceipt]]
  def reserveInvestorFundsCompensateExecute(input: BankPayment0CompensateInput, identity: OperationIdentity): Future[BankPayment0CompensateReceipt]
  def reserveInvestorFundsCompensateQuery(input: BankPayment0CompensateQuery, identity: OperationIdentity): Future[Option[BankPayment0CompensateReceipt]]

  // ---- credit-fund-collection (collectionCreditBalance) ----------------------

  def creditFundCollectionPrepareExecute(input: BankPayment1PrepareInput, identity: OperationIdentity): Future[BankPayment1PrepareReceipt]
  def creditFundCollectionPrepareQuery(input: BankPayment1PrepareQuery, identity: OperationIdentity): Future[Option[BankPayment1PrepareReceipt]]
  def creditFundCollectionCommitExecute(input: BankPayment1CommitInput, identity: OperationIdentity): Future[BankPayment1CommitReceipt]
  def creditFundCollectionCommitQuery(input: BankPayment1CommitQuery, identity: OperationIdentity): Future[Option[BankPayment1CommitReceipt]]
  def creditFundCollectionCompensateExecute(input: BankPayment1CompensateInput, identity: OperationIdentity): Future[BankPayment1CompensateReceipt]
  def creditFundCollectionCompensateQuery(input: BankPayment1CompensateQuery, identity: OperationIdentity): Future[Option[BankPayment1CompensateReceipt]]

  // ---- reserve-cash-fund-order (orderFundOrderTCC) ---------------------------

  def reserveCashFundOrderPrepareExecute(input: BankPayment2PrepareInput, identity: OperationIdentity): Future[BankPayment2PrepareReceipt]
  def reserveCashFundOrderPrepareQuery(input: BankPayment2PrepareQuery, identity: OperationIdentity): Future[Option[BankPayment2PrepareReceipt]]
  def reserveCashFundOrderCommitExecute(input: BankPayment2CommitInput, identity: OperationIdentity): Future[BankPayment2CommitReceipt]
  def reserveCashFundOrderCommitQuery(input: BankPayment2CommitQuery, identity: OperationIdentity): Future[Option[BankPayment2CommitReceipt]]
  def reserveCashFundOrderCompensateExecute(input: BankPayment2CompensateInput, identity: OperationIdentity): Future[BankPayment2CompensateReceipt]
  def reserveCashFundOrderCompensateQuery(input: BankPayment2CompensateQuery, identity: OperationIdentity): Future[Option[BankPayment2CompensateReceipt]]

  // ---- result-kind completion pairs ------------------------------------------

  def succeededAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult]
  def succeededDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean]
  def rejectedBeforeEffectsAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult]
  def rejectedBeforeEffectsDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean]
  def compensatedAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult]
  def compensatedDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean]
  def recoveryRequiredAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult]
  def recoveryRequiredDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean]
  def outcomeUnknownAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult]
  def outcomeUnknownDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean]
}

object BankPaymentPorts {

  /** Completion-carrying call context of the delivery two-phase. */
  final case class CompletionContext(original: BankPaymentOriginal, identity: TransactionIdentity)

  /** Raised by implementations when an operation was provably not executed;
    * the strict runtime folds this into a not-executed receipt. */
  final case class OperationNotExecuted(
    identity: OperationIdentity,
    evidence: String,
    safeToRetry: Boolean,
  ) extends RuntimeException(evidence)
}
