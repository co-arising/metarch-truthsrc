package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ContextRelationEntityState(tenantId: String, upstreamContextId: String, downstreamContextId: String, kind: String, integration: String, description: String, createdAt: String, createdBy: String) extends CborSerializable

sealed trait ContextRelationEntityCommand extends CborSerializable


sealed trait ContextRelationEntityEvent extends CborSerializable


object ContextRelationEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ContextRelationEntityCommand] =
    EventSourcedBehavior[ContextRelationEntityCommand, ContextRelationEntityEvent, ContextRelationEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ContextRelationEntityState, cmd: ContextRelationEntityCommand): Effect[ContextRelationEntityEvent, ContextRelationEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ContextRelationEntityState, event: ContextRelationEntityEvent): ContextRelationEntityState =
    event match {

      case _ => state
    }
}
