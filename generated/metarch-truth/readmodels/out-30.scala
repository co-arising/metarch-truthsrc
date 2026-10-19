package generated.readmodel

import scala.math.BigDecimal

/** Read model: TruthSourceProvenanceDecisionView — served by undefined */
final case class ReadModelTruthSourceProvenance(provenanceId: String, sourceKey: String, payloadJson: String, recordedAt: String, recordedBy: String)

object ReadModelTruthSourceProvenanceView {
  def empty: ReadModelTruthSourceProvenance = ReadModelTruthSourceProvenance("", "", "", "", "")
  // TODO(intent): projection logic from 
}
