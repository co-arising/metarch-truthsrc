package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class SubdomainEntityState(tenantId: String, name: String, description: String, kind: String, buyOrBuild: String, aggregateIds: String, classifiedAt: String, classifiedBy: String) extends CborSerializable

sealed trait SubdomainEntityCommand extends CborSerializable
final case class ClassifySubdomain() extends SubdomainEntityCommand
final case class UpdateSubdomainKind() extends SubdomainEntityCommand

sealed trait SubdomainEntityEvent extends CborSerializable
final case class SubdomainClassified() extends SubdomainEntityEvent
final case class SubdomainKindUpdated() extends SubdomainEntityEvent

object SubdomainEntity {
  def behavior(persistenceId: PersistenceId): Behavior[SubdomainEntityCommand] =
    EventSourcedBehavior[SubdomainEntityCommand, SubdomainEntityEvent, SubdomainEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: SubdomainEntityState, cmd: SubdomainEntityCommand): Effect[SubdomainEntityEvent, SubdomainEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: SubdomainEntityState, event: SubdomainEntityEvent): SubdomainEntityState =
    event match {

      case _ => state
    }
}
