package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class FsmDefinitionEntityState(status: String, aggregateName: String, states: String, transitions: String, createdAt: String, createdBy: String) extends CborSerializable

sealed trait FsmDefinitionEntityCommand extends CborSerializable


sealed trait FsmDefinitionEntityEvent extends CborSerializable


object FsmDefinitionEntity {
  def behavior(persistenceId: PersistenceId): Behavior[FsmDefinitionEntityCommand] =
    EventSourcedBehavior[FsmDefinitionEntityCommand, FsmDefinitionEntityEvent, FsmDefinitionEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: FsmDefinitionEntityState, cmd: FsmDefinitionEntityCommand): Effect[FsmDefinitionEntityEvent, FsmDefinitionEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: FsmDefinitionEntityState, event: FsmDefinitionEntityEvent): FsmDefinitionEntityState =
    event match {

      case _ => state
    }
}
