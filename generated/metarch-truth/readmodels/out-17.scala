package generated.readmodel

import scala.math.BigDecimal

/** Read model: ParkConceptDecisionView — served by  */
final case class ReadModelParkConcept(conceptId: String, version: String, contextId: String, name: String, kind: String, description: String, sourceStage: String, sourceNoteIds: String, hasConflictWarning: String, establishedAt: String)

object ReadModelParkConceptView {
  def empty: ReadModelParkConcept = ReadModelParkConcept("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
