package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class DoREntityState(tenantId: String, status: String, projectId: String, targetSessionIds: String, scopeSnapshot: String, knowledgeSnapshot: String, verdicts: String, evaluatedAt: String, evaluatedBy: String, findings: String, workshopId: String, patchId: String, criterion: String, evaluatorType: String, evaluatorId: String, evaluatorRole: String, aiModelVersion: String, harnessBrand: String, harnessVersion: String, effort: String, result: String, reason: String, evidenceLinks: String, recordedAt: String, recordedBy: String, evaluatedScope: String, summary: String, description: String, severity: String) extends CborSerializable

sealed trait DoREntityCommand extends CborSerializable


sealed trait DoREntityEvent extends CborSerializable


object DoREntity {
  def behavior(persistenceId: PersistenceId): Behavior[DoREntityCommand] =
    EventSourcedBehavior[DoREntityCommand, DoREntityEvent, DoREntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: DoREntityState, cmd: DoREntityCommand): Effect[DoREntityEvent, DoREntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: DoREntityState, event: DoREntityEvent): DoREntityState =
    event match {

      case _ => state
    }
}
