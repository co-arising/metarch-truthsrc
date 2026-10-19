package generated.readmodel

import scala.math.BigDecimal

/** Read model: CreateCatalogVersionDecisionView — served by undefined */
final case class ReadModelCreateCatalogVersion(catalogId: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String)

object ReadModelCreateCatalogVersionView {
  def empty: ReadModelCreateCatalogVersion = ReadModelCreateCatalogVersion("", "", "", "", "")
  // TODO(intent): projection logic from 
}
