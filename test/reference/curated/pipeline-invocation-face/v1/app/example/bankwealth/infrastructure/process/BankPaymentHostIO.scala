package example.bankwealth.infrastructure.process

import scala.concurrent.{ExecutionContext, Future}

import example.bankwealth.application.process.protocol.BankPaymentMessages._
import example.bankwealth.application.process.protocol.CreditFundCollectionStep._
import example.bankwealth.application.process.protocol.ReserveCashFundOrderStep._
import example.bankwealth.application.process.protocol.ReserveInvestorFundsStep._
import BankPaymentHost.ResultKind
import example.bankwealth.application.process.cash_payment.BankPaymentPorts
import example.bankwealth.application.process.cash_payment.BankPaymentPorts.CompletionContext
import net.imadz.infra.saga.strict.TransactionIdentity

/** Input/output wiring of the bank payment invocation face: the admission gate and
  * the two-phase receipt delivery. Every dispatch is over the typed result
  * kind — the compiler, not a string match, closes the case set. */
object BankPaymentHostIO {

  /** Admission asks the entry gate, then the association check; both must
    * pass. An implementation failure surfaces as a failed future — the host
    * reports it as "admission unavailable", never as a denial. */
  def admit(
    original: BankPaymentOriginal,
    technical: BankPaymentPorts,
  )(implicit ec: ExecutionContext): Future[Boolean] =
    technical.entry(original).flatMap {
      case true => technical.association(original)
      case false => Future.successful(false)
    }

  /** Two-phase delivery: the authority port must re-derive exactly the result
    * implied by the observed identity, then the delivery port carries it to
    * the destination. A mismatch refuses the delivery — never a guess. */
  def deliver(
    kind: ResultKind,
    original: BankPaymentOriginal,
    identity: TransactionIdentity,
    technical: BankPaymentPorts,
  )(implicit ec: ExecutionContext): Future[Boolean] = {
    val context = CompletionContext(original, identity)
    val expected = BankPaymentResult(example.bankwealth.domain.values.TxId(identity.transactionId))
    val (authority, delivery) = completionFace(kind, technical)
    authority(original, context).flatMap { actual =>
      require(actual == expected, "authority result differs from the original-identity-derived expectation")
      delivery(actual, context)
    }
  }

  private type AuthorityFace =
    (BankPaymentOriginal, CompletionContext) => Future[BankPaymentResult]
  private type DeliveryFace =
    (BankPaymentResult, CompletionContext) => Future[Boolean]

  /** The completion faces of each result kind; exhaustive by construction. */
  private def completionFace(
    kind: ResultKind,
    technical: BankPaymentPorts,
  ): (AuthorityFace, DeliveryFace) =
    kind match {
      case ResultKind.Succeeded => (technical.succeededAuthorityCompletion, technical.succeededDeliveryCompletion)
      case ResultKind.RejectedBeforeEffects => (technical.rejectedBeforeEffectsAuthorityCompletion,
          technical.rejectedBeforeEffectsDeliveryCompletion)
      case ResultKind.Compensated => (technical.compensatedAuthorityCompletion, technical.compensatedDeliveryCompletion)
      case ResultKind.RecoveryRequired => (technical.recoveryRequiredAuthorityCompletion,
          technical.recoveryRequiredDeliveryCompletion)
      case ResultKind.OutcomeUnknown => (technical.outcomeUnknownAuthorityCompletion,
          technical.outcomeUnknownDeliveryCompletion)
    }
}
