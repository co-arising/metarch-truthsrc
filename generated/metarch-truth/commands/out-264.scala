package generated.command

import net.imadz.common.CborSerializable

/** 声明一个用例定义（story 语料灌入·重名即替换） */
final case class DeclareUseCaseDefinition(definitionId: String, useCaseName: String, realizes: String, actors: String, trigger: String, preconditions: String, postconditions: String, orchestrationType: String, mainFlowJson: String, extensionsJson: String, generatedIds: String, optionalInputs: String, tenantId: String, triggeredBy: String) extends CborSerializable
