package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class TenantEntityState(status: String, name: String, ownerUserId: String, orgMemberIds: String, createdAt: String, createdBy: String, suspendedAt: String, archivedAt: String) extends CborSerializable

sealed trait TenantEntityCommand extends CborSerializable
final case class OnboardTenant() extends TenantEntityCommand
final case class AssignTenantOwner() extends TenantEntityCommand
final case class SuspendTenant() extends TenantEntityCommand
final case class ResumeTenant() extends TenantEntityCommand
final case class ArchiveTenant() extends TenantEntityCommand
final case class UpdateTenantMemberRoster() extends TenantEntityCommand

sealed trait TenantEntityEvent extends CborSerializable
final case class TenantOnboarded() extends TenantEntityEvent
final case class TenantOwnerChanged() extends TenantEntityEvent
final case class TenantSuspended() extends TenantEntityEvent
final case class TenantResumed() extends TenantEntityEvent
final case class TenantArchived() extends TenantEntityEvent
final case class TenantMemberRosterUpdated() extends TenantEntityEvent

object TenantEntity {
  def behavior(persistenceId: PersistenceId): Behavior[TenantEntityCommand] =
    EventSourcedBehavior[TenantEntityCommand, TenantEntityEvent, TenantEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: TenantEntityState, cmd: TenantEntityCommand): Effect[TenantEntityEvent, TenantEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: TenantEntityState, event: TenantEntityEvent): TenantEntityState =
    event match {
      case _: TenantOwnerChanged => state.copy(terminalState = "null")
      case _: TenantArchived => state.copy(terminalState = "archived")
      case _: TenantOnboarded => state.copy(terminalState = "active")
      case _: TenantResumed => state.copy(terminalState = "active")
      case _: TenantSuspended => state.copy(terminalState = "suspended")
      case _ => state
    }
}
