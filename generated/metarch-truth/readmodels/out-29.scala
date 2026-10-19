package generated.readmodel

import scala.math.BigDecimal

/** Read model: SubmitKnowledgePatchDecisionView — served by undefined */
final case class ReadModelSubmitKnowledgePatch(patchId: String, catalogId: String, contextId: String, createdBy: String, parentPatchId: String)

object ReadModelSubmitKnowledgePatchView {
  def empty: ReadModelSubmitKnowledgePatch = ReadModelSubmitKnowledgePatch("", "", "", "", "")
  // TODO(intent): projection logic from 
}
