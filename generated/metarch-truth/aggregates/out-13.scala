package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ReadModelDefinitionEntityState(tenantId: String, viewName: String, parentAggregate: String, viewId: String, sourceAggregates: String, consumesEvents: String, linkedStories: String, description: String, fields: String, decisionCommands: String, declaredAt: String, declaredBy: String, removedAt: String, removedBy: String) extends CborSerializable

sealed trait ReadModelDefinitionEntityCommand extends CborSerializable
final case class DeclareReadModel() extends ReadModelDefinitionEntityCommand
final case class PatchReadModelField() extends ReadModelDefinitionEntityCommand
final case class RemoveReadModel() extends ReadModelDefinitionEntityCommand

sealed trait ReadModelDefinitionEntityEvent extends CborSerializable
final case class ReadModelDeclared() extends ReadModelDefinitionEntityEvent
final case class ReadModelFieldPatched() extends ReadModelDefinitionEntityEvent
final case class ReadModelRemoved() extends ReadModelDefinitionEntityEvent

object ReadModelDefinitionEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ReadModelDefinitionEntityCommand] =
    EventSourcedBehavior[ReadModelDefinitionEntityCommand, ReadModelDefinitionEntityEvent, ReadModelDefinitionEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ReadModelDefinitionEntityState, cmd: ReadModelDefinitionEntityCommand): Effect[ReadModelDefinitionEntityEvent, ReadModelDefinitionEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ReadModelDefinitionEntityState, event: ReadModelDefinitionEntityEvent): ReadModelDefinitionEntityState =
    event match {

      case _ => state
    }
}
