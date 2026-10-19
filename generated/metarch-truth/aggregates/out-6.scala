package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class FsmDefinitionEntityState(status: String, aggregateName: String, states: String, transitions: String, createdAt: String, createdBy: String) extends CborSerializable

sealed trait FsmDefinitionEntityCommand extends CborSerializable
final case class ProposeFsmDefinition() extends FsmDefinitionEntityCommand
final case class UpdateFsmElements() extends FsmDefinitionEntityCommand
final case class EstablishFsmDefinition() extends FsmDefinitionEntityCommand

sealed trait FsmDefinitionEntityEvent extends CborSerializable
final case class FsmDefinitionProposed() extends FsmDefinitionEntityEvent
final case class FsmElementsUpdated() extends FsmDefinitionEntityEvent
final case class FsmDefinitionEstablished() extends FsmDefinitionEntityEvent

object FsmDefinitionEntity {
  def behavior(persistenceId: PersistenceId): Behavior[FsmDefinitionEntityCommand] =
    EventSourcedBehavior[FsmDefinitionEntityCommand, FsmDefinitionEntityEvent, FsmDefinitionEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: FsmDefinitionEntityState, cmd: FsmDefinitionEntityCommand): Effect[FsmDefinitionEntityEvent, FsmDefinitionEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: FsmDefinitionEntityState, event: FsmDefinitionEntityEvent): FsmDefinitionEntityState =
    event match {
      case _: FsmDefinitionProposed => state.copy(terminalState = "PROPOSED")
      case _: FsmElementsUpdated => state.copy(terminalState = "PROPOSED")
      case _: FsmDefinitionEstablished => state.copy(terminalState = "ESTABLISHED")
      case _ => state
    }
}
