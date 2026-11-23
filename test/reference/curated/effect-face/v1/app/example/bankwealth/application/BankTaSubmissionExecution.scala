package example.bankwealth.application

import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._

import akka.actor.typed.{ActorRef, Behavior, PostStop}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.PersistenceId
import example.bankwealth.domain.values.{FundOrderId, TaRequestId, TxId}
import example.bankwealth.infrastructure.serialization.DomainConverters
import net.imadz.monarch.{StageError, StageFailedException}
import net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}

/** Durable execution plan of the TA submission pipeline: one stage,
  * `submit-ta`, which hands a paid fund order to the TA effect host and folds
  * its authoritative result into the plan state. Stage outcomes are the
  * monarch contract: Refused is a business rejection, Unavailable and Unknown
  * demand manual recovery — never an implicit retry. */
object BankTaSubmissionExecution {

  final case class Inputs(taRequestId: TaRequestId, fundOrderId: FundOrderId, paymentTxId: TxId)

  final case class SubmitTaRequest(taRequestId: TaRequestId, fundOrderId: FundOrderId, paymentTxId: TxId)

  sealed trait SubmitTaResult
  final case class SubmitTaObserved(taRequestId: TaRequestId) extends SubmitTaResult
  case object SubmitTaRefused extends SubmitTaResult
  case object SubmitTaUnavailable extends SubmitTaResult
  case object SubmitTaUnknown extends SubmitTaResult

  final case class State(inputs: Inputs, taRequestId: Option[TaRequestId] = None)

  final case class Outputs(taRequestId: TaRequestId)

  /** Unconfirmed predecessor output is refused — never defaulted. */
  def outputs(state: State): Outputs =
    Outputs(state.taRequestId.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output")))

  /** Exact finite plan codec: the protobuf face owns the slot layout
    * (input0…input2/output0) until the proto-family replacement; every slot
    * decode is fail-closed and the plan version is pinned. */
  val codec: StateCodec[State] = StateCodec[State](
    state =>
      example.bankwealth.infrastructure.executionproto.banktasubmissionv1ExecutionStatePB(
        planversion = PlanVersion,
        input0 = Some(DomainConverters.encodeTaRequestIdPB(state.inputs.taRequestId)),
        input1 = Some(DomainConverters.encodeFundOrderIdPB(state.inputs.fundOrderId)),
        input2 = Some(DomainConverters.encodeTxIdPB(state.inputs.paymentTxId)),
        output0 = state.taRequestId.map(DomainConverters.encodeTaRequestIdPB),
      ).toByteArray,
    bytes => {
      val pb = example.bankwealth.infrastructure.executionproto.banktasubmissionv1ExecutionStatePB.parseFrom(bytes)
      require(pb.planversion == PlanVersion, "exact finite plan version required")
      def durable[A](slot: Option[A], name: String): A =
        slot.getOrElse(throw new IllegalArgumentException(s"missing durable input $name"))
      State(
        Inputs(
          taRequestId = DomainConverters.decodeTaRequestIdPB(durable(pb.input0, "input0")),
          fundOrderId = DomainConverters.decodeFundOrderIdPB(durable(pb.input1, "input1")),
          paymentTxId = DomainConverters.decodeTxIdPB(durable(pb.input2, "input2")),
        ),
        pb.output0.map(DomainConverters.decodeTaRequestIdPB),
      )
    },
  )

  def install(submitTaHost: ActorRef[BankTaEffectHost.Request]): Installed = {
    require(submitTaHost != null, "the exact effect host actor is required")
    new Installed(submitTaHost)
  }

  final class Installed private[BankTaSubmissionExecution] (val submitTaHost: ActorRef[BankTaEffectHost.Request])

  // ----------------------------------------------------------------- knowledge
  private val PlanVersion = "bank-v1-1"
  private val StageId = "submit-ta"

  /** Bounded retry of the pending-effect poll (R1): the host answers Pending
    * while the effect stays unobserved; the bridge re-asks with exponential
    * backoff inside the stage deadline — never an unbounded loop. */
  private val RetryInitial = 100.millis
  private val RetryFactor = 2
  private val RetryMax = 5.seconds
  private val StageDeadline = 60.seconds

  def behavior(
    persistenceId: String,
    installed: Installed,
    observer: RunObserver[State],
  )(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[State]] = Behaviors.setup { context =>
    require(persistenceId != null && persistenceId.nonEmpty && installed != null && observer != null,
      "explicit owned finite execution and installed objects required")

    final case class EffectCall(state: State, attempt: Int, deadline: scala.concurrent.duration.Deadline, promise: Promise[SubmitTaResult])
    val effectBridge = context.spawnAnonymous(Behaviors.setup[EffectCall] { bridgeContext =>
      Behaviors.receiveMessage[EffectCall] { call =>
        bridgeContext.spawnAnonymous(Behaviors.setup[BankTaEffectHost.Reply] { replyContext =>
          installed.submitTaHost ! BankTaEffectHost.Invoke(call.state, replyContext.self)
          Behaviors.receiveMessage[BankTaEffectHost.Reply] {
            case BankTaEffectHost.Completed(result) => call.promise.trySuccess(result); Behaviors.stopped
            case BankTaEffectHost.Conflict(reason) => call.promise.tryFailure(new IllegalArgumentException(reason)); Behaviors.stopped
            case BankTaEffectHost.Pending(_) if call.deadline.isOverdue() =>
              call.promise.tryFailure(new IllegalStateException("submit-ta stage deadline exceeded")); Behaviors.stopped
            case BankTaEffectHost.Pending(_) =>
              val delayMillis = math.min(RetryMax.toMillis, math.round(RetryInitial.toMillis * math.pow(RetryFactor, call.attempt.toDouble)))
              replyContext.scheduleOnce(delayMillis.millis, bridgeContext.self, call.copy(attempt = call.attempt + 1))
              Behaviors.same
          }.receiveSignal { case (_, PostStop) =>
            call.promise.tryFailure(new IllegalStateException("owned invocation observer stopped")); Behaviors.same
          }
        })
        Behaviors.same
      }
    })

    def invokeSubmitTa(state: State): Future[SubmitTaResult] = {
      val promise = Promise[SubmitTaResult]()
      effectBridge ! EffectCall(state, attempt = 0, deadline = Deadline.now + StageDeadline, promise)
      promise.future
    }

    val plan = Vector(StageId)
    PersistentMonarch.behavior[String, State](
      PersistenceId.ofUniqueId(persistenceId),
      plan,
      (step, state) => step match {
        case StageId => invokeSubmitTa(state).map {
          case SubmitTaObserved(taRequestId) => state.copy(taRequestId = Some(taRequestId))
          case SubmitTaRefused => throw StageFailedException(StageError(StageId, Some("Refused"), "business-rejection", "business-rejection:Refused:stop"))
          case SubmitTaUnavailable => throw StageFailedException(StageError(StageId, Some("Unavailable"), "infrastructure-failure", "infrastructure-failure:Unavailable:manual-recovery"))
          case SubmitTaUnknown => throw StageFailedException(StageError(StageId, Some("Unknown"), "unknown-effect", "unknown-effect:Unknown:manual-recovery"))
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
