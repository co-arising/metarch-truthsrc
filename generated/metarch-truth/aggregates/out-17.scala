package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class StageEntityState(tenantId: String, status: String, workshopId: String, order: String, name: String, activatedAt: String, approvedAt: String, rejectedAt: String, rejectionReason: String, sessionId: String) extends CborSerializable

sealed trait StageEntityCommand extends CborSerializable
final case class ActivateStage() extends StageEntityCommand
final case class ApproveStage() extends StageEntityCommand
final case class RejectStage() extends StageEntityCommand
final case class SkipStage() extends StageEntityCommand

sealed trait StageEntityEvent extends CborSerializable
final case class StageActivated() extends StageEntityEvent
final case class StageApproved() extends StageEntityEvent
final case class StageRejected() extends StageEntityEvent
final case class StageSkipped() extends StageEntityEvent

object StageEntity {
  def behavior(persistenceId: PersistenceId): Behavior[StageEntityCommand] =
    EventSourcedBehavior[StageEntityCommand, StageEntityEvent, StageEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: StageEntityState, cmd: StageEntityCommand): Effect[StageEntityEvent, StageEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: StageEntityState, event: StageEntityEvent): StageEntityState =
    event match {
      case _: StageActivated => state.copy(terminalState = "activated")
      case _: StageApproved => state.copy(terminalState = "approved")
      case _: StageRejected => state.copy(terminalState = "rejected")
      case _: StageSkipped => state.copy(terminalState = "skipped")
      case _ => state
    }
}
