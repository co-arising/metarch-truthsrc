package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class UserEntityState(status: String, email: String, passwordSalt: String, passwordHash: String, authMethod: String, displayName: String, registeredAt: String, phoneNumber: String) extends CborSerializable

sealed trait UserEntityCommand extends CborSerializable


sealed trait UserEntityEvent extends CborSerializable


object UserEntity {
  def behavior(persistenceId: PersistenceId): Behavior[UserEntityCommand] =
    EventSourcedBehavior[UserEntityCommand, UserEntityEvent, UserEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: UserEntityState, cmd: UserEntityCommand): Effect[UserEntityEvent, UserEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: UserEntityState, event: UserEntityEvent): UserEntityState =
    event match {

      case _ => state
    }
}
