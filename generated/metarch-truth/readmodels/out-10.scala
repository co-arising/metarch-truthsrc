package generated.readmodel

import scala.math.BigDecimal

/** Read model: ExportMetadataDecisionView — served by  */
final case class ReadModelExportMetadata(catalogId: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String, knowledgePackages: String, conflicts: String, assembledAt: String, assembledBy: String, exportedAt: String)

object ReadModelExportMetadataView {
  def empty: ReadModelExportMetadata = ReadModelExportMetadata("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
