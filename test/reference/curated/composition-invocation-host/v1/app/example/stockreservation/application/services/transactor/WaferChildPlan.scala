package example.stockreservation.application.services.transactor

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}
import net.imadz.monarch.persistence.PersistentMonarch.Command
import scala.concurrent.{ExecutionContext, Future}

/** monarch 子计划（组合面族工件）：三个有界 stage（receive/process/finalize）
  * 驱动子 wafers 集——fixture 语义，无设备 I/O（F7 裁定：准入 1..8 stage，本
  * profile 固定三项，与合同 §9.1 bounded3 fixture 一致）。持久化/恢复归
  * monarch-persistence 0.3.0（事件 journal：RunStarted/StageDone/RunCompleted/
  * RunFailedEvt）；父宿主观察 THIS journal 取终态——镜像永不权威。0.3.0 的
  * behavior 七显参形状（+隐式 ec）与 raw 模板 C05 逐参吻合（探针实证）。 */
object WaferChildPlan {
  sealed trait ChildStage
  object ChildStage {
    case object Receive extends ChildStage
    case object Process extends ChildStage
    case object Finalize extends ChildStage

    val chain: Seq[ChildStage] = Seq(Receive, Process, Finalize)

    def stageName(s: ChildStage): String = s match {
      case Receive => "receive"
      case Process => "process"
      case Finalize => "finalize"
    }
  }

  final case class ChildPlanState(wafers: Vector[String], processedCount: Int) {
  }

  object ChildPlanState {
    // Wire format "w-101,w-102:2" — ids carry no colons/commas (bounded ids).
    val codec: StateCodec[ChildPlanState] = StateCodec[ChildPlanState](
      enc = st => (st.wafers.mkString(",") + ":" + String.valueOf(st.processedCount))
        .getBytes(java.nio.charset.StandardCharsets.UTF_8),
      dec = bytes => {
        val text = new String(bytes, java.nio.charset.StandardCharsets.UTF_8)
        val sep = text.lastIndexOf(':')
        val waferText = text.substring(0, sep)
        ChildPlanState(
          if (waferText.isEmpty) Vector.empty[String] else waferText.split(",").toVector,
          text.substring(sep + 1).toInt)
      }
    )
  }

  /** Host's stage logic. Must be idempotent: at-least-once recovery may replay it. */
  private def runStage(stage: ChildStage, state: ChildPlanState)(
      implicit ec: ExecutionContext): Future[ChildPlanState] =
    Future {
      stage match {
        case ChildStage.Receive => state // absorb the StartRun initial state
        case ChildStage.Process => state.copy(processedCount = state.wafers.size)
        case ChildStage.Finalize => state // fixture transform: no equipment I/O
      }
    }

  def behavior(pid: PersistenceId)(implicit ec: ExecutionContext): Behavior[Command[ChildPlanState]] =
    PersistentMonarch.behavior[ChildStage, ChildPlanState](
      pid,
      ChildStage.chain,
      (stage: ChildStage, state: ChildPlanState) => runStage(stage, state),
      ChildPlanState.codec,
      (stage: ChildStage) => ChildStage.stageName(stage),
      scala.None,
      RunObserver.nop[ChildPlanState])
}
