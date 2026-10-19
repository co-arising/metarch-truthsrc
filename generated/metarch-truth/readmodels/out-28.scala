package generated.readmodel

import scala.math.BigDecimal

/** Read model: SubmitDoRVerdictDecisionView — served by undefined */
final case class ReadModelSubmitDoRVerdict(dorId: String, projectId: String, targetSessionIds: String, scopeSnapshot: String, knowledgeSnapshot: String)

object ReadModelSubmitDoRVerdictView {
  def empty: ReadModelSubmitDoRVerdict = ReadModelSubmitDoRVerdict("", "", "", "", "")
  // TODO(intent): projection logic from 
}
