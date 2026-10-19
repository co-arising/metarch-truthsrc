package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ValueObjectDefinitionEntityState(tenantId: String, voName: String, members: String, declaredAt: String, declaredBy: String, removedAt: String, removedBy: String) extends CborSerializable

sealed trait ValueObjectDefinitionEntityCommand extends CborSerializable


sealed trait ValueObjectDefinitionEntityEvent extends CborSerializable


object ValueObjectDefinitionEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ValueObjectDefinitionEntityCommand] =
    EventSourcedBehavior[ValueObjectDefinitionEntityCommand, ValueObjectDefinitionEntityEvent, ValueObjectDefinitionEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ValueObjectDefinitionEntityState, cmd: ValueObjectDefinitionEntityCommand): Effect[ValueObjectDefinitionEntityEvent, ValueObjectDefinitionEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ValueObjectDefinitionEntityState, event: ValueObjectDefinitionEntityEvent): ValueObjectDefinitionEntityState =
    event match {

      case _ => state
    }
}
