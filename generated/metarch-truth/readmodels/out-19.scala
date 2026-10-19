package generated.readmodel

import scala.math.BigDecimal

/** Read model: ReadModelDefinitionDecisionView — served by  */
final case class ReadModelReadModelDefinition(decisionCommands: String, consumesEvents: String, declaredAt: String, declaredBy: String, definitionId: String, description: String, fields: String, linkedStories: String, parentAggregate: String, sourceAggregates: String)

object ReadModelReadModelDefinitionView {
  def empty: ReadModelReadModelDefinition = ReadModelReadModelDefinition("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
