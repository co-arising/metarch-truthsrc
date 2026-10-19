package generated.aggregate

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import net.imadz.common.CborSerializable
import scala.math.BigDecimal

final case class ModelCatalogEntityState(tenantId: String, status: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String, knowledgePackages: String, stateHash: String, headPatchId: String, headPatchHash: String, conflicts: String, assembledAt: String, assembledBy: String, exportedAt: String, exportedBy: String, releasedAt: String, releasedBy: String, conflictId: String, conflictType: String, involvedSessionIds: String, details: String, resolvedAt: String, resolvedBy: String, resolutionAction: String, resolutionNote: String, sessionId: String, concepts: String, appliedAt: String, detectedAt: String, conceptIndex: String) extends CborSerializable

sealed trait ModelCatalogEntityCommand extends CborSerializable


sealed trait ModelCatalogEntityEvent extends CborSerializable


object ModelCatalogEntity {
  def behavior(persistenceId: PersistenceId): Behavior[ModelCatalogEntityCommand] =
    EventSourcedBehavior[ModelCatalogEntityCommand, ModelCatalogEntityEvent, ModelCatalogEntityState](
      persistenceId = persistenceId,
      emptyState = ???,
      commandHandler = (state, cmd) => handleCommand(state, cmd),
      eventHandler = (state, event) => applyEvent(state, event)
    )

  private def handleCommand(state: ModelCatalogEntityState, cmd: ModelCatalogEntityCommand): Effect[ModelCatalogEntityEvent, ModelCatalogEntityState] =
    cmd match {

      case _ => Effect.unhandled
    }

  private def applyEvent(state: ModelCatalogEntityState, event: ModelCatalogEntityEvent): ModelCatalogEntityState =
    event match {

      case _ => state
    }
}
