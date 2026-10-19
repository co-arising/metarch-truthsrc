package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class QuestionEntityState(tenantId: String, status: String, externalId: String, boardId: String, sessionId: String, content: String, linkedNoteIds: String, raisedBy: String, raisedAt: String, answeredBy: String, answeredAt: String, answer: String, dismissedBy: String, dismissedAt: String) extends CborSerializable

sealed trait QuestionEntityCommand extends CborSerializable
final case class RaiseQuestion() extends QuestionEntityCommand
final case class AnswerQuestion() extends QuestionEntityCommand
final case class DismissQuestion() extends QuestionEntityCommand
final case class ReopenQuestion() extends QuestionEntityCommand

sealed trait QuestionEntityEvent extends CborSerializable
final case class QuestionRaised() extends QuestionEntityEvent
final case class QuestionAnswered() extends QuestionEntityEvent
final case class QuestionDismissed() extends QuestionEntityEvent
final case class QuestionReopened() extends QuestionEntityEvent

object QuestionEntity {
  def behavior(persistenceId: PersistenceId): Behavior[QuestionEntityCommand] =
    EventSourcedBehavior[QuestionEntityCommand, QuestionEntityEvent, QuestionEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: QuestionEntityState, cmd: QuestionEntityCommand): Effect[QuestionEntityEvent, QuestionEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: QuestionEntityState, event: QuestionEntityEvent): QuestionEntityState =
    event match {
      case _: QuestionReopened => state.copy(terminalState = "raised")
      case _: QuestionAnswered => state.copy(terminalState = "answered")
      case _: QuestionDismissed => state.copy(terminalState = "dismissed")
      case _: QuestionRaised => state.copy(terminalState = "raised")
      case _ => state
    }
}
