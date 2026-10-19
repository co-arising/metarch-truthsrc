package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class WorkgroupEntityState(tenantId: String, status: String, name: String, ownerUserId: String, memberUserIds: String, invitedUserIds: String, createdAt: String, createdBy: String, archivedAt: String) extends CborSerializable

sealed trait WorkgroupEntityCommand extends CborSerializable
final case class CreateWorkgroup() extends WorkgroupEntityCommand
final case class AssignWorkgroupOwner() extends WorkgroupEntityCommand
final case class InviteWorkgroupMember() extends WorkgroupEntityCommand
final case class AcceptWorkgroupInvitation() extends WorkgroupEntityCommand
final case class RemoveWorkgroupMember() extends WorkgroupEntityCommand
final case class ArchiveWorkgroup() extends WorkgroupEntityCommand
final case class UpdateWorkgroupName() extends WorkgroupEntityCommand

sealed trait WorkgroupEntityEvent extends CborSerializable
final case class WorkgroupFormed() extends WorkgroupEntityEvent
final case class WorkgroupOwnerAssigned() extends WorkgroupEntityEvent
final case class WorkgroupMemberInvited() extends WorkgroupEntityEvent
final case class WorkgroupMemberJoined() extends WorkgroupEntityEvent
final case class WorkgroupMemberRemoved() extends WorkgroupEntityEvent
final case class WorkgroupArchived() extends WorkgroupEntityEvent
final case class WorkgroupNameUpdated() extends WorkgroupEntityEvent

object WorkgroupEntity {
  def behavior(persistenceId: PersistenceId): Behavior[WorkgroupEntityCommand] =
    EventSourcedBehavior[WorkgroupEntityCommand, WorkgroupEntityEvent, WorkgroupEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: WorkgroupEntityState, cmd: WorkgroupEntityCommand): Effect[WorkgroupEntityEvent, WorkgroupEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: WorkgroupEntityState, event: WorkgroupEntityEvent): WorkgroupEntityState =
    event match {
      case _: WorkgroupFormed => state.copy(terminalState = "active")
      case _: WorkgroupMemberInvited => state.copy(terminalState = "null")
      case _: WorkgroupMemberJoined => state.copy(terminalState = "null")
      case _: WorkgroupNameUpdated => state.copy(terminalState = "null")
      case _: WorkgroupOwnerAssigned => state.copy(terminalState = "null")
      case _: WorkgroupMemberRemoved => state.copy(terminalState = "null")
      case _: WorkgroupArchived => state.copy(terminalState = "archived")
      case _ => state
    }
}
