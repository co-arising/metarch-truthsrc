package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class RelationEntityState(tenantId: String, sourceId: String, targetId: String, relationType: String, condition: String, mapping: String, order: String, metadata: String, createdAt: String, createdBy: String) extends CborSerializable

sealed trait RelationEntityCommand extends CborSerializable
final case class RelateConcept() extends RelationEntityCommand
final case class UnrelateConcept() extends RelationEntityCommand
final case class UpdateRelation() extends RelationEntityCommand

sealed trait RelationEntityEvent extends CborSerializable
final case class RelationCreated() extends RelationEntityEvent
final case class RelationRemoved() extends RelationEntityEvent
final case class RelationUpdated() extends RelationEntityEvent

object RelationEntity {
  def behavior(persistenceId: PersistenceId): Behavior[RelationEntityCommand] =
    EventSourcedBehavior[RelationEntityCommand, RelationEntityEvent, RelationEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
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
