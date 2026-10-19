package generated.readmodel

import scala.math.BigDecimal

/** Read model: CemEdgeDecisionView — served by  */
final case class ReadModelCemEdge(aggregateName: String, commandName: String, confidence: String, declaredAt: String, declaredBy: String, edgeId: String, eventName: String, retiredAt: String, retiredReason: String, sources: String)

object ReadModelCemEdgeView {
  def empty: ReadModelCemEdge = ReadModelCemEdge("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
