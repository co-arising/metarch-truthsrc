package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class CemEdgeEntityState(tenantId: String, commandName: String, eventName: String, aggregateName: String, sources: String, confidence: String, status: String, declaredAt: String, declaredBy: String, retiredAt: String, retiredReason: String) extends CborSerializable

sealed trait CemEdgeEntityCommand extends CborSerializable
final case class DeclareEdge() extends CemEdgeEntityCommand
final case class PatchEdge() extends CemEdgeEntityCommand
final case class RetireEdge() extends CemEdgeEntityCommand

sealed trait CemEdgeEntityEvent extends CborSerializable
final case class EdgeDeclared() extends CemEdgeEntityEvent
final case class EdgePatched() extends CemEdgeEntityEvent
final case class EdgeRetired() extends CemEdgeEntityEvent

object CemEdgeEntity {
  def behavior(persistenceId: PersistenceId): Behavior[CemEdgeEntityCommand] =
    EventSourcedBehavior[CemEdgeEntityCommand, CemEdgeEntityEvent, CemEdgeEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: CemEdgeEntityState, cmd: CemEdgeEntityCommand): Effect[CemEdgeEntityEvent, CemEdgeEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: CemEdgeEntityState, event: CemEdgeEntityEvent): CemEdgeEntityState =
    event match {

      case _ => state
    }
}
