package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class StageEntityState(tenantId: String, status: String, workshopId: String, order: String, name: String, activatedAt: String, approvedAt: String, rejectedAt: String, rejectionReason: String, sessionId: String) extends CborSerializable

sealed trait StageEntityCommand extends CborSerializable


sealed trait StageEntityEvent extends CborSerializable


object StageEntity {
  def behavior(persistenceId: PersistenceId): Behavior[StageEntityCommand] =
    EventSourcedBehavior[StageEntityCommand, StageEntityEvent, StageEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: StageEntityState, cmd: StageEntityCommand): Effect[StageEntityEvent, StageEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: StageEntityState, event: StageEntityEvent): StageEntityState =
    event match {

      case _ => state
    }
}
