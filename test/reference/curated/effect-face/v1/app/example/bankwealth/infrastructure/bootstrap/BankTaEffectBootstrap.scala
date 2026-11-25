package example.bankwealth.infrastructure.bootstrap

import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._
import scala.util.control.NonFatal

import akka.actor.typed.{ActorRef, Behavior, PostStop}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.{PersistenceId, RecoveryCompleted}
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import com.google.protobuf.ByteString
import example.bankwealth.infrastructure.connectors._
import example.bankwealth.application.process.ta_submission.BankTaSubmissionExecution
import example.bankwealth.application.connectors.BankTaEffectProtocol._
import example.bankwealth.infrastructure.persistence.BankTaSubmissionStateCodec
import net.imadz.monarch.persistence.{PersistentMonarch, RunObserver}

/** Runtime persistence & actor assembly for `BankTaEffectHost` and `BankTaSubmissionExecution`. */
object BankTaEffectBootstrap {

  def install(submitTaHost: ActorRef[BankTaEffectHost.Request]): Installed = {
    require(submitTaHost != null, "the exact effect host actor is required")
    new Installed(submitTaHost)
  }

  final class Installed private[BankTaEffectBootstrap] (
    val submitTaHost: ActorRef[BankTaEffectHost.Request],
  )

  def hostBehavior(
    persistenceId: String,
    installed: BankTaEffectHost.Installed,
  ): Behavior[BankTaEffectHost.Request] =
    Behaviors.setup { context =>
      import BankTaEffectHost._
      require(persistenceId != null && persistenceId.nonEmpty && installed != null,
          "owned effect persistence and all installed callbacks required")
      implicit val ec: ExecutionContext = context.executionContext

      var pending = false
      var round = 0L
      var waiters = Vector.empty[ActorRef[Reply]]

      def answer(value: Reply): Unit = { waiters.distinct.foreach(_ ! value); waiters = Vector.empty }

      def safe[A](body: => Future[A]): Future[A] =
        try { val future = body; require(future != null, "effect callback future required"); future }
        catch { case NonFatal(e) => Future.failed(e) }

      def terminal(state: State): Option[BankTaSubmissionExecution.SubmitTaResult] =
        terminalOutcome(BankTaSubmissionStateCodec.decodeObservation(state.observation))

      def operation(state: State): BankTaEffectOperation =
        BankTaEffectOperation(state.operation,
            request(BankTaSubmissionStateCodec.codec.decode(state.original.toByteArray)))

      def execute(state: State): Unit = {
        pending = true
        round += 1
        val current = round
        val expected = operation(state)
        context.log.debug("effect execute attempt {} for operation {}", current, state.operation)
        context.pipeToSelf(safe(installed.execute(expected)).map(v => Some(checked(v, expected)))) {
          case scala.util.Success(value) => Observed(state.operation, current, value, fromQuery = false)
          case scala.util.Failure(_) => Observed(state.operation, current, None, fromQuery = false)
        }
      }

      def query(state: State): Unit = {
        pending = true
        round += 1
        val current = round
        val expected = operation(state)
        context.pipeToSelf(safe(installed.query(expected)).map { value =>
          require(value != null, "optional query observation required")
          value.map(v => checked(v, expected))
        }) {
          case scala.util.Success(value) => Observed(state.operation, current, value, fromQuery = true)
          case scala.util.Failure(_) => Observed(state.operation, current, None, fromQuery = true)
        }
      }

      def completed(state: State, fromQuery: Boolean): Unit = terminal(state) match {
        case Some(value) => answer(Completed(value))
        case None if !fromQuery => query(state)
        case None => answer(Pending("effect outcome remains unknown or absent; no implicit retry"))
      }

      EventSourcedBehavior[Request, Event, State](
        PersistenceId.ofUniqueId(persistenceId),
        State(),
        (state, command) => command match {
          case Invoke(input, replyTo) =>
            val original = ByteString.copyFrom(BankTaSubmissionStateCodec.codec.encode(input))
            val op = operationIdentity(input)
            if (state.operation.nonEmpty && (state.operation != op || state.original != original)) {
              Effect.none.thenRun(_ => replyTo ! Conflict("different complete original input under effect identity"))
            } else {
              waiters :+= replyTo
              if (state.operation.isEmpty) Effect.persist(Intent(original, op)).thenRun(execute)
              else terminal(state) match {
                case Some(value) => Effect.none.thenRun(_ => answer(Completed(value)))
                case None => if (!pending) query(state); Effect.none
              }
            }

          case Observed(op,
              observedRound, value, fromQuery) if pending && op == state.operation && observedRound == round =>
            pending = false
            val bytes = value.map(BankTaSubmissionStateCodec.encodeObservation).getOrElse(ByteString.EMPTY)
            if (value.isDefined && bytes != state.observation) {
              Effect.persist(ObservationStored(bytes)).thenRun(completed(_, fromQuery))
            } else {
              Effect.none.thenRun(completed(_, fromQuery))
            }

          case Reconcile(input, decision, authorization, replyTo) =>
            val original = ByteString.copyFrom(BankTaSubmissionStateCodec.codec.encode(input))
            val op = operationIdentity(input)
            val proof = BankTaSubmissionStateCodec.decodeObservation(state.observation)
            val authorizedFor = isReconcileAuthorized(decision, proof)
            if (state.operation != op || state.original != original) {
              Effect.none.thenRun(_ => replyTo ! Conflict("reconcile must retain exact durable original and operation"))
            } else if (pending ||
                terminal(state).nonEmpty || authorization == null || authorization.isEmpty || !authorizedFor) {
              Effect.none.thenRun(_ =>
                  replyTo ! Pending("reconcile requires authority and durable absent or unknown evidence"))
            } else {
              waiters :+= replyTo
              pending = true
              round += 1
              val current = round
              val evidence = state.observation
              context.pipeToSelf(safe(installed.reconcile(
                BankTaEffectReconcile(op, request(input), decision.wire, proof, authorization)))) {
                case scala.util.Success(allowed) =>
                  Authorized(op, current, allowed, decision, authorization, evidence)
                case scala.util.Failure(_) =>
                  Authorized(op, current, allowed = false, decision, authorization, evidence)
              }
              Effect.none
            }

          case Authorized(op,
              observedRound, allowed, decision, authorization, proof) if pending &&
                  op == state.operation && observedRound == round =>
            pending = false
            if (!allowed || proof != state.observation) {
              context.log.debug("reconciliation denied for operation {}", state.operation)
              Effect.none.thenRun(_ => answer(Pending("reconciliation not authorized")))
            } else if (decision == ReconcileDecision.Query) {
              Effect.none.thenRun(query)
            } else {
              context.log.debug("retry authorized for operation {}", state.operation)
              Effect.persist(RetryAuthorized(authorization, proof)).thenRun(execute)
            }

          case _ => Effect.none
        },
        (state, event) => applyEvent(state, event),
      ).receiveSignal { case (state, RecoveryCompleted) if state.operation.nonEmpty &&
          terminal(state).isEmpty => query(state) }
    }

  def executionBehavior(
    persistenceId: String,
    installed: Installed,
    observer: RunObserver[BankTaSubmissionExecution.State],
  )(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[BankTaSubmissionExecution.State]] =
    Behaviors.setup { context =>
      import BankTaSubmissionExecution._
      require(persistenceId != null && persistenceId.nonEmpty && installed != null && observer != null,
        "explicit owned finite execution and installed objects required")

      final case class EffectCall(state: State,
          attempt: Int, deadline: Deadline, promise: Promise[SubmitTaResult])
      val effectBridge = context.spawnAnonymous(Behaviors.setup[EffectCall] { bridgeContext =>
        Behaviors.receiveMessage[EffectCall] { call =>
          bridgeContext.spawnAnonymous(Behaviors.setup[BankTaEffectHost.Reply] { replyContext =>
            installed.submitTaHost ! BankTaEffectHost.Invoke(call.state, replyContext.self)
            Behaviors.receiveMessage[BankTaEffectHost.Reply] {
              case BankTaEffectHost.Completed(result) => call.promise.trySuccess(result); Behaviors.stopped
              case BankTaEffectHost.Conflict(reason) =>
                  call.promise.tryFailure(new IllegalArgumentException(reason)); Behaviors.stopped
              case BankTaEffectHost.Pending(_) if call.deadline.isOverdue() =>
                call.promise
              .tryFailure(new IllegalStateException("submit-ta stage deadline exceeded")); Behaviors.stopped
              case BankTaEffectHost.Pending(_) =>
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
          case StageId => invokeSubmitTa(state).map(foldResult(state, _))
          case _ => Future.failed(new IllegalArgumentException("unknown static step"))
        },
        BankTaSubmissionStateCodec.codec,
        identity[String],
        None,
        observer,
      )
    }
}
