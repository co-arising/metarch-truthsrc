package generated.readmodel

import scala.math.BigDecimal

/** Read model: CreateCatalogVersionDecisionView — served by  */
final case class ReadModelCreateCatalogVersion(catalogId: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String, knowledgePackages: String, conflicts: String, assembledAt: String, assembledBy: String, exportedAt: String)

object ReadModelCreateCatalogVersionView {
  def empty: ReadModelCreateCatalogVersion = ReadModelCreateCatalogVersion("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
