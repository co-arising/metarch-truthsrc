package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ContextEntityState(tenantId: String, name: String, description: String, subdomainIds: String, discoveredAt: String, discoveredBy: String) extends CborSerializable

sealed trait ContextEntityCommand extends CborSerializable


sealed trait ContextEntityEvent extends CborSerializable


object ContextEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ContextEntityCommand] =
    EventSourcedBehavior[ContextEntityCommand, ContextEntityEvent, ContextEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ContextEntityState, cmd: ContextEntityCommand): Effect[ContextEntityEvent, ContextEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ContextEntityState, event: ContextEntityEvent): ContextEntityState =
    event match {

      case _ => state
    }
}
