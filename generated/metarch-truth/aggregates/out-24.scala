package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class WorkTicketEntityState(status: String, subjectType: String, subjectId: String, stage: String, ticketType: String, title: String, checklist: String, createdAt: String, createdBy: String) extends CborSerializable

sealed trait WorkTicketEntityCommand extends CborSerializable
final case class CreateWorkTicket() extends WorkTicketEntityCommand
final case class UpdateWorkTicketItems() extends WorkTicketEntityCommand
final case class ConcludeWorkTicket() extends WorkTicketEntityCommand

sealed trait WorkTicketEntityEvent extends CborSerializable
final case class WorkTicketCreated() extends WorkTicketEntityEvent
final case class WorkTicketItemsUpdated() extends WorkTicketEntityEvent
final case class WorkTicketApproved() extends WorkTicketEntityEvent

object WorkTicketEntity {
  def behavior(persistenceId: PersistenceId): Behavior[WorkTicketEntityCommand] =
    EventSourcedBehavior[WorkTicketEntityCommand, WorkTicketEntityEvent, WorkTicketEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: WorkTicketEntityState, cmd: WorkTicketEntityCommand): Effect[WorkTicketEntityEvent, WorkTicketEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: WorkTicketEntityState, event: WorkTicketEntityEvent): WorkTicketEntityState =
    event match {
      case _: WorkTicketCreated => state.copy(terminalState = "DRAFT")
      case _: WorkTicketItemsUpdated => state.copy(terminalState = "IN_REVIEW")
      case _: WorkTicketApproved => state.copy(terminalState = "APPROVED")
      case _ => state
    }
}
