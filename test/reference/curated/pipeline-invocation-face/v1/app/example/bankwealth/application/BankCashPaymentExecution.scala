package example.bankwealth.application

import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._

import akka.actor.typed.{ActorRef, Behavior, PostStop}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.PersistenceId
import com.google.protobuf.ByteString
import example.bankwealth.domain.values.{AccountId, FundOrderId, Money, OperationId, TxId}
import example.bankwealth.infrastructure.serialization.DomainConverters
import net.imadz.monarch.{StageError, StageFailedException}
import net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}

/** Durable execution plan of the cash purchase payment pipeline: one stage,
  * `pay-cash-purchase`, which delegates to the invocation host and folds its
  * authoritative result into the plan state. Stage outcomes are the monarch
  * contract: business rejections stop the stage, unknown effects demand
  * manual recovery — never an implicit retry. */
object BankCashPaymentExecution {

  final case class Inputs(
    operation: OperationId,
    occurrence: OperationId,
    investorAccountId: AccountId,
    fundOrderId: FundOrderId,
    fundCollectionAccountId: AccountId,
    amount: Money,
    fundCode: String,
  )

  final case class PayCashPurchaseRequest(
    operation: OperationId,
    occurrence: OperationId,
    investorAccountId: AccountId,
    fundOrderId: FundOrderId,
    fundCollectionAccountId: AccountId,
    amount: Money,
  )

  sealed trait PayCashPurchaseResult
  final case class PayCashPurchaseSucceeded(paymentTxid: TxId) extends PayCashPurchaseResult
  case object PayCashPurchaseRejected extends PayCashPurchaseResult
  case object PayCashPurchaseCompensated extends PayCashPurchaseResult
  case object PayCashPurchaseRecoveryRequired extends PayCashPurchaseResult
  case object PayCashPurchaseUnknown extends PayCashPurchaseResult

  final case class State(inputs: Inputs, paymentTxid: Option[TxId] = None)

  final case class Outputs(paymentTxid: TxId)

  /** Unconfirmed predecessor output is refused — never defaulted. */
  def outputs(state: State): Outputs =
    Outputs(state.paymentTxid.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output")))

  /** Exact finite plan codec: the protobuf face owns the slot layout
    * (input0…input6) until the proto-family replacement; every slot decode is
    * fail-closed and the plan version is pinned. */
  val codec: StateCodec[State] = StateCodec[State](
    state =>
      example.bankwealth.infrastructure.executionproto.bankcashpaymentv1ExecutionStatePB(
        planversion = PlanVersion,
        input0 = Some(DomainConverters.encodeOperationIdPO(state.inputs.operation)),
        input1 = Some(DomainConverters.encodeOperationIdPO(state.inputs.occurrence)),
        input2 = Some(DomainConverters.encodeAccountIdPO(state.inputs.investorAccountId)),
        input3 = Some(DomainConverters.encodeFundOrderIdPO(state.inputs.fundOrderId)),
        input4 = Some(DomainConverters.encodeAccountIdPO(state.inputs.fundCollectionAccountId)),
        input5 = Some(DomainConverters.encodeMoneyPO(state.inputs.amount)),
        input6 = Some(identity[String](state.inputs.fundCode)),
        output0 = state.paymentTxid.map(DomainConverters.encodeTxIdPO),
      ).toByteArray,
    bytes => {
      val pb = example.bankwealth.infrastructure.executionproto.bankcashpaymentv1ExecutionStatePB.parseFrom(bytes)
      require(pb.planversion == PlanVersion, "exact finite plan version required")
      def durable[A](slot: Option[A], name: String): A =
        slot.getOrElse(throw new IllegalArgumentException(s"missing durable input $name"))
      State(
        Inputs(
          operation = DomainConverters.decodeOperationIdPO(durable(pb.input0, "input0")),
          occurrence = DomainConverters.decodeOperationIdPO(durable(pb.input1, "input1")),
          investorAccountId = DomainConverters.decodeAccountIdPO(durable(pb.input2, "input2")),
          fundOrderId = DomainConverters.decodeFundOrderIdPO(durable(pb.input3, "input3")),
          fundCollectionAccountId = DomainConverters.decodeAccountIdPO(durable(pb.input4, "input4")),
          amount = DomainConverters.decodeMoneyPO(durable(pb.input5, "input5")),
          fundCode = identity[String](durable(pb.input6, "input6")),
        ),
        pb.output0.map(DomainConverters.decodeTxIdPO),
      )
    },
  )

  def install(payCashPurchaseHost: ActorRef[BankPaymentHost.Request]): Installed = {
    require(payCashPurchaseHost != null, "the exact invocation host actor is required")
    new Installed(payCashPurchaseHost)
  }

  final class Installed private[BankCashPaymentExecution] (val payCashPurchaseHost: ActorRef[BankPaymentHost.Request])

  // ----------------------------------------------------------------- knowledge
  private val PlanVersion = "bank-v1-1"
  private val StageId = "pay-cash-purchase"

  /** Bounded retry of the pending-invocation poll (R1): the host answers
    * Pending while the saga runs; the bridge re-asks with exponential backoff
    * inside the stage deadline — never an unbounded 20 ms loop. */
  private val RetryInitial = 100.millis
  private val RetryFactor = 2
  private val RetryMax = 5.seconds
  private val StageDeadline = 60.seconds

  /** R1 bounded backoff schedule: attempt 0 waits RetryInitial, doubling per
    * attempt and capped at RetryMax — the poll loop is finite by construction. */
  def backoffMillis(attempt: Int): Long =
    math.min(RetryMax.toMillis, math.round(RetryInitial.toMillis * math.pow(RetryFactor, attempt.toDouble)))

  def behavior(
    persistenceId: String,
    installed: Installed,
    observer: RunObserver[State],
  )(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[State]] = Behaviors.setup { context =>
    require(persistenceId != null && persistenceId.nonEmpty && installed != null && observer != null,
      "explicit owned finite execution and installed objects required")

    final case class InvocationCall(state: State,
        attempt: Int, deadline: scala.concurrent.duration.Deadline, promise: Promise[PayCashPurchaseResult])
    val invocationBridge = context.spawnAnonymous(Behaviors.setup[InvocationCall] { bridgeContext =>
      Behaviors.receiveMessage[InvocationCall] { call =>
        bridgeContext.spawnAnonymous(Behaviors.setup[BankPaymentHost.Reply] { replyContext =>
          installed.payCashPurchaseHost ! BankPaymentHost.Invoke(call.state, replyContext.self)
          Behaviors.receiveMessage[BankPaymentHost.Reply] {
            case BankPaymentHost.Completed(result) => call.promise.trySuccess(result); Behaviors.stopped
            case BankPaymentHost.Conflict(reason) =>
                call.promise.tryFailure(new IllegalArgumentException(reason)); Behaviors.stopped
            case BankPaymentHost.Pending(_) if call.deadline.isOverdue() =>
              call.promise
                  .tryFailure(new IllegalStateException("pay-cash-purchase stage deadline exceeded")); Behaviors.stopped
            case BankPaymentHost.Pending(_) =>
              replyContext.scheduleOnce(backoffMillis(call.attempt).millis, bridgeContext.self,
                call.copy(attempt = call.attempt + 1))
              Behaviors.same
          }.receiveSignal { case (_, PostStop) =>
            call.promise.tryFailure(new IllegalStateException("owned invocation observer stopped")); Behaviors.same
          }
        })
        Behaviors.same
      }
    })

    def invokePayCashPurchase(state: State): Future[PayCashPurchaseResult] = {
      val promise = Promise[PayCashPurchaseResult]()
      invocationBridge ! InvocationCall(state, attempt = 0, deadline = Deadline.now + StageDeadline, promise)
      promise.future
    }

    val plan = Vector(StageId)
    PersistentMonarch.behavior[String, State](
      PersistenceId.ofUniqueId(persistenceId),
      plan,
      (step, state) => step match {
        case StageId => invokePayCashPurchase(state).map {
          case PayCashPurchaseSucceeded(paymentTxid) => state.copy(paymentTxid = Some(paymentTxid))
          case PayCashPurchaseRejected => throw StageFailedException(StageError(StageId,
              Some("Rejected"), "business-rejection", "business-rejection:Rejected:stop"))
          case PayCashPurchaseCompensated => throw StageFailedException(StageError(StageId,
              Some("Compensated"), "business-rejection", "business-rejection:Compensated:stop"))
          case PayCashPurchaseRecoveryRequired => throw StageFailedException(StageError(StageId,
            Some("RecoveryRequired"), "infrastructure-failure",
            "infrastructure-failure:RecoveryRequired:manual-recovery"))
          case PayCashPurchaseUnknown => throw StageFailedException(StageError(StageId,
              Some("Unknown"), "unknown-effect", "unknown-effect:Unknown:manual-recovery"))
        }
        case _ => Future.failed(new IllegalArgumentException("unknown static step"))
      },
      codec,
      identity[String],
      None,
      observer,
    )
  }
}
