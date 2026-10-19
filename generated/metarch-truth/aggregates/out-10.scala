package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class OrganizationMemberEntityState(tenantId: String, status: String, userId: String, department: String, jobTitle: String, displayName: String, email: String, phoneNumber: String, joinedAt: String, removedAt: String) extends CborSerializable

sealed trait OrganizationMemberEntityCommand extends CborSerializable
final case class InviteTenantMember() extends OrganizationMemberEntityCommand
final case class AcceptTenantInvitation() extends OrganizationMemberEntityCommand
final case class RevokeInvitation() extends OrganizationMemberEntityCommand
final case class ResendInvitation() extends OrganizationMemberEntityCommand
final case class RemoveTenantMember() extends OrganizationMemberEntityCommand

sealed trait OrganizationMemberEntityEvent extends CborSerializable
final case class TenantMemberInvited() extends OrganizationMemberEntityEvent
final case class TenantMemberInvitationAccepted() extends OrganizationMemberEntityEvent
final case class TenantMemberJoined() extends OrganizationMemberEntityEvent
final case class TenantMemberInvitationRevoked() extends OrganizationMemberEntityEvent
final case class TenantMemberInvitationExpired() extends OrganizationMemberEntityEvent
final case class TenantMemberInvitationResent() extends OrganizationMemberEntityEvent
final case class TenantMemberRemoved() extends OrganizationMemberEntityEvent

object OrganizationMemberEntity {
  def behavior(persistenceId: PersistenceId): Behavior[OrganizationMemberEntityCommand] =
    EventSourcedBehavior[OrganizationMemberEntityCommand, OrganizationMemberEntityEvent, OrganizationMemberEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: OrganizationMemberEntityState, cmd: OrganizationMemberEntityCommand): Effect[OrganizationMemberEntityEvent, OrganizationMemberEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: OrganizationMemberEntityState, event: OrganizationMemberEntityEvent): OrganizationMemberEntityState =
    event match {
      case _: TenantMemberInvited => state.copy(terminalState = "PENDING")
      case _: TenantMemberInvitationAccepted => state.copy(terminalState = "ACTIVE")
      case _: TenantMemberJoined => state.copy(terminalState = "ACTIVE")
      case _: TenantMemberInvitationRevoked => state.copy(terminalState = "PENDING")
      case _: TenantMemberInvitationExpired => state.copy(terminalState = "PENDING")
      case _: TenantMemberInvitationResent => state.copy(terminalState = "PENDING")
      case _: TenantMemberRemoved => state.copy(terminalState = "REMOVED")
      case _ => state
    }
}
