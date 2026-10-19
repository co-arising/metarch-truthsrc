package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class DoREntityState(tenantId: String, status: String, projectId: String, targetSessionIds: String, scopeSnapshot: String, knowledgeSnapshot: String, verdicts: String, evaluatedAt: String, evaluatedBy: String, findings: String, workshopId: String, patchId: String, criterion: String, evaluatorType: String, evaluatorId: String, evaluatorRole: String, aiModelVersion: String, harnessBrand: String, harnessVersion: String, effort: String, result: String, reason: String, evidenceLinks: String, recordedAt: String, recordedBy: String, evaluatedScope: String, summary: String, description: String, severity: String) extends CborSerializable

sealed trait DoREntityCommand extends CborSerializable
final case class SubmitDoRVerdict() extends DoREntityCommand
final case class ConcludeDoR() extends DoREntityCommand
final case class ReopenDoR() extends DoREntityCommand
final case class SubmitDoRFindings() extends DoREntityCommand
final case class EvaluateDoR() extends DoREntityCommand
final case class FixDoRVerdict() extends DoREntityCommand
final case class RequestDoR() extends DoREntityCommand
final case class BlockDoR() extends DoREntityCommand

sealed trait DoREntityEvent extends CborSerializable
final case class DoRRequested() extends DoREntityEvent
final case class DoRVerdictSubmitted() extends DoREntityEvent
final case class DoRPassed() extends DoREntityEvent
final case class DoRFindingsSubmitted() extends DoREntityEvent
final case class DoRReopened() extends DoREntityEvent
final case class DoRVerdictFixed() extends DoREntityEvent
final case class DoRBlocked() extends DoREntityEvent

object DoREntity {
  def behavior(persistenceId: PersistenceId): Behavior[DoREntityCommand] =
    EventSourcedBehavior[DoREntityCommand, DoREntityEvent, DoREntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: DoREntityState, cmd: DoREntityCommand): Effect[DoREntityEvent, DoREntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: DoREntityState, event: DoREntityEvent): DoREntityState =
    event match {
      case _: DoRFindingsSubmitted => state.copy(terminalState = "IN_PROGRESS")
      case _: DoRPassed => state.copy(terminalState = "CONCLUDED")
      case _: DoRVerdictSubmitted => state.copy(terminalState = "IN_PROGRESS")
      case _: DoRVerdictFixed => state.copy(terminalState = "IN_PROGRESS")
      case _: DoRReopened => state.copy(terminalState = "REOPENED")
      case _: DoRRequested => state.copy(terminalState = "REQUESTED")
      case _ => state
    }
}
