package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class KnowledgePatchEntityState(tenantId: String, status: String, sessionIds: String, catalogId: String, contextId: String, createdBy: String, parentPatchId: String, patchHash: String, concepts: String, relations: String, createdAt: String, mergedAt: String) extends CborSerializable

sealed trait KnowledgePatchEntityCommand extends CborSerializable
final case class SubmitKnowledgePatch() extends KnowledgePatchEntityCommand
final case class MergeKnowledgePatch() extends KnowledgePatchEntityCommand
final case class ConfirmKnowledgeReady() extends KnowledgePatchEntityCommand
final case class RejectKnowledgePatch() extends KnowledgePatchEntityCommand
final case class RequestKnowledgeMerge() extends KnowledgePatchEntityCommand
final case class DeclineKnowledgeMerge() extends KnowledgePatchEntityCommand
final case class ConfirmPatchMerged() extends KnowledgePatchEntityCommand

sealed trait KnowledgePatchEntityEvent extends CborSerializable
final case class KnowledgePatchSubmitted() extends KnowledgePatchEntityEvent
final case class KnowledgePatchReadyToMerged() extends KnowledgePatchEntityEvent
final case class KnowledgePatchMerged() extends KnowledgePatchEntityEvent
final case class KnowledgePatchRejected() extends KnowledgePatchEntityEvent
final case class KnowledgePatchMergeRequested() extends KnowledgePatchEntityEvent
final case class KnowledgePatchMergeDeclined() extends KnowledgePatchEntityEvent
final case class KnowledgeMergeConflictDetected() extends KnowledgePatchEntityEvent
final case class KnowledgePatchMergeCommitted() extends KnowledgePatchEntityEvent

object KnowledgePatchEntity {
  def behavior(persistenceId: PersistenceId): Behavior[KnowledgePatchEntityCommand] =
    EventSourcedBehavior[KnowledgePatchEntityCommand, KnowledgePatchEntityEvent, KnowledgePatchEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: KnowledgePatchEntityState, cmd: KnowledgePatchEntityCommand): Effect[KnowledgePatchEntityEvent, KnowledgePatchEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: KnowledgePatchEntityState, event: KnowledgePatchEntityEvent): KnowledgePatchEntityState =
    event match {
      case _: KnowledgePatchSubmitted => state.copy(terminalState = "PENDING")
      case _: KnowledgePatchReadyToMerged => state.copy(terminalState = "READY_TO_MERGE")
      case _: KnowledgePatchMerged => state.copy(terminalState = "MERGED")
      case _: KnowledgePatchRejected => state.copy(terminalState = "REJECTED")
      case _: KnowledgePatchMergeRequested => state.copy(terminalState = "MERGE_REQUESTED")
      case _: KnowledgePatchMergeDeclined => state.copy(terminalState = "READY_TO_MERGE")
      case _: KnowledgeMergeConflictDetected => state.copy(terminalState = "MERGE_REQUESTED")
      case _ => state
    }
}
