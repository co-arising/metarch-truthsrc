package generated.readmodel

import scala.math.BigDecimal

/** Read model: SubmitKnowledgePatchDecisionView — served by  */
final case class ReadModelSubmitKnowledgePatch(patchId: String, catalogId: String, contextId: String, createdBy: String, parentPatchId: String, concepts: String, relations: String, status: String, createdAt: String, mergedAt: String)

object ReadModelSubmitKnowledgePatchView {
  def empty: ReadModelSubmitKnowledgePatch = ReadModelSubmitKnowledgePatch("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
