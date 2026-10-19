package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class OrganizationMemberEntityState(tenantId: String, status: String, userId: String, department: String, jobTitle: String, displayName: String, email: String, phoneNumber: String, joinedAt: String, removedAt: String) extends CborSerializable

sealed trait OrganizationMemberEntityCommand extends CborSerializable


sealed trait OrganizationMemberEntityEvent extends CborSerializable


object OrganizationMemberEntity {
  def behavior(persistenceId: PersistenceId): Behavior[OrganizationMemberEntityCommand] =
    EventSourcedBehavior[OrganizationMemberEntityCommand, OrganizationMemberEntityEvent, OrganizationMemberEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: OrganizationMemberEntityState, cmd: OrganizationMemberEntityCommand): Effect[OrganizationMemberEntityEvent, OrganizationMemberEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: OrganizationMemberEntityState, event: OrganizationMemberEntityEvent): OrganizationMemberEntityState =
    event match {

      case _ => state
    }
}
