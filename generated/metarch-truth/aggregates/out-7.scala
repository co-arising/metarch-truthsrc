package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class NoteEntityState(tenantId: String, status: String, externalId: String, boardId: String, sessionId: String, content: String, type: String, timeline: String, pivotal: String, name: String, links: String, createdAt: String, createdBy: String, collisionName: String, removedAt: String, knowledgeId: String, info: String) extends CborSerializable

sealed trait NoteEntityCommand extends CborSerializable


sealed trait NoteEntityEvent extends CborSerializable


object NoteEntity {
  def behavior(persistenceId: PersistenceId): Behavior[NoteEntityCommand] =
    EventSourcedBehavior[NoteEntityCommand, NoteEntityEvent, NoteEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: NoteEntityState, cmd: NoteEntityCommand): Effect[NoteEntityEvent, NoteEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: NoteEntityState, event: NoteEntityEvent): NoteEntityState =
    event match {

      case _ => state
    }
}
