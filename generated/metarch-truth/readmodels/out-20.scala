package generated.readmodel

import scala.math.BigDecimal

/** Read model: ReleaseCatalogVersionDecisionView — served by undefined */
final case class ReadModelReleaseCatalogVersion(catalogId: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String)

object ReadModelReleaseCatalogVersionView {
  def empty: ReadModelReleaseCatalogVersion = ReadModelReleaseCatalogVersion("", "", "", "", "")
  // TODO(intent): projection logic from 
}
