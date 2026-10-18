package goldens.monarchdsl

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}

import scala.concurrent.{ExecutionContext, Future}

/** Golden sample: resumable batch run on monarch-persistence 0.2.
 *
 *  Covers the API surface the generator targets:
 *  - `PersistentMonarch.behavior[Stage, S](persistenceId, stages, interpreter,
 *    stateCodec, stageName, failurePolicy, observer)`
 *  - `StateCodec[S]` — host-provided snapshot serialization
 *  - `RunObserver[S]` — host observability (never influences control flow)
 *
 *  Semantics the golden pins:
 *  - One entity per run; the journal is per-entity.
 *  - Recovery resumes by cursor against the deterministic `stages` queue.
 *  - At-least-once: stage idempotency is the HOST's responsibility.
 *  - Without a failurePolicy, a failed stage fails the run.
 *
 *  Mirrors `ChainExecutionActor.behavior` (bank-batch-transactor-demo).
 */

// ── domain ─────────────────────────────────────────────────────────────
sealed trait BatchStage
object BatchStage {
  case object Load extends BatchStage
  case object Transform extends BatchStage
  case object Write extends BatchStage

  val chain: Seq[BatchStage] = Seq(Load, Transform, Write)

  def stageName(s: BatchStage): String = s match {
    case Load      => "load"
    case Transform => "transform"
    case Write     => "write"
  }
}

final case class BatchState(processed: Int, failed: Int)
object BatchState {
  implicit val format: play.api.libs.json.Format[BatchState] =
    play.api.libs.json.Json.format[BatchState]

  val codec: StateCodec[BatchState] = StateCodec[BatchState](
    enc = st => play.api.libs.json.Json.toJson(st).toString.getBytes("UTF-8"),
    dec = bytes => play.api.libs.json.Json.parse(bytes).as[BatchState]
  )
}

// ── persistent behavior ────────────────────────────────────────────────
object BatchRun {

  type BatchCommand = PersistentMonarch.Command[BatchState]

  /** One persistent entity per batch run. */
  def behavior(
      persistenceId: PersistenceId,
      observer: RunObserver[BatchState] = RunObserver.nop[BatchState]
  )(implicit ec: ExecutionContext): Behavior[BatchCommand] =
    PersistentMonarch.behavior[BatchStage, BatchState](
      persistenceId = persistenceId,
      stages = BatchStage.chain, // must be deterministic across restarts
      interpreter = (stage, state) => runStage(stage, state),
      stateCodec = BatchState.codec, // keep encoding stable across deploys
      stageName = BatchStage.stageName, // stable names form the cursor vocabulary
      observer = observer
    )

  /** Host's stage logic. Must be idempotent: at-least-once recovery may replay it. */
  private def runStage(stage: BatchStage, state: BatchState)(implicit
      ec: ExecutionContext
  ): Future[BatchState] =
    Future {
      stage match {
        case BatchStage.Load      => state.copy(processed = state.processed + 100)
        case BatchStage.Transform => state.copy(processed = state.processed) // pure transform
        case BatchStage.Write     => state // sink; idempotent write
      }
    }
}
