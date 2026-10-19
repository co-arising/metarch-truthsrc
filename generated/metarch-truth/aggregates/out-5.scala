package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class FieldModelDefinitionEntityState(tenantId: String, aggregateName: String, entityName: String, description: String, identifierName: String, identifierType: String, identifierOrigin: String, identifierDescription: String, tenantScoped: String, statusEnumValues: String, statusTransitions: String, stateFields: String, commands: String, events: String, relations: String, stateGates: String, declaredAt: String, declaredBy: String, terminalStates: String, removedAt: String, aggregateRuleRefs: String) extends CborSerializable

sealed trait FieldModelDefinitionEntityCommand extends CborSerializable
final case class DeclareFieldModel() extends FieldModelDefinitionEntityCommand
final case class DeclareStateField() extends FieldModelDefinitionEntityCommand
final case class AddWrittenBy() extends FieldModelDefinitionEntityCommand
final case class ReplaceWrittenBy() extends FieldModelDefinitionEntityCommand
final case class CutWrittenBy() extends FieldModelDefinitionEntityCommand
final case class DeclareCommand() extends FieldModelDefinitionEntityCommand
final case class AddCommandParameter() extends FieldModelDefinitionEntityCommand
final case class DeclareEvent() extends FieldModelDefinitionEntityCommand
final case class AddEventPayload() extends FieldModelDefinitionEntityCommand
final case class PatchAggregateStatus() extends FieldModelDefinitionEntityCommand
final case class DeclareRelation() extends FieldModelDefinitionEntityCommand
final case class DeclareStateGate() extends FieldModelDefinitionEntityCommand
final case class RenameDescription() extends FieldModelDefinitionEntityCommand
final case class RemoveStateField() extends FieldModelDefinitionEntityCommand
final case class RemoveCommand() extends FieldModelDefinitionEntityCommand
final case class RemoveEvent() extends FieldModelDefinitionEntityCommand
final case class RemoveRelation() extends FieldModelDefinitionEntityCommand
final case class RemoveStateGate() extends FieldModelDefinitionEntityCommand
final case class RemoveFieldModel() extends FieldModelDefinitionEntityCommand

sealed trait FieldModelDefinitionEntityEvent extends CborSerializable
final case class FieldModelDeclared() extends FieldModelDefinitionEntityEvent
final case class StateFieldDeclared() extends FieldModelDefinitionEntityEvent
final case class WrittenByAdded() extends FieldModelDefinitionEntityEvent
final case class WrittenByReplaced() extends FieldModelDefinitionEntityEvent
final case class WrittenByCut() extends FieldModelDefinitionEntityEvent
final case class CommandDeclared() extends FieldModelDefinitionEntityEvent
final case class CommandParameterAdded() extends FieldModelDefinitionEntityEvent
final case class EventDeclared() extends FieldModelDefinitionEntityEvent
final case class EventPayloadAdded() extends FieldModelDefinitionEntityEvent
final case class AggregateStatusPatched() extends FieldModelDefinitionEntityEvent
final case class RelationDeclared() extends FieldModelDefinitionEntityEvent
final case class StateGateDeclared() extends FieldModelDefinitionEntityEvent
final case class DescriptionRenamed() extends FieldModelDefinitionEntityEvent
final case class StateFieldRemoved() extends FieldModelDefinitionEntityEvent
final case class CommandRemoved() extends FieldModelDefinitionEntityEvent
final case class EventRemoved() extends FieldModelDefinitionEntityEvent
final case class AggregateRelationRemoved() extends FieldModelDefinitionEntityEvent
final case class StateGateRemoved() extends FieldModelDefinitionEntityEvent
final case class FieldModelRemoved() extends FieldModelDefinitionEntityEvent

object FieldModelDefinitionEntity {
  def behavior(persistenceId: PersistenceId): Behavior[FieldModelDefinitionEntityCommand] =
    EventSourcedBehavior[FieldModelDefinitionEntityCommand, FieldModelDefinitionEntityEvent, FieldModelDefinitionEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: FieldModelDefinitionEntityState, cmd: FieldModelDefinitionEntityCommand): Effect[FieldModelDefinitionEntityEvent, FieldModelDefinitionEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: FieldModelDefinitionEntityState, event: FieldModelDefinitionEntityEvent): FieldModelDefinitionEntityState =
    event match {

      case _ => state
    }
}
