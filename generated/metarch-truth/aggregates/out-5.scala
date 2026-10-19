package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class KnowledgePatchEntityState(tenantId: String, status: String, sessionIds: String, catalogId: String, contextId: String, createdBy: String, parentPatchId: String, patchHash: String, concepts: String, relations: String, createdAt: String, mergedAt: String) extends CborSerializable

sealed trait KnowledgePatchEntityCommand extends CborSerializable


sealed trait KnowledgePatchEntityEvent extends CborSerializable


object KnowledgePatchEntity {
  def behavior(persistenceId: PersistenceId): Behavior[KnowledgePatchEntityCommand] =
    EventSourcedBehavior[KnowledgePatchEntityCommand, KnowledgePatchEntityEvent, KnowledgePatchEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: KnowledgePatchEntityState, cmd: KnowledgePatchEntityCommand): Effect[KnowledgePatchEntityEvent, KnowledgePatchEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: KnowledgePatchEntityState, event: KnowledgePatchEntityEvent): KnowledgePatchEntityState =
    event match {

      case _ => state
    }
}
