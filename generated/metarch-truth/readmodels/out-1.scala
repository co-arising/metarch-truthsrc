package generated.readmodel

import scala.math.BigDecimal

/** Read model: AssembleMetadataDecisionView — served by undefined */
final case class ReadModelAssembleMetadata(catalogId: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String)

object ReadModelAssembleMetadataView {
  def empty: ReadModelAssembleMetadata = ReadModelAssembleMetadata("", "", "", "", "")
  // TODO(intent): projection logic from 
}
