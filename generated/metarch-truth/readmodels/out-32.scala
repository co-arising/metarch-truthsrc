package generated.readmodel

import scala.math.BigDecimal

/** Read model: UseCaseDefinitionDecisionView — served by undefined */
final case class ReadModelUseCaseDefinition(definitionId: String, tenantId: String, useCaseName: String, realizes: String, actors: String)

object ReadModelUseCaseDefinitionView {
  def empty: ReadModelUseCaseDefinition = ReadModelUseCaseDefinition("", "", "", "", "")
  // TODO(intent): projection logic from 
}
