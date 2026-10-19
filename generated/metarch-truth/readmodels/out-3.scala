package generated.readmodel

import scala.math.BigDecimal

/** Read model: CemEdgeDecisionView — served by undefined */
final case class ReadModelCemEdge(aggregateName: String, commandName: String, confidence: String, declaredAt: String, declaredBy: String)

object ReadModelCemEdgeView {
  def empty: ReadModelCemEdge = ReadModelCemEdge("", "", "", "", "")
  // TODO(intent): projection logic from 
}
