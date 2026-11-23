package example.bankwealth.application

import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._

import akka.actor.typed.{ActorRef, Behavior, PostStop}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.PersistenceId
import example.bankwealth.domain.values.{OccurrenceId, OperationId, SipOccurrence}
import example.bankwealth.infrastructure.serialization.DomainConverters
import net.imadz.monarch.{StageError, StageFailedException}
import net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}

/** Durable execution plan of the SIP dispatch pipeline: one stage,
  * `dispatch-cash`, which hands a durable SIP occurrence to the effect host
  * and folds its authoritative result into the plan state. Stage outcomes are
  * the monarch contract: Refused is a business rejection, Unavailable and
  * Unknown demand manual recovery — never an implicit retry. */
object BankSipDispatchExecution {

  final case class Inputs(occurrenceId: OccurrenceId, occurrence: SipOccurrence)

  final case class DispatchCashRequest(occurrenceId: OccurrenceId, occurrence: SipOccurrence)

  sealed trait DispatchCashResult
  final case class DispatchCashDispatched(operationId: OperationId) extends DispatchCashResult
  case object DispatchCashRefused extends DispatchCashResult
  case object DispatchCashUnavailable extends DispatchCashResult
  case object DispatchCashUnknown extends DispatchCashResult

  final case class State(inputs: Inputs, operationId: Option[OperationId] = None)

  final case class Outputs(operationId: OperationId)

  /** Unconfirmed predecessor output is refused — never defaulted. */
  def outputs(state: State): Outputs =
    Outputs(state.operationId.getOrElse(throw new IllegalArgumentException("unconfirmed predecessor output")))

  /** Exact finite plan codec: the protobuf face owns the slot layout
    * (input0/input1/output0) until the proto-family replacement; every slot
    * decode is fail-closed and the plan version is pinned. */
  val codec: StateCodec[State] = StateCodec[State](
    state =>
      example.bankwealth.infrastructure.executionproto.banksipdispatchv1ExecutionStatePB(
        planversion = PlanVersion,
        input0 = Some(DomainConverters.encodeOccurrenceIdPB(state.inputs.occurrenceId)),
        input1 = Some(DomainConverters.encodeSipOccurrencePB(state.inputs.occurrence)),
        output0 = state.operationId.map(DomainConverters.encodeOperationIdPB),
      ).toByteArray,
    bytes => {
      val pb = example.bankwealth.infrastructure.executionproto.banksipdispatchv1ExecutionStatePB.parseFrom(bytes)
      require(pb.planversion == PlanVersion, "exact finite plan version required")
      def durable[A](slot: Option[A], name: String): A =
        slot.getOrElse(throw new IllegalArgumentException(s"missing durable input $name"))
      State(
        Inputs(
          occurrenceId = DomainConverters.decodeOccurrenceIdPB(durable(pb.input0, "input0")),
          occurrence = DomainConverters.decodeSipOccurrencePB(durable(pb.input1, "input1")),
        ),
        pb.output0.map(DomainConverters.decodeOperationIdPB),
      )
    },
  )

  def install(dispatchCashHost: ActorRef[BankSipDispatchEffectHost.Request]): Installed = {
    require(dispatchCashHost != null, "the exact effect host actor is required")
    new Installed(dispatchCashHost)
  }

  final class Installed private[BankSipDispatchExecution] (val dispatchCashHost: ActorRef[BankSipDispatchEffectHost.Request])

  // ----------------------------------------------------------------- knowledge
  private val PlanVersion = "bank-v1-1"
  private val StageId = "dispatch-cash"

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

    final case class EffectCall(state: State, attempt: Int, deadline: scala.concurrent.duration.Deadline, promise: Promise[DispatchCashResult])
    val effectBridge = context.spawnAnonymous(Behaviors.setup[EffectCall] { bridgeContext =>
      Behaviors.receiveMessage[EffectCall] { call =>
        bridgeContext.spawnAnonymous(Behaviors.setup[BankSipDispatchEffectHost.Reply] { replyContext =>
          installed.dispatchCashHost ! BankSipDispatchEffectHost.Invoke(call.state, replyContext.self)
          Behaviors.receiveMessage[BankSipDispatchEffectHost.Reply] {
            case BankSipDispatchEffectHost.Completed(result) => call.promise.trySuccess(result); Behaviors.stopped
            case BankSipDispatchEffectHost.Conflict(reason) => call.promise.tryFailure(new IllegalArgumentException(reason)); Behaviors.stopped
            case BankSipDispatchEffectHost.Pending(_) if call.deadline.isOverdue() =>
              call.promise.tryFailure(new IllegalStateException("dispatch-cash stage deadline exceeded")); Behaviors.stopped
            case BankSipDispatchEffectHost.Pending(_) =>
              val delay = (RetryInitial * math.pow(RetryFactor, call.attempt.toDouble)).min(RetryMax)
              replyContext.scheduleOnce(delay, bridgeContext.self, call.copy(attempt = call.attempt + 1))
              Behaviors.same
          }.receiveSignal { case (_, PostStop) =>
            call.promise.tryFailure(new IllegalStateException("owned invocation observer stopped")); Behaviors.same
          }
        })
        Behaviors.same
      }
    })

    def invokeDispatchCash(state: State): Future[DispatchCashResult] = {
      val promise = Promise[DispatchCashResult]()
      effectBridge ! EffectCall(state, attempt = 0, deadline = Deadline.now + StageDeadline, promise)
      promise.future
    }

    val plan = Vector(StageId)
    PersistentMonarch.behavior[String, State](
      PersistenceId.ofUniqueId(persistenceId),
      plan,
      (step, state) => step match {
        case StageId => invokeDispatchCash(state).map {
          case DispatchCashDispatched(operationId) => state.copy(operationId = Some(operationId))
          case DispatchCashRefused => throw StageFailedException(StageError(StageId, Some("Refused"), "business-rejection", "business-rejection:Refused:stop"))
          case DispatchCashUnavailable => throw StageFailedException(StageError(StageId, Some("Unavailable"), "infrastructure-failure", "infrastructure-failure:Unavailable:manual-recovery"))
          case DispatchCashUnknown => throw StageFailedException(StageError(StageId, Some("Unknown"), "unknown-effect", "unknown-effect:Unknown:manual-recovery"))
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
