package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ConceptEntityState(tenantId: String, status: String, version: String, contextId: String, name: String, kind: String, description: String, sourceStage: String, sourceNoteIds: String, hasConflictWarning: String, establishedAt: String, establishedBy: String, parkedAt: String, parkedBy: String, removedAt: String, removedBy: String, createdAt: String, createdBy: String, modifiedAt: String, modifiedBy: String, machineSpec: String, metadata: String, sourceSessionId: String, contentHash: String, anchors: String) extends CborSerializable

sealed trait ConceptEntityCommand extends CborSerializable


sealed trait ConceptEntityEvent extends CborSerializable


object ConceptEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ConceptEntityCommand] =
    EventSourcedBehavior[ConceptEntityCommand, ConceptEntityEvent, ConceptEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ConceptEntityState, cmd: ConceptEntityCommand): Effect[ConceptEntityEvent, ConceptEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ConceptEntityState, event: ConceptEntityEvent): ConceptEntityState =
    event match {

      case _ => state
    }
}
