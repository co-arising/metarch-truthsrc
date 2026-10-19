package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class TruthSourceProvenanceEntityState(tenantId: String, sourceKey: String, payloadJson: String, recordedAt: String, recordedBy: String) extends CborSerializable

sealed trait TruthSourceProvenanceEntityCommand extends CborSerializable
final case class RecordTruthProvenance() extends TruthSourceProvenanceEntityCommand

sealed trait TruthSourceProvenanceEntityEvent extends CborSerializable
final case class TruthProvenanceRecorded() extends TruthSourceProvenanceEntityEvent

object TruthSourceProvenanceEntity {
  def behavior(persistenceId: PersistenceId): Behavior[TruthSourceProvenanceEntityCommand] =
    EventSourcedBehavior[TruthSourceProvenanceEntityCommand, TruthSourceProvenanceEntityEvent, TruthSourceProvenanceEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: TruthSourceProvenanceEntityState, cmd: TruthSourceProvenanceEntityCommand): Effect[TruthSourceProvenanceEntityEvent, TruthSourceProvenanceEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: TruthSourceProvenanceEntityState, event: TruthSourceProvenanceEntityEvent): TruthSourceProvenanceEntityState =
    event match {

      case _ => state
    }
}
