package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class UseCaseDefinitionEntityState(tenantId: String, useCaseName: String, realizes: String, actors: String, trigger: String, preconditions: String, postconditions: String, orchestrationType: String, mainFlowJson: String, extensionsJson: String, generatedIds: String, optionalInputs: String, declaredAt: String, declaredBy: String, removedAt: String, removedBy: String) extends CborSerializable

sealed trait UseCaseDefinitionEntityCommand extends CborSerializable
final case class DeclareUseCaseDefinition() extends UseCaseDefinitionEntityCommand
final case class RemoveUseCaseDefinition() extends UseCaseDefinitionEntityCommand

sealed trait UseCaseDefinitionEntityEvent extends CborSerializable
final case class UseCaseDeclared() extends UseCaseDefinitionEntityEvent
final case class UseCaseRemoved() extends UseCaseDefinitionEntityEvent

object UseCaseDefinitionEntity {
  def behavior(persistenceId: PersistenceId): Behavior[UseCaseDefinitionEntityCommand] =
    EventSourcedBehavior[UseCaseDefinitionEntityCommand, UseCaseDefinitionEntityEvent, UseCaseDefinitionEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: UseCaseDefinitionEntityState, cmd: UseCaseDefinitionEntityCommand): Effect[UseCaseDefinitionEntityEvent, UseCaseDefinitionEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: UseCaseDefinitionEntityState, event: UseCaseDefinitionEntityEvent): UseCaseDefinitionEntityState =
    event match {

      case _ => state
    }
}
