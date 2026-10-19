package generated.readmodel

import scala.math.BigDecimal

/** Read model: ReadModelDefinitionDecisionView — served by undefined */
final case class ReadModelReadModelDefinition(decisionCommands: String, consumesEvents: String, declaredAt: String, declaredBy: String, definitionId: String)

object ReadModelReadModelDefinitionView {
  def empty: ReadModelReadModelDefinition = ReadModelReadModelDefinition("", "", "", "", "")
  // TODO(intent): projection logic from 
}
