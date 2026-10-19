package generated.readmodel

import scala.math.BigDecimal

/** Read model: TruthSourceProvenanceDecisionView — served by  */
final case class ReadModelTruthSourceProvenance(provenanceId: String, sourceKey: String, payloadJson: String, recordedAt: String, recordedBy: String, tenantId: String)

object ReadModelTruthSourceProvenanceView {
  def empty: ReadModelTruthSourceProvenance = ReadModelTruthSourceProvenance("", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
