package example.bankwealth.application

import scala.concurrent.Future

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
    Obligation("BankPayment0PrepareExecute", _.reserveInvestorFundsPrepareExecute),
    Obligation("BankPayment0PrepareQueryPort", _.reserveInvestorFundsPrepareQuery),
    Obligation("BankPayment0CommitExecute", _.reserveInvestorFundsCommitExecute),
    Obligation("BankPayment0CommitQueryPort", _.reserveInvestorFundsCommitQuery),
    Obligation("BankPayment0CompensateExecute", _.reserveInvestorFundsCompensateExecute),
    Obligation("BankPayment0CompensateQueryPort", _.reserveInvestorFundsCompensateQuery),
    Obligation("BankPayment1PrepareExecute", _.creditFundCollectionPrepareExecute),
    Obligation("BankPayment1PrepareQueryPort", _.creditFundCollectionPrepareQuery),
    Obligation("BankPayment1CommitExecute", _.creditFundCollectionCommitExecute),
    Obligation("BankPayment1CommitQueryPort", _.creditFundCollectionCommitQuery),
    Obligation("BankPayment1CompensateExecute", _.creditFundCollectionCompensateExecute),
    Obligation("BankPayment1CompensateQueryPort", _.creditFundCollectionCompensateQuery),
    Obligation("BankPayment2PrepareExecute", _.reserveCashFundOrderPrepareExecute),
    Obligation("BankPayment2PrepareQueryPort", _.reserveCashFundOrderPrepareQuery),
    Obligation("BankPayment2CommitExecute", _.reserveCashFundOrderCommitExecute),
    Obligation("BankPayment2CommitQueryPort", _.reserveCashFundOrderCommitQuery),
    Obligation("BankPayment2CompensateExecute", _.reserveCashFundOrderCompensateExecute),
    Obligation("BankPayment2CompensateQueryPort", _.reserveCashFundOrderCompensateQuery),
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

  private sealed trait PortBinding[I, O] {
    def id: String
    def version: String

    def requireExact(expectedId: String, expectedVersion: String): Unit = {
      require(id == expectedId, s"implementation identity mismatch: expected $expectedId, got $id")
      require(version == expectedVersion, s"implementation version mismatch: $id expected $expectedVersion, got $version")
    }
  }

  /** The typed implementation records. Each carries exactly one face; a null
    * face fails at construction, before install ever sees it. */
  final case class RunBinding[I, O](id: String, version: String, run: I => Future[O]) extends PortBinding[I, O] {
    require(run != null, s"implementation $id carries no run face")
  }
  final case class OperationBinding[I, O](id: String, version: String, run: (I, OperationIdentity) => Future[O]) extends PortBinding[I, O] {
    require(run != null, s"implementation $id carries no operation face")
  }
  final case class CompletionBinding[I, O](id: String, version: String, run: (I, BankPaymentPorts.CompletionContext) => Future[O]) extends PortBinding[I, O] {
    require(run != null, s"implementation $id carries no completion face")
  }

  /** The typed implementation record — the composition root fills exactly
    * these slots, one per declared port. */
  final case class Bindings(
    entry: RunBinding[BankPaymentOriginal, Boolean],
    association: RunBinding[BankPaymentOriginal, Boolean],
    reserveInvestorFundsPrepareExecute: OperationBinding[BankPayment0PrepareInput, BankPayment0PrepareReceipt],
    reserveInvestorFundsPrepareQuery: OperationBinding[BankPayment0PrepareQuery, Option[BankPayment0PrepareReceipt]],
    reserveInvestorFundsCommitExecute: OperationBinding[BankPayment0CommitInput, BankPayment0CommitReceipt],
    reserveInvestorFundsCommitQuery: OperationBinding[BankPayment0CommitQuery, Option[BankPayment0CommitReceipt]],
    reserveInvestorFundsCompensateExecute: OperationBinding[BankPayment0CompensateInput, BankPayment0CompensateReceipt],
    reserveInvestorFundsCompensateQuery: OperationBinding[BankPayment0CompensateQuery, Option[BankPayment0CompensateReceipt]],
    creditFundCollectionPrepareExecute: OperationBinding[BankPayment1PrepareInput, BankPayment1PrepareReceipt],
    creditFundCollectionPrepareQuery: OperationBinding[BankPayment1PrepareQuery, Option[BankPayment1PrepareReceipt]],
    creditFundCollectionCommitExecute: OperationBinding[BankPayment1CommitInput, BankPayment1CommitReceipt],
    creditFundCollectionCommitQuery: OperationBinding[BankPayment1CommitQuery, Option[BankPayment1CommitReceipt]],
    creditFundCollectionCompensateExecute: OperationBinding[BankPayment1CompensateInput, BankPayment1CompensateReceipt],
    creditFundCollectionCompensateQuery: OperationBinding[BankPayment1CompensateQuery, Option[BankPayment1CompensateReceipt]],
    reserveCashFundOrderPrepareExecute: OperationBinding[BankPayment2PrepareInput, BankPayment2PrepareReceipt],
    reserveCashFundOrderPrepareQuery: OperationBinding[BankPayment2PrepareQuery, Option[BankPayment2PrepareReceipt]],
    reserveCashFundOrderCommitExecute: OperationBinding[BankPayment2CommitInput, BankPayment2CommitReceipt],
    reserveCashFundOrderCommitQuery: OperationBinding[BankPayment2CommitQuery, Option[BankPayment2CommitReceipt]],
    reserveCashFundOrderCompensateExecute: OperationBinding[BankPayment2CompensateInput, BankPayment2CompensateReceipt],
    reserveCashFundOrderCompensateQuery: OperationBinding[BankPayment2CompensateQuery, Option[BankPayment2CompensateReceipt]],
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

    def reserveInvestorFundsPrepareExecute(input: BankPayment0PrepareInput, identity: OperationIdentity): Future[BankPayment0PrepareReceipt] =
      bindings.reserveInvestorFundsPrepareExecute.run(input, identity)
    def reserveInvestorFundsPrepareQuery(input: BankPayment0PrepareQuery, identity: OperationIdentity): Future[Option[BankPayment0PrepareReceipt]] =
      bindings.reserveInvestorFundsPrepareQuery.run(input, identity)
    def reserveInvestorFundsCommitExecute(input: BankPayment0CommitInput, identity: OperationIdentity): Future[BankPayment0CommitReceipt] =
      bindings.reserveInvestorFundsCommitExecute.run(input, identity)
    def reserveInvestorFundsCommitQuery(input: BankPayment0CommitQuery, identity: OperationIdentity): Future[Option[BankPayment0CommitReceipt]] =
      bindings.reserveInvestorFundsCommitQuery.run(input, identity)
    def reserveInvestorFundsCompensateExecute(input: BankPayment0CompensateInput, identity: OperationIdentity): Future[BankPayment0CompensateReceipt] =
      bindings.reserveInvestorFundsCompensateExecute.run(input, identity)
    def reserveInvestorFundsCompensateQuery(input: BankPayment0CompensateQuery, identity: OperationIdentity): Future[Option[BankPayment0CompensateReceipt]] =
      bindings.reserveInvestorFundsCompensateQuery.run(input, identity)

    def creditFundCollectionPrepareExecute(input: BankPayment1PrepareInput, identity: OperationIdentity): Future[BankPayment1PrepareReceipt] =
      bindings.creditFundCollectionPrepareExecute.run(input, identity)
    def creditFundCollectionPrepareQuery(input: BankPayment1PrepareQuery, identity: OperationIdentity): Future[Option[BankPayment1PrepareReceipt]] =
      bindings.creditFundCollectionPrepareQuery.run(input, identity)
    def creditFundCollectionCommitExecute(input: BankPayment1CommitInput, identity: OperationIdentity): Future[BankPayment1CommitReceipt] =
      bindings.creditFundCollectionCommitExecute.run(input, identity)
    def creditFundCollectionCommitQuery(input: BankPayment1CommitQuery, identity: OperationIdentity): Future[Option[BankPayment1CommitReceipt]] =
      bindings.creditFundCollectionCommitQuery.run(input, identity)
    def creditFundCollectionCompensateExecute(input: BankPayment1CompensateInput, identity: OperationIdentity): Future[BankPayment1CompensateReceipt] =
      bindings.creditFundCollectionCompensateExecute.run(input, identity)
    def creditFundCollectionCompensateQuery(input: BankPayment1CompensateQuery, identity: OperationIdentity): Future[Option[BankPayment1CompensateReceipt]] =
      bindings.creditFundCollectionCompensateQuery.run(input, identity)

    def reserveCashFundOrderPrepareExecute(input: BankPayment2PrepareInput, identity: OperationIdentity): Future[BankPayment2PrepareReceipt] =
      bindings.reserveCashFundOrderPrepareExecute.run(input, identity)
    def reserveCashFundOrderPrepareQuery(input: BankPayment2PrepareQuery, identity: OperationIdentity): Future[Option[BankPayment2PrepareReceipt]] =
      bindings.reserveCashFundOrderPrepareQuery.run(input, identity)
    def reserveCashFundOrderCommitExecute(input: BankPayment2CommitInput, identity: OperationIdentity): Future[BankPayment2CommitReceipt] =
      bindings.reserveCashFundOrderCommitExecute.run(input, identity)
    def reserveCashFundOrderCommitQuery(input: BankPayment2CommitQuery, identity: OperationIdentity): Future[Option[BankPayment2CommitReceipt]] =
      bindings.reserveCashFundOrderCommitQuery.run(input, identity)
    def reserveCashFundOrderCompensateExecute(input: BankPayment2CompensateInput, identity: OperationIdentity): Future[BankPayment2CompensateReceipt] =
      bindings.reserveCashFundOrderCompensateExecute.run(input, identity)
    def reserveCashFundOrderCompensateQuery(input: BankPayment2CompensateQuery, identity: OperationIdentity): Future[Option[BankPayment2CompensateReceipt]] =
      bindings.reserveCashFundOrderCompensateQuery.run(input, identity)

    def succeededAuthorityCompletion(input: BankPaymentOriginal, context: BankPaymentPorts.CompletionContext): Future[BankPaymentResult] =
      bindings.succeededAuthority.run(input, context)
    def succeededDeliveryCompletion(input: BankPaymentResult, context: BankPaymentPorts.CompletionContext): Future[Boolean] =
      bindings.succeededDelivery.run(input, context)
    def rejectedBeforeEffectsAuthorityCompletion(input: BankPaymentOriginal, context: BankPaymentPorts.CompletionContext): Future[BankPaymentResult] =
      bindings.rejectedBeforeEffectsAuthority.run(input, context)
    def rejectedBeforeEffectsDeliveryCompletion(input: BankPaymentResult, context: BankPaymentPorts.CompletionContext): Future[Boolean] =
      bindings.rejectedBeforeEffectsDelivery.run(input, context)
    def compensatedAuthorityCompletion(input: BankPaymentOriginal, context: BankPaymentPorts.CompletionContext): Future[BankPaymentResult] =
      bindings.compensatedAuthority.run(input, context)
    def compensatedDeliveryCompletion(input: BankPaymentResult, context: BankPaymentPorts.CompletionContext): Future[Boolean] =
      bindings.compensatedDelivery.run(input, context)
    def recoveryRequiredAuthorityCompletion(input: BankPaymentOriginal, context: BankPaymentPorts.CompletionContext): Future[BankPaymentResult] =
      bindings.recoveryRequiredAuthority.run(input, context)
    def recoveryRequiredDeliveryCompletion(input: BankPaymentResult, context: BankPaymentPorts.CompletionContext): Future[Boolean] =
      bindings.recoveryRequiredDelivery.run(input, context)
    def outcomeUnknownAuthorityCompletion(input: BankPaymentOriginal, context: BankPaymentPorts.CompletionContext): Future[BankPaymentResult] =
      bindings.outcomeUnknownAuthority.run(input, context)
    def outcomeUnknownDeliveryCompletion(input: BankPaymentResult, context: BankPaymentPorts.CompletionContext): Future[Boolean] =
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
