package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ModelCatalogEntityState(tenantId: String, status: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String, knowledgePackages: String, stateHash: String, headPatchId: String, headPatchHash: String, conflicts: String, assembledAt: String, assembledBy: String, exportedAt: String, exportedBy: String, releasedAt: String, releasedBy: String, conflictId: String, conflictType: String, involvedSessionIds: String, details: String, resolvedAt: String, resolvedBy: String, resolutionAction: String, resolutionNote: String, sessionId: String, concepts: String, appliedAt: String, detectedAt: String, conceptIndex: String) extends CborSerializable

sealed trait ModelCatalogEntityCommand extends CborSerializable
final case class CreateCatalogVersion() extends ModelCatalogEntityCommand
final case class ApplyKnowledgePatch() extends ModelCatalogEntityCommand
final case class DetectCatalogConflicts() extends ModelCatalogEntityCommand
final case class ResolveCatalogConflict() extends ModelCatalogEntityCommand
final case class ReleaseCatalogVersion() extends ModelCatalogEntityCommand
final case class AssembleMetadata() extends ModelCatalogEntityCommand
final case class ExportMetadata() extends ModelCatalogEntityCommand
final case class ReleaseMetadataVersion() extends ModelCatalogEntityCommand

sealed trait ModelCatalogEntityEvent extends CborSerializable
final case class CatalogVersionCreated() extends ModelCatalogEntityEvent
final case class KnowledgePatched() extends ModelCatalogEntityEvent
final case class CatalogConflictDetected() extends ModelCatalogEntityEvent
final case class CatalogConflictResolved() extends ModelCatalogEntityEvent
final case class CatalogVersionReleased() extends ModelCatalogEntityEvent
final case class MetadataAssembled() extends ModelCatalogEntityEvent
final case class MetadataExported() extends ModelCatalogEntityEvent
final case class MetadataVersionReleased() extends ModelCatalogEntityEvent

object ModelCatalogEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ModelCatalogEntityCommand] =
    EventSourcedBehavior[ModelCatalogEntityCommand, ModelCatalogEntityEvent, ModelCatalogEntityState](
      persistenceId = persistenceId,
      emptyState = TODO,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ModelCatalogEntityState, cmd: ModelCatalogEntityCommand): Effect[ModelCatalogEntityEvent, ModelCatalogEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ModelCatalogEntityState, event: ModelCatalogEntityEvent): ModelCatalogEntityState =
    event match {
      case _: CatalogVersionCreated => state.copy(terminalState = "DRAFT")
      case _: KnowledgePatched => state.copy(terminalState = "null")
      case _: MetadataAssembled => state.copy(terminalState = "null")
      case _: MetadataExported => state.copy(terminalState = "null")
      case _: CatalogConflictDetected => state.copy(terminalState = "CONFLICT_DETECTED")
      case _: CatalogConflictResolved => state.copy(terminalState = "RESOLVED")
      case _: MetadataVersionReleased => state.copy(terminalState = "RELEASED")
      case _: CatalogVersionReleased => state.copy(terminalState = "RELEASED")
      case _ => state
    }
}
