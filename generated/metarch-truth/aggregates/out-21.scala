package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class RoleCommandBindingEntityState(tenantId: String, roleName: String, commandName: String, ruling: String, systemCommand: String, status: String, boundAt: String, boundBy: String, unboundAt: String, unboundReason: String) extends CborSerializable

sealed trait RoleCommandBindingEntityCommand extends CborSerializable


sealed trait RoleCommandBindingEntityEvent extends CborSerializable


object RoleCommandBindingEntity {
  def behavior(persistenceId: PersistenceId): Behavior[RoleCommandBindingEntityCommand] =
    EventSourcedBehavior[RoleCommandBindingEntityCommand, RoleCommandBindingEntityEvent, RoleCommandBindingEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: RoleCommandBindingEntityState, cmd: RoleCommandBindingEntityCommand): Effect[RoleCommandBindingEntityEvent, RoleCommandBindingEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: RoleCommandBindingEntityState, event: RoleCommandBindingEntityEvent): RoleCommandBindingEntityState =
    event match {

      case _ => state
    }
}
