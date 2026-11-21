package example.bankwealth.application

import scala.concurrent.Future

import net.imadz.infra.saga.strict.OperationIdentity

/** Technical port surface of the payment pipeline invocation face.
  *
  * One typed obligation table describes every port (name, role, exact
  * implementation binding); the trait and the installed facade stay explicitly
  * typed so consumers keep compile-time signatures. Implementations are
  * supplied exclusively by the handwritten composition root — this generated
  * face owns the declaration, the exact-binding check and the installed
  * accessors, never an implementation.
  *
  * Domain value classes (`BankPayment0PrepareInput` and friends) keep their
  * knowledge-side names; only port members are named here. Participant member
  * names compose from the saga payload's participant ids
  * (investorCreditBalance / collectionCreditBalance / orderFundOrderTCC). */
object BankPaymentTechnicalPorts {

  /** Role of a port in the invocation protocol; `wire` is the ledger spelling. */
  sealed trait Role { def wire: String }
  object Role {
    case object Entry extends Role { val wire = "entry" }
    case object Association extends Role { val wire = "association" }
    case object PhaseExecute extends Role { val wire = "phase-execute" }
    case object PhaseQuery extends Role { val wire = "phase-query" }
    case object Authority extends Role { val wire = "authority" }
    case object ResultDelivery extends Role { val wire = "result-delivery" }
  }

  /** Completion-carrying call context for the delivery two-phase. */
  final case class CompletionContext(original: BankPaymentOriginal, identity: TransactionIdentity)

  /** A handwritten implementation exactly bound to its declared identity.
    * `operation` and `completion` are the identity-carrying faces demanded by
    * the strict runtime; absence is a declared capability, never a null. */
  final case class Implementation[I, O](
    id: String,
    version: String,
    run: I => Future[O],
    operation: Option[(I, OperationIdentity) => Future[O]] = None,
    completion: Option[(I, CompletionContext) => Future[O]] = None,
  ) {
    def requireExact(expectedId: String, expectedVersion: String, needsOperation: Boolean, needsCompletion: Boolean): Unit = {
      require(id == expectedId, s"implementation identity mismatch: expected $expectedId, got $id")
      require(version == expectedVersion, s"implementation version mismatch: $id expected $expectedVersion, got $version")
      require(run != null, s"implementation $id carries no run face")
      require(!needsOperation || operation.isDefined, s"implementation $id lacks the operation face its role demands")
      require(!needsCompletion || completion.isDefined, s"implementation $id lacks the completion face its role demands")
    }
  }

  /** Raised by implementations when an operation was provably not executed;
    * the strict runtime folds this into a not-executed receipt. */
  final case class OperationNotExecuted(
    identity: OperationIdentity,
    evidence: String,
    safeToRetry: Boolean,
  ) extends RuntimeException(evidence)

  /** Declared obligation of one port, as data: the table drives install-time
    * exact-binding checks and the declarations map, so neither the checks nor
    * the map are hand-copied per port. `declaredId` keeps the knowledge-side
    * implementation identity spelling — binding identities are stable across
    * member renames, so the handwritten composition root never retypes them. */
  private final case class Obligation(
    declaredId: String,
    role: Role,
    needsOperation: Boolean,
    needsCompletion: Boolean,
    bound: Bindings => Implementation[_, _],
  )

  private def obligation(
    declaredId: String,
    role: Role,
    needsOperation: Boolean = false,
    needsCompletion: Boolean = false,
  )(bound: Bindings => Implementation[_, _]): Obligation =
    Obligation(declaredId, role, needsOperation, needsCompletion, bound)

  private val implementationVersion = "bank-v1-1"

  /** The obligation table: one row per port, in declaration order. */
  private val obligations: Vector[Obligation] = Vector(
    obligation("BankPaymentEntry", Role.Entry)(_.entry),
    obligation("BankPaymentAssociation", Role.Association)(_.association),
    obligation("BankPayment0PrepareExecute", Role.PhaseExecute, needsOperation = true)(_.investorCreditBalancePrepareExecute),
    obligation("BankPayment0PrepareQueryPort", Role.PhaseQuery, needsOperation = true)(_.investorCreditBalancePrepareQuery),
    obligation("BankPayment0CommitExecute", Role.PhaseExecute, needsOperation = true)(_.investorCreditBalanceCommitExecute),
    obligation("BankPayment0CommitQueryPort", Role.PhaseQuery, needsOperation = true)(_.investorCreditBalanceCommitQuery),
    obligation("BankPayment0CompensateExecute", Role.PhaseExecute, needsOperation = true)(_.investorCreditBalanceCompensateExecute),
    obligation("BankPayment0CompensateQueryPort", Role.PhaseQuery, needsOperation = true)(_.investorCreditBalanceCompensateQuery),
    obligation("BankPayment1PrepareExecute", Role.PhaseExecute, needsOperation = true)(_.collectionCreditBalancePrepareExecute),
    obligation("BankPayment1PrepareQueryPort", Role.PhaseQuery, needsOperation = true)(_.collectionCreditBalancePrepareQuery),
    obligation("BankPayment1CommitExecute", Role.PhaseExecute, needsOperation = true)(_.collectionCreditBalanceCommitExecute),
    obligation("BankPayment1CommitQueryPort", Role.PhaseQuery, needsOperation = true)(_.collectionCreditBalanceCommitQuery),
    obligation("BankPayment1CompensateExecute", Role.PhaseExecute, needsOperation = true)(_.collectionCreditBalanceCompensateExecute),
    obligation("BankPayment1CompensateQueryPort", Role.PhaseQuery, needsOperation = true)(_.collectionCreditBalanceCompensateQuery),
    obligation("BankPayment2PrepareExecute", Role.PhaseExecute, needsOperation = true)(_.orderFundOrderTccPrepareExecute),
    obligation("BankPayment2PrepareQueryPort", Role.PhaseQuery, needsOperation = true)(_.orderFundOrderTccPrepareQuery),
    obligation("BankPayment2CommitExecute", Role.PhaseExecute, needsOperation = true)(_.orderFundOrderTccCommitExecute),
    obligation("BankPayment2CommitQueryPort", Role.PhaseQuery, needsOperation = true)(_.orderFundOrderTccCommitQuery),
    obligation("BankPayment2CompensateExecute", Role.PhaseExecute, needsOperation = true)(_.orderFundOrderTccCompensateExecute),
    obligation("BankPayment2CompensateQueryPort", Role.PhaseQuery, needsOperation = true)(_.orderFundOrderTccCompensateQuery),
    obligation("BankPaymentSucceededAuthority", Role.Authority, needsCompletion = true)(_.succeededAuthority),
    obligation("BankPaymentSucceededDelivery", Role.ResultDelivery, needsCompletion = true)(_.succeededDelivery),
    obligation("BankPaymentRejectedBeforeEffectsAuthority", Role.Authority, needsCompletion = true)(_.rejectedBeforeEffectsAuthority),
    obligation("BankPaymentRejectedBeforeEffectsDelivery", Role.ResultDelivery, needsCompletion = true)(_.rejectedBeforeEffectsDelivery),
    obligation("BankPaymentCompensatedAuthority", Role.Authority, needsCompletion = true)(_.compensatedAuthority),
    obligation("BankPaymentCompensatedDelivery", Role.ResultDelivery, needsCompletion = true)(_.compensatedDelivery),
    obligation("BankPaymentRecoveryRequiredAuthority", Role.Authority, needsCompletion = true)(_.recoveryRequiredAuthority),
    obligation("BankPaymentRecoveryRequiredDelivery", Role.ResultDelivery, needsCompletion = true)(_.recoveryRequiredDelivery),
    obligation("BankPaymentOutcomeUnknownAuthority", Role.Authority, needsCompletion = true)(_.outcomeUnknownAuthority),
    obligation("BankPaymentOutcomeUnknownDelivery", Role.ResultDelivery, needsCompletion = true)(_.outcomeUnknownDelivery),
  )

  /** The typed implementation record — the composition root fills exactly
    * these slots, one per declared port. */
  final case class Bindings(
    entry: Implementation[BankPaymentOriginal, Boolean],
    association: Implementation[BankPaymentOriginal, Boolean],
    investorCreditBalancePrepareExecute: Implementation[BankPayment0PrepareInput, BankPayment0PrepareReceipt],
    investorCreditBalancePrepareQuery: Implementation[BankPayment0PrepareQuery, Option[BankPayment0PrepareReceipt]],
    investorCreditBalanceCommitExecute: Implementation[BankPayment0CommitInput, BankPayment0CommitReceipt],
    investorCreditBalanceCommitQuery: Implementation[BankPayment0CommitQuery, Option[BankPayment0CommitReceipt]],
    investorCreditBalanceCompensateExecute: Implementation[BankPayment0CompensateInput, BankPayment0CompensateReceipt],
    investorCreditBalanceCompensateQuery: Implementation[BankPayment0CompensateQuery, Option[BankPayment0CompensateReceipt]],
    collectionCreditBalancePrepareExecute: Implementation[BankPayment1PrepareInput, BankPayment1PrepareReceipt],
    collectionCreditBalancePrepareQuery: Implementation[BankPayment1PrepareQuery, Option[BankPayment1PrepareReceipt]],
    collectionCreditBalanceCommitExecute: Implementation[BankPayment1CommitInput, BankPayment1CommitReceipt],
    collectionCreditBalanceCommitQuery: Implementation[BankPayment1CommitQuery, Option[BankPayment1CommitReceipt]],
    collectionCreditBalanceCompensateExecute: Implementation[BankPayment1CompensateInput, BankPayment1CompensateReceipt],
    collectionCreditBalanceCompensateQuery: Implementation[BankPayment1CompensateQuery, Option[BankPayment1CompensateReceipt]],
    orderFundOrderTccPrepareExecute: Implementation[BankPayment2PrepareInput, BankPayment2PrepareReceipt],
    orderFundOrderTccPrepareQuery: Implementation[BankPayment2PrepareQuery, Option[BankPayment2PrepareReceipt]],
    orderFundOrderTccCommitExecute: Implementation[BankPayment2CommitInput, BankPayment2CommitReceipt],
    orderFundOrderTccCommitQuery: Implementation[BankPayment2CommitQuery, Option[BankPayment2CommitReceipt]],
    orderFundOrderTccCompensateExecute: Implementation[BankPayment2CompensateInput, BankPayment2CompensateReceipt],
    orderFundOrderTccCompensateQuery: Implementation[BankPayment2CompensateQuery, Option[BankPayment2CompensateReceipt]],
    succeededAuthority: Implementation[BankPaymentOriginal, BankPaymentResult],
    succeededDelivery: Implementation[BankPaymentResult, Boolean],
    rejectedBeforeEffectsAuthority: Implementation[BankPaymentOriginal, BankPaymentResult],
    rejectedBeforeEffectsDelivery: Implementation[BankPaymentResult, Boolean],
    compensatedAuthority: Implementation[BankPaymentOriginal, BankPaymentResult],
    compensatedDelivery: Implementation[BankPaymentResult, Boolean],
    recoveryRequiredAuthority: Implementation[BankPaymentOriginal, BankPaymentResult],
    recoveryRequiredDelivery: Implementation[BankPaymentResult, Boolean],
    outcomeUnknownAuthority: Implementation[BankPaymentOriginal, BankPaymentResult],
    outcomeUnknownDelivery: Implementation[BankPaymentResult, Boolean],
  )

  /** The installed port surface: typed accessors over exact bindings.
    * Phase faces expose the operation-carrying variants the strict runtime
    * calls; delivery faces expose the completion-carrying variants the host
    * calls. */
  final class Installed private[BankPaymentTechnicalPorts] (bindings: Bindings) {

    def entry(input: BankPaymentOriginal): Future[Boolean] =
      bindings.entry.run(input)

    def association(input: BankPaymentOriginal): Future[Boolean] =
      bindings.association.run(input)

    def investorCreditBalancePrepareExecute(input: BankPayment0PrepareInput, identity: OperationIdentity): Future[BankPayment0PrepareReceipt] =
      bindings.investorCreditBalancePrepareExecute.operation.get(input, identity)
    def investorCreditBalancePrepareQuery(input: BankPayment0PrepareQuery, identity: OperationIdentity): Future[Option[BankPayment0PrepareReceipt]] =
      bindings.investorCreditBalancePrepareQuery.operation.get(input, identity)
    def investorCreditBalanceCommitExecute(input: BankPayment0CommitInput, identity: OperationIdentity): Future[BankPayment0CommitReceipt] =
      bindings.investorCreditBalanceCommitExecute.operation.get(input, identity)
    def investorCreditBalanceCommitQuery(input: BankPayment0CommitQuery, identity: OperationIdentity): Future[Option[BankPayment0CommitReceipt]] =
      bindings.investorCreditBalanceCommitQuery.operation.get(input, identity)
    def investorCreditBalanceCompensateExecute(input: BankPayment0CompensateInput, identity: OperationIdentity): Future[BankPayment0CompensateReceipt] =
      bindings.investorCreditBalanceCompensateExecute.operation.get(input, identity)
    def investorCreditBalanceCompensateQuery(input: BankPayment0CompensateQuery, identity: OperationIdentity): Future[Option[BankPayment0CompensateReceipt]] =
      bindings.investorCreditBalanceCompensateQuery.operation.get(input, identity)

    def collectionCreditBalancePrepareExecute(input: BankPayment1PrepareInput, identity: OperationIdentity): Future[BankPayment1PrepareReceipt] =
      bindings.collectionCreditBalancePrepareExecute.operation.get(input, identity)
    def collectionCreditBalancePrepareQuery(input: BankPayment1PrepareQuery, identity: OperationIdentity): Future[Option[BankPayment1PrepareReceipt]] =
      bindings.collectionCreditBalancePrepareQuery.operation.get(input, identity)
    def collectionCreditBalanceCommitExecute(input: BankPayment1CommitInput, identity: OperationIdentity): Future[BankPayment1CommitReceipt] =
      bindings.collectionCreditBalanceCommitExecute.operation.get(input, identity)
    def collectionCreditBalanceCommitQuery(input: BankPayment1CommitQuery, identity: OperationIdentity): Future[Option[BankPayment1CommitReceipt]] =
      bindings.collectionCreditBalanceCommitQuery.operation.get(input, identity)
    def collectionCreditBalanceCompensateExecute(input: BankPayment1CompensateInput, identity: OperationIdentity): Future[BankPayment1CompensateReceipt] =
      bindings.collectionCreditBalanceCompensateExecute.operation.get(input, identity)
    def collectionCreditBalanceCompensateQuery(input: BankPayment1CompensateQuery, identity: OperationIdentity): Future[Option[BankPayment1CompensateReceipt]] =
      bindings.collectionCreditBalanceCompensateQuery.operation.get(input, identity)

    def orderFundOrderTccPrepareExecute(input: BankPayment2PrepareInput, identity: OperationIdentity): Future[BankPayment2PrepareReceipt] =
      bindings.orderFundOrderTccPrepareExecute.operation.get(input, identity)
    def orderFundOrderTccPrepareQuery(input: BankPayment2PrepareQuery, identity: OperationIdentity): Future[Option[BankPayment2PrepareReceipt]] =
      bindings.orderFundOrderTccPrepareQuery.operation.get(input, identity)
    def orderFundOrderTccCommitExecute(input: BankPayment2CommitInput, identity: OperationIdentity): Future[BankPayment2CommitReceipt] =
      bindings.orderFundOrderTccCommitExecute.operation.get(input, identity)
    def orderFundOrderTccCommitQuery(input: BankPayment2CommitQuery, identity: OperationIdentity): Future[Option[BankPayment2CommitReceipt]] =
      bindings.orderFundOrderTccCommitQuery.operation.get(input, identity)
    def orderFundOrderTccCompensateExecute(input: BankPayment2CompensateInput, identity: OperationIdentity): Future[BankPayment2CompensateReceipt] =
      bindings.orderFundOrderTccCompensateExecute.operation.get(input, identity)
    def orderFundOrderTccCompensateQuery(input: BankPayment2CompensateQuery, identity: OperationIdentity): Future[Option[BankPayment2CompensateReceipt]] =
      bindings.orderFundOrderTccCompensateQuery.operation.get(input, identity)

    def succeededAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult] =
      bindings.succeededAuthority.completion.get(input, context)
    def succeededDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.succeededDelivery.completion.get(input, context)
    def rejectedBeforeEffectsAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult] =
      bindings.rejectedBeforeEffectsAuthority.completion.get(input, context)
    def rejectedBeforeEffectsDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.rejectedBeforeEffectsDelivery.completion.get(input, context)
    def compensatedAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult] =
      bindings.compensatedAuthority.completion.get(input, context)
    def compensatedDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.compensatedDelivery.completion.get(input, context)
    def recoveryRequiredAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult] =
      bindings.recoveryRequiredAuthority.completion.get(input, context)
    def recoveryRequiredDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.recoveryRequiredDelivery.completion.get(input, context)
    def outcomeUnknownAuthorityCompletion(input: BankPaymentOriginal, context: CompletionContext): Future[BankPaymentResult] =
      bindings.outcomeUnknownAuthority.completion.get(input, context)
    def outcomeUnknownDeliveryCompletion(input: BankPaymentResult, context: CompletionContext): Future[Boolean] =
      bindings.outcomeUnknownDelivery.completion.get(input, context)

    /** Declared identity of every bound implementation, derived from the
      * obligation table — never hand-maintained. */
    lazy val declarations: Map[String, (String, String)] =
      obligations.map { o => o.declaredId -> {
        val impl = o.bound(bindings)
        impl.id -> impl.version
      } }.toMap
  }

  /** Install exact bindings: one check per declared obligation, driven by the
    * table. Ownership below is a static binding obligation, not proof of
    * business authorization, replay or deployment. */
  def install(bindings: Bindings): Installed = {
    require(bindings != null, "complete technical port bindings required")
    for (o <- obligations) o.bound(bindings).requireExact(
      "bankwealth." + o.declaredId, implementationVersion, o.needsOperation, o.needsCompletion)
    new Installed(bindings)
  }

  /** Static binding ownership per port, keyed by declared implementation id
    * (role, artifact, boundary) — derived from the obligation table. */
  lazy val bindingOwnership: Vector[(String, String, String, String, String)] =
    obligations.map(o => (o.declaredId, o.role.wire, "bank-payment-technical", implementationVersion, "handwritten-composition-root"))
}
