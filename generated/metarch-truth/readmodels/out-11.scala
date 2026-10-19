package generated.readmodel

import scala.math.BigDecimal

/** Read model: FieldModelDefinitionDecisionView — served by undefined */
final case class ReadModelFieldModelDefinition(aggregateRuleRefs: String, aggregateName: String, commands: String, declaredAt: String, declaredBy: String)

object ReadModelFieldModelDefinitionView {
  def empty: ReadModelFieldModelDefinition = ReadModelFieldModelDefinition("", "", "", "", "")
  // TODO(intent): projection logic from 
}
