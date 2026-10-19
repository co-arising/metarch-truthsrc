package generated.readmodel

import scala.math.BigDecimal

/** Read model: FieldModelDefinitionDecisionView — served by  */
final case class ReadModelFieldModelDefinition(aggregateRuleRefs: String, aggregateName: String, commands: String, declaredAt: String, declaredBy: String, definitionId: String, description: String, entityName: String, events: String, identifierName: String)

object ReadModelFieldModelDefinitionView {
  def empty: ReadModelFieldModelDefinition = ReadModelFieldModelDefinition("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
