package generated.readmodel

import scala.math.BigDecimal

/** Read model: ValueObjectDefinitionDecisionView — served by  */
final case class ReadModelValueObjectDefinition(definitionId: String, voName: String, members: String, declaredAt: String, declaredBy: String, tenantId: String)

object ReadModelValueObjectDefinitionView {
  def empty: ReadModelValueObjectDefinition = ReadModelValueObjectDefinition("", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
