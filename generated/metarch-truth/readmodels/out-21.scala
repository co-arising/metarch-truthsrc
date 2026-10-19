package generated.readmodel

import scala.math.BigDecimal

/** Read model: ReleaseMetadataVersionDecisionView — served by undefined */
final case class ReadModelReleaseMetadataVersion(catalogId: String, projectId: String, version: String, baseVersion: String, patchSessionIds: String)

object ReadModelReleaseMetadataVersionView {
  def empty: ReadModelReleaseMetadataVersion = ReadModelReleaseMetadataVersion("", "", "", "", "")
  // TODO(intent): projection logic from 
}
