package generated.readmodel

import scala.math.BigDecimal

/** Read model: SubmitDoRVerdictDecisionView — served by  */
final case class ReadModelSubmitDoRVerdict(dorId: String, projectId: String, targetSessionIds: String, scopeSnapshot: String, knowledgeSnapshot: String, verdicts: String, evaluatedAt: String, evaluatedBy: String, criterion: String, evaluatorType: String)

object ReadModelSubmitDoRVerdictView {
  def empty: ReadModelSubmitDoRVerdict = ReadModelSubmitDoRVerdict("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
