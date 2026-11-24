package example.bankwealth.application

import scala.concurrent.Future

import example.bankwealth.domain.values._
import net.imadz.infra.saga.strict.{OperationIdentity, TransactionIdentity}

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

  import BankPaymentPorts.CompletionContext

  /** Declared identity of every bound implementation — evidence derived from
    * the binding obligations at install time, never hand-maintained. */
  def declarations: Map[String, (String, String)]

  // ---- admission gates -------------------------------------------------------

  def entry(input: BankPaymentOriginal): Future[Boolean]
  def association(input: BankPaymentOriginal): Future[Boolean]

  // ---- reserve-investor-funds (investorCreditBalance) ------------------------

  def reserveInvestorFundsPrepareExecute(input: ReserveInvestorFundsPrepareInput,
      identity: OperationIdentity): Future[ReserveInvestorFundsPrepareReceipt]
  def reserveInvestorFundsPrepareQuery(input: ReserveInvestorFundsPrepareQuery,
      identity: OperationIdentity): Future[Option[ReserveInvestorFundsPrepareReceipt]]
  def reserveInvestorFundsCommitExecute(input: ReserveInvestorFundsCommitInput,
      identity: OperationIdentity): Future[ReserveInvestorFundsCommitReceipt]
  def reserveInvestorFundsCommitQuery(input: ReserveInvestorFundsCommitQuery,
      identity: OperationIdentity): Future[Option[ReserveInvestorFundsCommitReceipt]]
  def reserveInvestorFundsCompensateExecute(input: ReserveInvestorFundsCompensateInput,
      identity: OperationIdentity): Future[ReserveInvestorFundsCompensateReceipt]
  def reserveInvestorFundsCompensateQuery(input: ReserveInvestorFundsCompensateQuery,
      identity: OperationIdentity): Future[Option[ReserveInvestorFundsCompensateReceipt]]

  // ---- credit-fund-collection (collectionCreditBalance) ----------------------

  def creditFundCollectionPrepareExecute(input: CreditFundCollectionPrepareInput,
      identity: OperationIdentity): Future[CreditFundCollectionPrepareReceipt]
  def creditFundCollectionPrepareQuery(input: CreditFundCollectionPrepareQuery,
      identity: OperationIdentity): Future[Option[CreditFundCollectionPrepareReceipt]]
  def creditFundCollectionCommitExecute(input: CreditFundCollectionCommitInput,
      identity: OperationIdentity): Future[CreditFundCollectionCommitReceipt]
  def creditFundCollectionCommitQuery(input: CreditFundCollectionCommitQuery,
      identity: OperationIdentity): Future[Option[CreditFundCollectionCommitReceipt]]
  def creditFundCollectionCompensateExecute(input: CreditFundCollectionCompensateInput,
      identity: OperationIdentity): Future[CreditFundCollectionCompensateReceipt]
  def creditFundCollectionCompensateQuery(input: CreditFundCollectionCompensateQuery,
      identity: OperationIdentity): Future[Option[CreditFundCollectionCompensateReceipt]]

  // ---- reserve-cash-fund-order (orderFundOrderTCC) ---------------------------

  def reserveCashFundOrderPrepareExecute(input: ReserveCashFundOrderPrepareInput,
      identity: OperationIdentity): Future[ReserveCashFundOrderPrepareReceipt]
  def reserveCashFundOrderPrepareQuery(input: ReserveCashFundOrderPrepareQuery,
      identity: OperationIdentity): Future[Option[ReserveCashFundOrderPrepareReceipt]]
  def reserveCashFundOrderCommitExecute(input: ReserveCashFundOrderCommitInput,
      identity: OperationIdentity): Future[ReserveCashFundOrderCommitReceipt]
  def reserveCashFundOrderCommitQuery(input: ReserveCashFundOrderCommitQuery,
      identity: OperationIdentity): Future[Option[ReserveCashFundOrderCommitReceipt]]
  def reserveCashFundOrderCompensateExecute(input: ReserveCashFundOrderCompensateInput,
      identity: OperationIdentity): Future[ReserveCashFundOrderCompensateReceipt]
  def reserveCashFundOrderCompensateQuery(input: ReserveCashFundOrderCompensateQuery,
      identity: OperationIdentity): Future[Option[ReserveCashFundOrderCompensateReceipt]]

  // ---- result-kind completion pairs ------------------------------------------

  def succeededAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult]
  def succeededDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean]
  def rejectedBeforeEffectsAuthorityCompletion(input: BankPaymentOriginal,
      context: CompletionContext): Future[BankPaymentResult]
  def rejectedBeforeEffectsDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean]
  def compensatedAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult]
  def compensatedDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean]
  def recoveryRequiredAuthorityCompletion(input: BankPaymentOriginal,
      context: CompletionContext): Future[BankPaymentResult]
  def recoveryRequiredDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean]
  def outcomeUnknownAuthorityCompletion(input: BankPaymentOriginal,
      context: CompletionContext): Future[BankPaymentResult]
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
