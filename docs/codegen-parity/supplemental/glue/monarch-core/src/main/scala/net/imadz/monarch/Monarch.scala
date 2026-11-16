package net.imadz.monarch

import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success}
import scala.util.control.NonFatal

/** Monarch — a resumable stage-queue execution engine.
  *
  * Named for the monarch butterfly: a life lived in *discrete stages* (egg → larva →
  * pupa → adult = the stage queue), *diapause* — suspending development at a checkpoint
  * and resuming it months later exactly where it stopped (= cursor-based crash recovery),
  * and a *migration completed across generations* — the route's cursor outlives any
  * individual runner (= a superseded run dies, a fresh one continues from the journal).
  *
  * Mechanics:
  *   - Plan mutations configure a later process/resume call. Each call captures its
  *     immutable queue; injectHead/appendTail do not alter an in-flight run.
  *   - Stable cursors identify stage entries; the host supplies a matching state
  *     and a contiguous accepted prefix when resuming.
  *   - JVM generation guards are checked before execution, settlement, resolution,
  *     checkpointing and continuation; issued external I/O is not cancelled.
  *   - Classified and unexpected stage-body failures are offered once to the
  *     optional business interceptor. Async checkpoint failures bypass that policy.
  *
  * Zero framework dependencies: everything is `Future` + host callbacks, so the engine
  * runs the same inside an EventSourcedBehavior wrapper, a Play controller, or a test.
  *
  * (This is the generalization of the Fab demo's `FabPipelineProcessor`; see
  * docs/CHAINDSL_GUIDE.md for the three-generation story.)
  */
class Monarch[Stage, State](
    interpreter: StageInterpreter[Stage, State],
    hooks: LifecycleHooks[Stage, State],
    failureInterceptor: Option[FailureInterceptor[Stage, State]] = None,
    runToken: () => Boolean = () => true
) {

  /** Queue entries carry a position so repeated stage variants get unique cursors. */
  private var entries: Vector[(Stage, Int)] = Vector.empty
  private var nextPos: Int = 0

  /** Initialise the queue with a full stage list (clears any previous content). */
  def initialize(stages: Seq[Stage]): Unit = {
    entries = allocate(stages)
  }

  /** Weave stages in at the head (runtime branches, OCAP injections). */
  def injectHead(stages: Seq[Stage]): Unit = {
    entries = allocate(stages) ++ entries
  }

  /** Append stages to the tail. */
  def appendTail(stages: Seq[Stage]): Unit = {
    entries = entries ++ allocate(stages)
  }

  /** Current queue size. */
  def pendingCount: Int = entries.size

  /** Stable cursor for a queued stage: `"<stageName>#<position>"`. */
  def cursorOf(stage: Stage, pos: Int): String = s"${hooks.stageName(stage)}#$pos"

  /** Execute the whole queue from `initial`. */
  def process(initial: State)(implicit ec: ExecutionContext): Future[State] =
    executeQueue(entries, initial)

  /** Resume, skipping the completed prefix identified by cursor names. */
  def resume(state: State, completedCursors: Set[String])(implicit ec: ExecutionContext): Future[State] =
    executeQueue(entries.dropWhile { case (stage, pos) => completedCursors.contains(cursorOf(stage, pos)) }, state)

  /** Resume, skipping the first `completedCount` entries (journal replay count). */
  def resumeFromIndex(state: State, completedCount: Int)(implicit ec: ExecutionContext): Future[State] =
    executeQueue(entries.drop(completedCount), state)

  // ====================================================================
  // Internal
  // ====================================================================

  private def allocate(stages: Seq[Stage]): Vector[(Stage, Int)] = {
    val builder = Vector.newBuilder[(Stage, Int)]
    var position = nextPos
    stages.iterator.foreach { stage =>
      builder += ((stage, position))
      position += 1
    }
    val allocated = builder.result()
    nextPos = position
    allocated
  }

  private def attempt[A](body: => Future[A]): Future[A] =
    try body catch { case NonFatal(ex) => Future.failed(ex) }

  private def guarded[A](body: => Future[A]): Future[A] =
    if (!runToken()) Future.failed(StaleRun) else attempt(body)

  private def checkpoint(cursor: String)(body: => Future[Unit])
      (implicit ec: ExecutionContext): Future[Unit] =
    guarded(body).transformWith {
      case _ if !runToken() => Future.failed(StaleRun)
      case Failure(StaleRun) => Future.failed(StaleRun)
      case Failure(NonFatal(ex)) => Future.failed(CheckpointFailed(cursor, ex))
      case Failure(ex) => Future.failed(ex)
      case Success(_) => Future.successful(())
    }

  private def afterCompleted(cursor: String, state: State, tail: Vector[(Stage, Int)])
      (implicit ec: ExecutionContext): Future[State] = hooks match {
    case async: AsyncCheckpointHooks[Stage, State] =>
      checkpoint(cursor)(async.checkpointCompleted(cursor, state, Map.empty)).flatMap(_ => executeQueue(tail, state))
    case _ => executeQueue(tail, state)
  }

  private def afterResolved(cursor: String, error: StageError, state: State, tail: Vector[(Stage, Int)])
      (implicit ec: ExecutionContext): Future[State] = hooks match {
    case async: AsyncCheckpointHooks[Stage, State] =>
      checkpoint(cursor)(async.checkpointResolved(cursor, error, state)).flatMap(_ => executeQueue(tail, state))
    case _ => executeQueue(tail, state)
  }

  private def executeQueue(remaining: Vector[(Stage, Int)], state: State)
      (implicit ec: ExecutionContext): Future[State] = guarded {
    if (remaining.isEmpty) Future.successful(state)
    else {
      val (stage, pos) = remaining.head
      val tail = remaining.tail
      val cursor = cursorOf(stage, pos)
      hooks.onStageStart(cursor)
      // Only the interpreter result is classified. A checkpoint or downstream
      // failure must not be re-handled as a failure of this stage.
      guarded(interpreter.run(stage, state)).transformWith {
        case _ if !runToken() => Future.failed(StaleRun)
        case Failure(StaleRun) => Future.failed(StaleRun)
        case Success(nextState) => guarded {
          hooks.onStageComplete(cursor, nextState)
          afterCompleted(cursor, nextState, tail)
        }
        case Failure(StageFailedException(err)) =>
          handleFailedThenContinue(cursor, err, state, tail)
        case Failure(NonFatal(ex)) =>
          handleFailedThenContinue(cursor, StageError(cursor, None, "UNEXPECTED",
            Option(ex.getMessage).getOrElse(ex.toString)), state, tail)
        case Failure(ex) => Future.failed(ex)
      }
    }
  }

  private def handleFailedThenContinue(cursor: String, error: StageError, state: State,
      tail: Vector[(Stage, Int)])(implicit ec: ExecutionContext): Future[State] = guarded {
    hooks.onStageFailed(cursor, error)
    failureInterceptor match {
      case Some(interceptor) =>
        guarded(interceptor.intercept(cursor, error, state)).transformWith {
          case _ if !runToken() => Future.failed(StaleRun)
          case Success(recoveredState) => guarded {
            // Resolution advances progress, but is not a clean completion.
            hooks.onStageResolved(cursor, error, recoveredState)
            afterResolved(cursor, error, recoveredState, tail)
          }
          case Failure(ex) => Future.failed(ex)
        }
      case None => Future.failed(StageFailedException(error))
    }
  }
}

object Monarch {

  /** Fluent builder entry point for assembling a generation-guarded [[Monarch]] engine. */
  def builder[Stage, State]: MonarchBuilder[Stage, State] = MonarchBuilder.empty[Stage, State]

  /** Convenience factory: hook functions instead of the trait (multi-method traits are not
    * SAM-convertible, so this takes them explicitly). */
  def apply[Stage, State](
      interpreter: (Stage, State) => Future[State],
      nameOf: Stage => String,
      onStart: String => Unit = _ => (),
      onComplete: (String, State) => Unit = (_: String, _: State) => (),
      onFailed: (String, StageError) => Unit = (_, _) => (),
      onResolved: (String, StageError, State) => Unit = (_: String, _: StageError, _: State) => (),
      failureInterceptor: Option[(String, StageError, State) => Future[State]] = None,
      runToken: () => Boolean = () => true
  ): Monarch[Stage, State] =
    new Monarch[Stage, State](
      interpreter = new StageInterpreter[Stage, State] {
        override def run(stage: Stage, state: State)(implicit ec: ExecutionContext): Future[State] =
          interpreter(stage, state)
      },
      hooks = new LifecycleHooks[Stage, State] {
        override def stageName(stage: Stage): String = nameOf(stage)
        override def onStageStart(cursor: String): Unit = onStart(cursor)
        override def onStageComplete(cursor: String, state: State, metadata: Map[String, String]): Unit = onComplete(cursor, state)
        override def onStageFailed(cursor: String, error: StageError): Unit = onFailed(cursor, error)
        override def onStageResolved(cursor: String, error: StageError, state: State): Unit = onResolved(cursor, error, state)
      },
      failureInterceptor = failureInterceptor.map { fi =>
        new FailureInterceptor[Stage, State] {
          override def intercept(cursor: String, error: StageError, state: State)(implicit ec: ExecutionContext): Future[State] =
            fi(cursor, error, state)
        }
      },
      runToken = runToken
    )
}
