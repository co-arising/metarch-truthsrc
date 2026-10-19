package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ProjectEntityState(tenantId: String, status: String, workgroupId: String, ownerUserId: String, name: String, description: String, createdAt: String, createdBy: String, startedAt: String, completedAt: String, pausedAt: String, cancelledAt: String, catalogId: String) extends CborSerializable

sealed trait ProjectEntityCommand extends CborSerializable
final case class InitiateProject() extends ProjectEntityCommand
final case class AssignProjectOwner() extends ProjectEntityCommand
final case class CompleteProject() extends ProjectEntityCommand
final case class PauseProject() extends ProjectEntityCommand
final case class ResumeProject() extends ProjectEntityCommand
final case class CancelProject() extends ProjectEntityCommand
final case class UpdateProjectDescription() extends ProjectEntityCommand

sealed trait ProjectEntityEvent extends CborSerializable
final case class ProjectInitiated() extends ProjectEntityEvent
final case class ProjectOwnerAssigned() extends ProjectEntityEvent
final case class ProjectCompleted() extends ProjectEntityEvent
final case class ProjectPaused() extends ProjectEntityEvent
final case class ProjectResumed() extends ProjectEntityEvent
final case class ProjectCancelled() extends ProjectEntityEvent
final case class ProjectDescriptionUpdated() extends ProjectEntityEvent

object ProjectEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ProjectEntityCommand] =
    EventSourcedBehavior[ProjectEntityCommand, ProjectEntityEvent, ProjectEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ProjectEntityState, cmd: ProjectEntityCommand): Effect[ProjectEntityEvent, ProjectEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ProjectEntityState, event: ProjectEntityEvent): ProjectEntityState =
    event match {
      case _: ProjectDescriptionUpdated => state.copy(terminalState = "null")
      case _: ProjectOwnerAssigned => state.copy(terminalState = "null")
      case _: ProjectCancelled => state.copy(terminalState = "cancelled")
      case _: ProjectCompleted => state.copy(terminalState = "completed")
      case _: ProjectInitiated => state.copy(terminalState = "initiated")
      case _: ProjectPaused => state.copy(terminalState = "paused")
      case _: ProjectResumed => state.copy(terminalState = "resumed")
      case _ => state
    }
}
