package generated.readmodel

import scala.math.BigDecimal

/** Read model: ReleaseCatalogVersionDecisionView — served by  */
final case class ReadModelReleaseCatalogVersion(catalogId: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String, knowledgePackages: String, conflicts: String, assembledAt: String, assembledBy: String, exportedAt: String)

object ReadModelReleaseCatalogVersionView {
  def empty: ReadModelReleaseCatalogVersion = ReadModelReleaseCatalogVersion("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
