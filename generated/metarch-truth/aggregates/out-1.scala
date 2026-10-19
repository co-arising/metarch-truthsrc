package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ConceptEntityState(tenantId: String, status: String, version: String, contextId: String, name: String, kind: String, description: String, sourceStage: String, sourceNoteIds: String, hasConflictWarning: String, establishedAt: String, establishedBy: String, parkedAt: String, parkedBy: String, removedAt: String, removedBy: String, createdAt: String, createdBy: String, modifiedAt: String, modifiedBy: String, machineSpec: String, metadata: String, sourceSessionId: String, contentHash: String, anchors: String) extends CborSerializable

sealed trait ConceptEntityCommand extends CborSerializable
final case class ParkConcept() extends ConceptEntityCommand
final case class UnparkConcept() extends ConceptEntityCommand
final case class EstablishConcept() extends ConceptEntityCommand
final case class DeprecateConcept() extends ConceptEntityCommand
final case class UpdateConcept() extends ConceptEntityCommand
final case class ResolveConflict() extends ConceptEntityCommand
final case class RemoveConcept() extends ConceptEntityCommand
final case class MergeConcepts() extends ConceptEntityCommand
final case class DetectConceptConflict() extends ConceptEntityCommand
final case class RecordConceptLandings() extends ConceptEntityCommand

sealed trait ConceptEntityEvent extends CborSerializable
final case class ConceptParked() extends ConceptEntityEvent
final case class ConceptUnparked() extends ConceptEntityEvent
final case class ConceptEstablished() extends ConceptEntityEvent
final case class ConceptDeprecated() extends ConceptEntityEvent
final case class ConceptUpdated() extends ConceptEntityEvent
final case class ConceptConflictWarningCreated() extends ConceptEntityEvent
final case class ConceptConflictWarningResolved() extends ConceptEntityEvent
final case class ConceptRemoved() extends ConceptEntityEvent
final case class ConceptsMerged() extends ConceptEntityEvent
final case class ConceptLandingsRecorded() extends ConceptEntityEvent

object ConceptEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ConceptEntityCommand] =
    EventSourcedBehavior[ConceptEntityCommand, ConceptEntityEvent, ConceptEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ConceptEntityState, cmd: ConceptEntityCommand): Effect[ConceptEntityEvent, ConceptEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ConceptEntityState, event: ConceptEntityEvent): ConceptEntityState =
    event match {
      case _: ConceptConflictWarningCreated => state.copy(terminalState = "null")
      case _: ConceptConflictWarningResolved => state.copy(terminalState = "null")
      case _: ConceptRemoved => state.copy(terminalState = "null")
      case _: ConceptUnparked => state.copy(terminalState = "ESTABLISHED")
      case _: ConceptUpdated => state.copy(terminalState = "null")
      case _: ConceptsMerged => state.copy(terminalState = "null")
      case _: ConceptEstablished => state.copy(terminalState = "ESTABLISHED")
      case _: ConceptDeprecated => state.copy(terminalState = "DEPRECATED")
      case _: ConceptParked => state.copy(terminalState = "PARKED")
      case _ => state
    }
}
