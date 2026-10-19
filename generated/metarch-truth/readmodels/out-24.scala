package generated.readmodel

import scala.math.BigDecimal

/** Read model: ResolveCatalogConflictDecisionView — served by undefined */
final case class ReadModelResolveCatalogConflict(catalogId: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String)

object ReadModelResolveCatalogConflictView {
  def empty: ReadModelResolveCatalogConflict = ReadModelResolveCatalogConflict("", "", "", "", "")
  // TODO(intent): projection logic from 
}
