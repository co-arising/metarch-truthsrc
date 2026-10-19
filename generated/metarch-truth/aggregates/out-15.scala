package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class TenantEntityState(status: String, name: String, ownerUserId: String, orgMemberIds: String, createdAt: String, createdBy: String, suspendedAt: String, archivedAt: String) extends CborSerializable

sealed trait TenantEntityCommand extends CborSerializable


sealed trait TenantEntityEvent extends CborSerializable


object TenantEntity {
  def behavior(persistenceId: PersistenceId): Behavior[TenantEntityCommand] =
    EventSourcedBehavior[TenantEntityCommand, TenantEntityEvent, TenantEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: TenantEntityState, cmd: TenantEntityCommand): Effect[TenantEntityEvent, TenantEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: TenantEntityState, event: TenantEntityEvent): TenantEntityState =
    event match {

      case _ => state
    }
}
