package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ProjectEntityState(tenantId: String, status: String, workgroupId: String, ownerUserId: String, name: String, description: String, createdAt: String, createdBy: String, startedAt: String, completedAt: String, pausedAt: String, cancelledAt: String, catalogId: String) extends CborSerializable

sealed trait ProjectEntityCommand extends CborSerializable


sealed trait ProjectEntityEvent extends CborSerializable


object ProjectEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ProjectEntityCommand] =
    EventSourcedBehavior[ProjectEntityCommand, ProjectEntityEvent, ProjectEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ProjectEntityState, cmd: ProjectEntityCommand): Effect[ProjectEntityEvent, ProjectEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ProjectEntityState, event: ProjectEntityEvent): ProjectEntityState =
    event match {

      case _ => state
    }
}
