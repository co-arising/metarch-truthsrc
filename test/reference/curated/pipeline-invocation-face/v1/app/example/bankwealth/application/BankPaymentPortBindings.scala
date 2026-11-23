package example.bankwealth.application

import scala.concurrent.Future

import example.bankwealth.domain.values._
import net.imadz.infra.saga.strict.OperationIdentity

/** Exact bindings of the handwritten implementations to the declared ports.
  *
  * This is NOT a dependency-injection container: it is the executable form of
  * the binding obligations declared in the truth/artifact contract. The
  * composition root fills one record per port, `install` verifies every
  * declared identity and returns the `BankPaymentPorts` surface — or refuses.
  * Each port role exposes exactly the one face its consumers call, so a
  * binding record carries no optional faces and no nulls. Implementation
  * identity strings keep the knowledge-side spelling; renaming members never
  * retypes them. */
object BankPaymentPortBindings {

  private val implementationVersion = "bank-v1-1"

  /** One obligation row per port: the declared implementation identity and the
    * accessor to its binding. The check and the evidence maps are written
    * once, below — never per port. */
  private final case class Obligation(declaredId: String, bound: Bindings => PortBinding[_, _])

  private val obligations: Vector[Obligation] = Vector(
    Obligation("BankPaymentEntry", _.entry),
    Obligation("BankPaymentAssociation", _.association),
    Obligation("ReserveInvestorFundsPrepareExecute", _.reserveInvestorFundsPrepareExecute),
    Obligation("ReserveInvestorFundsPrepareQueryPort", _.reserveInvestorFundsPrepareQuery),
    Obligation("ReserveInvestorFundsCommitExecute", _.reserveInvestorFundsCommitExecute),
    Obligation("ReserveInvestorFundsCommitQueryPort", _.reserveInvestorFundsCommitQuery),
    Obligation("ReserveInvestorFundsCompensateExecute", _.reserveInvestorFundsCompensateExecute),
    Obligation("ReserveInvestorFundsCompensateQueryPort", _.reserveInvestorFundsCompensateQuery),
    Obligation("CreditFundCollectionPrepareExecute", _.creditFundCollectionPrepareExecute),
    Obligation("CreditFundCollectionPrepareQueryPort", _.creditFundCollectionPrepareQuery),
    Obligation("CreditFundCollectionCommitExecute", _.creditFundCollectionCommitExecute),
    Obligation("CreditFundCollectionCommitQueryPort", _.creditFundCollectionCommitQuery),
    Obligation("CreditFundCollectionCompensateExecute", _.creditFundCollectionCompensateExecute),
    Obligation("CreditFundCollectionCompensateQueryPort", _.creditFundCollectionCompensateQuery),
    Obligation("ReserveCashFundOrderPrepareExecute", _.reserveCashFundOrderPrepareExecute),
    Obligation("ReserveCashFundOrderPrepareQueryPort", _.reserveCashFundOrderPrepareQuery),
    Obligation("ReserveCashFundOrderCommitExecute", _.reserveCashFundOrderCommitExecute),
    Obligation("ReserveCashFundOrderCommitQueryPort", _.reserveCashFundOrderCommitQuery),
    Obligation("ReserveCashFundOrderCompensateExecute", _.reserveCashFundOrderCompensateExecute),
    Obligation("ReserveCashFundOrderCompensateQueryPort", _.reserveCashFundOrderCompensateQuery),
    Obligation("BankPaymentSucceededAuthority", _.succeededAuthority),
    Obligation("BankPaymentSucceededDelivery", _.succeededDelivery),
    Obligation("BankPaymentRejectedBeforeEffectsAuthority", _.rejectedBeforeEffectsAuthority),
    Obligation("BankPaymentRejectedBeforeEffectsDelivery", _.rejectedBeforeEffectsDelivery),
    Obligation("BankPaymentCompensatedAuthority", _.compensatedAuthority),
    Obligation("BankPaymentCompensatedDelivery", _.compensatedDelivery),
    Obligation("BankPaymentRecoveryRequiredAuthority", _.recoveryRequiredAuthority),
    Obligation("BankPaymentRecoveryRequiredDelivery", _.recoveryRequiredDelivery),
    Obligation("BankPaymentOutcomeUnknownAuthority", _.outcomeUnknownAuthority),
    Obligation("BankPaymentOutcomeUnknownDelivery", _.outcomeUnknownDelivery),
  )

  sealed trait PortBinding[I, O] {
    def id: String
    def version: String

    def requireExact(expectedId: String, expectedVersion: String): Unit = {
      require(id == expectedId, s"implementation identity mismatch: expected $expectedId, got $id")
      require(version == expectedVersion,
          s"implementation version mismatch: $id expected $expectedVersion, got $version")
    }
  }

  /** The typed implementation records. Each carries exactly one face; a null
    * face fails at construction, before install ever sees it. */
  final case class RunBinding[I, O](id: String, version: String, run: I => Future[O]) extends PortBinding[I, O] {
    require(run != null, s"implementation $id carries no run face")
  }
  final case class OperationBinding[I,
      O](id: String, version: String, run: (I, OperationIdentity) => Future[O]) extends PortBinding[I, O] {
    require(run != null, s"implementation $id carries no operation face")
  }
  final case class CompletionBinding[I,
      O](id: String, version: String, run: (I, CompletionContext) => Future[O]) extends PortBinding[I, O] {
    require(run != null, s"implementation $id carries no completion face")
  }

  /** The typed implementation record — the composition root fills exactly
    * these slots, one per declared port. */
  final case class Bindings(
    entry: RunBinding[BankPaymentOriginal, Boolean],
    association: RunBinding[BankPaymentOriginal, Boolean],
    reserveInvestorFundsPrepareExecute: OperationBinding[ReserveInvestorFundsPrepareInput,
        ReserveInvestorFundsPrepareReceipt],
    reserveInvestorFundsPrepareQuery: OperationBinding[ReserveInvestorFundsPrepareQuery,
        Option[ReserveInvestorFundsPrepareReceipt]],
    reserveInvestorFundsCommitExecute: OperationBinding[ReserveInvestorFundsCommitInput,
        ReserveInvestorFundsCommitReceipt],
    reserveInvestorFundsCommitQuery: OperationBinding[ReserveInvestorFundsCommitQuery,
        Option[ReserveInvestorFundsCommitReceipt]],
    reserveInvestorFundsCompensateExecute: OperationBinding[ReserveInvestorFundsCompensateInput,
        ReserveInvestorFundsCompensateReceipt],
    reserveInvestorFundsCompensateQuery: OperationBinding[ReserveInvestorFundsCompensateQuery,
        Option[ReserveInvestorFundsCompensateReceipt]],
    creditFundCollectionPrepareExecute: OperationBinding[CreditFundCollectionPrepareInput,
        CreditFundCollectionPrepareReceipt],
    creditFundCollectionPrepareQuery: OperationBinding[CreditFundCollectionPrepareQuery,
        Option[CreditFundCollectionPrepareReceipt]],
    creditFundCollectionCommitExecute: OperationBinding[CreditFundCollectionCommitInput,
        CreditFundCollectionCommitReceipt],
    creditFundCollectionCommitQuery: OperationBinding[CreditFundCollectionCommitQuery,
        Option[CreditFundCollectionCommitReceipt]],
    creditFundCollectionCompensateExecute: OperationBinding[CreditFundCollectionCompensateInput,
        CreditFundCollectionCompensateReceipt],
    creditFundCollectionCompensateQuery: OperationBinding[CreditFundCollectionCompensateQuery,
        Option[CreditFundCollectionCompensateReceipt]],
    reserveCashFundOrderPrepareExecute: OperationBinding[ReserveCashFundOrderPrepareInput,
        ReserveCashFundOrderPrepareReceipt],
    reserveCashFundOrderPrepareQuery: OperationBinding[ReserveCashFundOrderPrepareQuery,
        Option[ReserveCashFundOrderPrepareReceipt]],
    reserveCashFundOrderCommitExecute: OperationBinding[ReserveCashFundOrderCommitInput,
        ReserveCashFundOrderCommitReceipt],
    reserveCashFundOrderCommitQuery: OperationBinding[ReserveCashFundOrderCommitQuery,
        Option[ReserveCashFundOrderCommitReceipt]],
    reserveCashFundOrderCompensateExecute: OperationBinding[ReserveCashFundOrderCompensateInput,
        ReserveCashFundOrderCompensateReceipt],
    reserveCashFundOrderCompensateQuery: OperationBinding[ReserveCashFundOrderCompensateQuery,
        Option[ReserveCashFundOrderCompensateReceipt]],
    succeededAuthority: CompletionBinding[BankPaymentOriginal, BankPaymentResult],
    succeededDelivery: CompletionBinding[BankPaymentResult, Boolean],
    rejectedBeforeEffectsAuthority: CompletionBinding[BankPaymentOriginal, BankPaymentResult],
    rejectedBeforeEffectsDelivery: CompletionBinding[BankPaymentResult, Boolean],
    compensatedAuthority: CompletionBinding[BankPaymentOriginal, BankPaymentResult],
    compensatedDelivery: CompletionBinding[BankPaymentResult, Boolean],
    recoveryRequiredAuthority: CompletionBinding[BankPaymentOriginal, BankPaymentResult],
    recoveryRequiredDelivery: CompletionBinding[BankPaymentResult, Boolean],
    outcomeUnknownAuthority: CompletionBinding[BankPaymentOriginal, BankPaymentResult],
    outcomeUnknownDelivery: CompletionBinding[BankPaymentResult, Boolean],
  )

  /** Verify every declared obligation and expose the typed port surface. */
  def install(bindings: Bindings): BankPaymentPorts = {
    require(bindings != null, "complete technical port bindings required")
    for (o <- obligations) o.bound(bindings).requireExact("bankwealth." + o.declaredId, implementationVersion)
    new BoundPorts(bindings)
  }

  private final class BoundPorts(bindings: Bindings) extends BankPaymentPorts {
    def entry(input: BankPaymentOriginal): Future[Boolean] = bindings.entry.run(input)
    def association(input: BankPaymentOriginal): Future[Boolean] = bindings.association.run(input)

    def reserveInvestorFundsPrepareExecute(input: ReserveInvestorFundsPrepareInput,
        identity: OperationIdentity): Future[ReserveInvestorFundsPrepareReceipt] =
      bindings.reserveInvestorFundsPrepareExecute.run(input, identity)
    def reserveInvestorFundsPrepareQuery(input: ReserveInvestorFundsPrepareQuery,
        identity: OperationIdentity): Future[Option[ReserveInvestorFundsPrepareReceipt]] =
      bindings.reserveInvestorFundsPrepareQuery.run(input, identity)
    def reserveInvestorFundsCommitExecute(input: ReserveInvestorFundsCommitInput,
        identity: OperationIdentity): Future[ReserveInvestorFundsCommitReceipt] =
      bindings.reserveInvestorFundsCommitExecute.run(input, identity)
    def reserveInvestorFundsCommitQuery(input: ReserveInvestorFundsCommitQuery,
        identity: OperationIdentity): Future[Option[ReserveInvestorFundsCommitReceipt]] =
      bindings.reserveInvestorFundsCommitQuery.run(input, identity)
    def reserveInvestorFundsCompensateExecute(input: ReserveInvestorFundsCompensateInput,
        identity: OperationIdentity): Future[ReserveInvestorFundsCompensateReceipt] =
      bindings.reserveInvestorFundsCompensateExecute.run(input, identity)
    def reserveInvestorFundsCompensateQuery(input: ReserveInvestorFundsCompensateQuery,
        identity: OperationIdentity): Future[Option[ReserveInvestorFundsCompensateReceipt]] =
      bindings.reserveInvestorFundsCompensateQuery.run(input, identity)

    def creditFundCollectionPrepareExecute(input: CreditFundCollectionPrepareInput,
        identity: OperationIdentity): Future[CreditFundCollectionPrepareReceipt] =
      bindings.creditFundCollectionPrepareExecute.run(input, identity)
    def creditFundCollectionPrepareQuery(input: CreditFundCollectionPrepareQuery,
        identity: OperationIdentity): Future[Option[CreditFundCollectionPrepareReceipt]] =
      bindings.creditFundCollectionPrepareQuery.run(input, identity)
    def creditFundCollectionCommitExecute(input: CreditFundCollectionCommitInput,
        identity: OperationIdentity): Future[CreditFundCollectionCommitReceipt] =
      bindings.creditFundCollectionCommitExecute.run(input, identity)
    def creditFundCollectionCommitQuery(input: CreditFundCollectionCommitQuery,
        identity: OperationIdentity): Future[Option[CreditFundCollectionCommitReceipt]] =
      bindings.creditFundCollectionCommitQuery.run(input, identity)
    def creditFundCollectionCompensateExecute(input: CreditFundCollectionCompensateInput,
        identity: OperationIdentity): Future[CreditFundCollectionCompensateReceipt] =
      bindings.creditFundCollectionCompensateExecute.run(input, identity)
    def creditFundCollectionCompensateQuery(input: CreditFundCollectionCompensateQuery,
        identity: OperationIdentity): Future[Option[CreditFundCollectionCompensateReceipt]] =
      bindings.creditFundCollectionCompensateQuery.run(input, identity)

    def reserveCashFundOrderPrepareExecute(input: ReserveCashFundOrderPrepareInput,
        identity: OperationIdentity): Future[ReserveCashFundOrderPrepareReceipt] =
      bindings.reserveCashFundOrderPrepareExecute.run(input, identity)
    def reserveCashFundOrderPrepareQuery(input: ReserveCashFundOrderPrepareQuery,
        identity: OperationIdentity): Future[Option[ReserveCashFundOrderPrepareReceipt]] =
      bindings.reserveCashFundOrderPrepareQuery.run(input, identity)
    def reserveCashFundOrderCommitExecute(input: ReserveCashFundOrderCommitInput,
        identity: OperationIdentity): Future[ReserveCashFundOrderCommitReceipt] =
      bindings.reserveCashFundOrderCommitExecute.run(input, identity)
    def reserveCashFundOrderCommitQuery(input: ReserveCashFundOrderCommitQuery,
        identity: OperationIdentity): Future[Option[ReserveCashFundOrderCommitReceipt]] =
      bindings.reserveCashFundOrderCommitQuery.run(input, identity)
    def reserveCashFundOrderCompensateExecute(input: ReserveCashFundOrderCompensateInput,
        identity: OperationIdentity): Future[ReserveCashFundOrderCompensateReceipt] =
      bindings.reserveCashFundOrderCompensateExecute.run(input, identity)
    def reserveCashFundOrderCompensateQuery(input: ReserveCashFundOrderCompensateQuery,
        identity: OperationIdentity): Future[Option[ReserveCashFundOrderCompensateReceipt]] =
      bindings.reserveCashFundOrderCompensateQuery.run(input, identity)

    def succeededAuthorityCompletion(input: BankPaymentOriginal,
        context: CompletionContext): Future[BankPaymentResult] =
      bindings.succeededAuthority.run(input, context)
    def succeededDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.succeededDelivery.run(input, context)
    def rejectedBeforeEffectsAuthorityCompletion(input: BankPaymentOriginal,
        context: CompletionContext): Future[BankPaymentResult] =
      bindings.rejectedBeforeEffectsAuthority.run(input, context)
    def rejectedBeforeEffectsDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.rejectedBeforeEffectsDelivery.run(input, context)
    def compensatedAuthorityCompletion(input: BankPaymentOriginal,
        context: CompletionContext): Future[BankPaymentResult] =
      bindings.compensatedAuthority.run(input, context)
    def compensatedDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.compensatedDelivery.run(input, context)
    def recoveryRequiredAuthorityCompletion(input: BankPaymentOriginal,
        context: CompletionContext): Future[BankPaymentResult] =
      bindings.recoveryRequiredAuthority.run(input, context)
    def recoveryRequiredDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.recoveryRequiredDelivery.run(input, context)
    def outcomeUnknownAuthorityCompletion(input: BankPaymentOriginal,
        context: CompletionContext): Future[BankPaymentResult] =
      bindings.outcomeUnknownAuthority.run(input, context)
    def outcomeUnknownDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.outcomeUnknownDelivery.run(input, context)

    /** Declared identity of every bound implementation, derived from the
      * obligation table — never hand-maintained. */
    lazy val declarations: Map[String, (String, String)] =
      obligations.map { o =>
        val b = o.bound(bindings)
        o.declaredId -> (b.id -> b.version)
      }.toMap
  }

  /** Static binding ownership per port, keyed by declared implementation id:
    * (id, role wire, artifact, version, boundary) — evidence data, derived
    * from the obligation table by the role order above. */
  def bindingOwnership(bindings: Bindings): Vector[(String, String, String, String, String)] = {
    obligations.map { o =>
      val role = o.declaredId match {
        case id if id.endsWith("Entry") => "entry"
        case id if id.endsWith("Association") => "association"
        case id if id.endsWith("Authority") => "authority"
        case id if id.endsWith("Delivery") => "result-delivery"
        case id if id.endsWith("QueryPort") => "phase-query"
        case _ => "phase-execute"
      }
      (o.declaredId, role, "bank-payment-technical", implementationVersion, "handwritten-composition-root")
    }
  }
}
