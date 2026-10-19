package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class UserEntityState(status: String, email: String, passwordSalt: String, passwordHash: String, authMethod: String, displayName: String, registeredAt: String, phoneNumber: String) extends CborSerializable

sealed trait UserEntityCommand extends CborSerializable
final case class RegisterUser() extends UserEntityCommand
final case class DeactivateUser() extends UserEntityCommand
final case class UpdateUserProfile() extends UserEntityCommand
final case class ReactivateUser() extends UserEntityCommand

sealed trait UserEntityEvent extends CborSerializable
final case class UserRegistered() extends UserEntityEvent
final case class UserDeactivated() extends UserEntityEvent
final case class UserProfileUpdated() extends UserEntityEvent
final case class UserReactivated() extends UserEntityEvent

object UserEntity {
  def behavior(persistenceId: PersistenceId): Behavior[UserEntityCommand] =
    EventSourcedBehavior[UserEntityCommand, UserEntityEvent, UserEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: UserEntityState, cmd: UserEntityCommand): Effect[UserEntityEvent, UserEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: UserEntityState, event: UserEntityEvent): UserEntityState =
    event match {
      case _: UserProfileUpdated => state.copy(terminalState = "null")
      case _: UserDeactivated => state.copy(terminalState = "deactivated")
      case _: UserReactivated => state.copy(terminalState = "active")
      case _: UserRegistered => state.copy(terminalState = "active")
      case _ => state
    }
}
