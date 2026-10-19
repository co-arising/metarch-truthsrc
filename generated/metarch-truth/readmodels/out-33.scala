package generated.readmodel

import scala.math.BigDecimal

/** Read model: UseCaseDefinitionDecisionView — served by  */
final case class ReadModelUseCaseDefinition(definitionId: String, tenantId: String, useCaseName: String, realizes: String, actors: String, trigger: String, preconditions: String, postconditions: String, orchestrationType: String, mainFlowJson: String)

object ReadModelUseCaseDefinitionView {
  def empty: ReadModelUseCaseDefinition = ReadModelUseCaseDefinition("", "", "", "", "", "", "", "", "", "")
  // TODO(intent): projection logic from 
}
