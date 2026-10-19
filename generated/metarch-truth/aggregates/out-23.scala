package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class FieldModelDefinitionEntityState(tenantId: String, aggregateName: String, entityName: String, description: String, identifierName: String, identifierType: String, identifierOrigin: String, identifierDescription: String, tenantScoped: String, statusEnumValues: String, statusTransitions: String, stateFields: String, commands: String, events: String, relations: String, stateGates: String, declaredAt: String, declaredBy: String, terminalStates: String, removedAt: String, aggregateRuleRefs: String) extends CborSerializable

sealed trait FieldModelDefinitionEntityCommand extends CborSerializable


sealed trait FieldModelDefinitionEntityEvent extends CborSerializable


object FieldModelDefinitionEntity {
  def behavior(persistenceId: PersistenceId): Behavior[FieldModelDefinitionEntityCommand] =
    EventSourcedBehavior[FieldModelDefinitionEntityCommand, FieldModelDefinitionEntityEvent, FieldModelDefinitionEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
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
