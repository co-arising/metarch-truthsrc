package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class WorkshopEntityState(tenantId: String, status: String, projectId: String, scheduledAt: String, startedAt: String, completedAt: String, patchId: String, memberRoles: String) extends CborSerializable

sealed trait WorkshopEntityCommand extends CborSerializable


sealed trait WorkshopEntityEvent extends CborSerializable


object WorkshopEntity {
  def behavior(persistenceId: PersistenceId): Behavior[WorkshopEntityCommand] =
    EventSourcedBehavior[WorkshopEntityCommand, WorkshopEntityEvent, WorkshopEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: WorkshopEntityState, cmd: WorkshopEntityCommand): Effect[WorkshopEntityEvent, WorkshopEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: WorkshopEntityState, event: WorkshopEntityEvent): WorkshopEntityState =
    event match {

      case _ => state
    }
}
