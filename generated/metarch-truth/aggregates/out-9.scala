package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class NoteEntityState(tenantId: String, status: String, externalId: String, boardId: String, sessionId: String, content: String, type: String, timeline: String, pivotal: String, name: String, links: String, createdAt: String, createdBy: String, collisionName: String, removedAt: String, knowledgeId: String, info: String) extends CborSerializable

sealed trait NoteEntityCommand extends CborSerializable
final case class CaptureNote() extends NoteEntityCommand
final case class ResolveCollision() extends NoteEntityCommand
final case class UpdateNoteContent() extends NoteEntityCommand
final case class RemoveNote() extends NoteEntityCommand
final case class UpdateNoteInfo() extends NoteEntityCommand

sealed trait NoteEntityEvent extends CborSerializable
final case class NoteCaptured() extends NoteEntityEvent
final case class CollisionDetected() extends NoteEntityEvent
final case class CollisionResolved() extends NoteEntityEvent
final case class NoteContentUpdated() extends NoteEntityEvent
final case class NoteRemoved() extends NoteEntityEvent
final case class NoteInfoUpdated() extends NoteEntityEvent

object NoteEntity {
  def behavior(persistenceId: PersistenceId): Behavior[NoteEntityCommand] =
    EventSourcedBehavior[NoteEntityCommand, NoteEntityEvent, NoteEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: NoteEntityState, cmd: NoteEntityCommand): Effect[NoteEntityEvent, NoteEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: NoteEntityState, event: NoteEntityEvent): NoteEntityState =
    event match {
      case _: NoteContentUpdated => state.copy(terminalState = "null")
      case _: CollisionDetected => state.copy(terminalState = "collisionPending")
      case _: CollisionResolved => state.copy(terminalState = "resolved")
      case _: NoteCaptured => state.copy(terminalState = "captured")
      case _: NoteRemoved => state.copy(terminalState = "removed")
      case _: NoteInfoUpdated => state.copy(terminalState = "null")
      case _ => state
    }
}
