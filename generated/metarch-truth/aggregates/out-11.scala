package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class RelationEntityState(tenantId: String, sourceId: String, targetId: String, relationType: String, condition: String, mapping: String, order: String, metadata: String, createdAt: String, createdBy: String) extends CborSerializable

sealed trait RelationEntityCommand extends CborSerializable


sealed trait RelationEntityEvent extends CborSerializable


object RelationEntity {
  def behavior(persistenceId: PersistenceId): Behavior[RelationEntityCommand] =
    EventSourcedBehavior[RelationEntityCommand, RelationEntityEvent, RelationEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: RelationEntityState, cmd: RelationEntityCommand): Effect[RelationEntityEvent, RelationEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: RelationEntityState, event: RelationEntityEvent): RelationEntityState =
    event match {

      case _ => state
    }
}
