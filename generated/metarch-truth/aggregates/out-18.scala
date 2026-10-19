package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class WorkgroupEntityState(tenantId: String, status: String, name: String, ownerUserId: String, memberUserIds: String, invitedUserIds: String, createdAt: String, createdBy: String, archivedAt: String) extends CborSerializable

sealed trait WorkgroupEntityCommand extends CborSerializable


sealed trait WorkgroupEntityEvent extends CborSerializable


object WorkgroupEntity {
  def behavior(persistenceId: PersistenceId): Behavior[WorkgroupEntityCommand] =
    EventSourcedBehavior[WorkgroupEntityCommand, WorkgroupEntityEvent, WorkgroupEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: WorkgroupEntityState, cmd: WorkgroupEntityCommand): Effect[WorkgroupEntityEvent, WorkgroupEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: WorkgroupEntityState, event: WorkgroupEntityEvent): WorkgroupEntityState =
    event match {

      case _ => state
    }
}
