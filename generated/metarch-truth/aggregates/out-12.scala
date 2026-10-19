package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class SessionEntityState(tenantId: String, status: String, stageId: String, participantUserIds: String, observerUserIds: String, openedAt: String, preparedAt: String, closedAt: String, participantRoles: String) extends CborSerializable

sealed trait SessionEntityCommand extends CborSerializable


sealed trait SessionEntityEvent extends CborSerializable


object SessionEntity {
  def behavior(persistenceId: PersistenceId): Behavior[SessionEntityCommand] =
    EventSourcedBehavior[SessionEntityCommand, SessionEntityEvent, SessionEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: SessionEntityState, cmd: SessionEntityCommand): Effect[SessionEntityEvent, SessionEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: SessionEntityState, event: SessionEntityEvent): SessionEntityState =
    event match {

      case _ => state
    }
}
