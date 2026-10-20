package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.UseCaseDefinitionEntity.UseCaseDefinitionState
import net.imadz.metarch.domain.entities.UseCaseDefinitionEntity._
import net.imadz.metarch.infrastructure.proto._

trait UseCaseDefinitionProtoConverters extends PrimitiveConverter {

  object UseCaseDefinitionStateConv extends ProtoConverter[UseCaseDefinitionState, UseCaseDefinitionStatePO] {
    override def toProto(d: UseCaseDefinitionState): UseCaseDefinitionStatePO = UseCaseDefinitionStatePO(
      tenantId = d.tenantId,
      useCaseName = d.useCaseName,
      realizes = d.realizes,
      actors = d.actors,
      trigger = d.trigger,
      preconditions = d.preconditions,
      postconditions = d.postconditions,
      orchestrationType = d.orchestrationType,
      mainFlowJson = d.mainFlowJson,
      extensionsJson = d.extensionsJson,
      generatedIds = d.generatedIds,
      optionalInputs = d.optionalInputs,
      declaredAt = d.declaredAt,
      declaredBy = d.declaredBy,
      removedAt = d.removedAt,
      removedBy = d.removedBy
    )

    override def fromProto(p: UseCaseDefinitionStatePO): UseCaseDefinitionState = UseCaseDefinitionState(
      tenantId = p.tenantId,
      useCaseName = p.useCaseName,
      realizes = p.realizes,
      actors = p.actors,
      trigger = p.trigger,
      preconditions = p.preconditions,
      postconditions = p.postconditions,
      orchestrationType = p.orchestrationType,
      mainFlowJson = p.mainFlowJson,
      extensionsJson = p.extensionsJson,
      generatedIds = p.generatedIds,
      optionalInputs = p.optionalInputs,
      declaredAt = p.declaredAt,
      declaredBy = p.declaredBy,
      removedAt = p.removedAt,
      removedBy = p.removedBy
    )
  }


  object UseCaseDeclaredConv extends ProtoConverter[UseCaseDeclared, UseCaseDeclaredPO] {
    override def toProto(d: UseCaseDeclared): UseCaseDeclaredPO = UseCaseDeclaredPO(
      definitionId = d.definitionId,
      useCaseName = d.useCaseName,
      realizes = d.realizes,
      actors = d.actors,
      trigger = d.trigger,
      preconditions = d.preconditions,
      postconditions = d.postconditions,
      orchestrationType = d.orchestrationType,
      mainFlowJson = d.mainFlowJson,
      extensionsJson = d.extensionsJson,
      generatedIds = d.generatedIds,
      optionalInputs = d.optionalInputs,
      declaredAt = d.declaredAt,
      declaredBy = d.declaredBy,
      triggeredBy = d.triggeredBy,
      tenantId = d.tenantId,
      timestamp = d.timestamp
    )

    override def fromProto(p: UseCaseDeclaredPO): UseCaseDeclared = UseCaseDeclared(
      definitionId = p.definitionId,
      useCaseName = p.useCaseName,
      realizes = p.realizes,
      actors = p.actors,
      trigger = p.trigger,
      preconditions = p.preconditions,
      postconditions = p.postconditions,
      orchestrationType = p.orchestrationType,
      mainFlowJson = p.mainFlowJson,
      extensionsJson = p.extensionsJson,
      generatedIds = p.generatedIds,
      optionalInputs = p.optionalInputs,
      declaredAt = p.declaredAt,
      declaredBy = p.declaredBy,
      triggeredBy = p.triggeredBy,
      tenantId = p.tenantId,
      timestamp = p.timestamp
    )
  }


  object UseCaseRemovedConv extends ProtoConverter[UseCaseRemoved, UseCaseRemovedPO] {
    override def toProto(d: UseCaseRemoved): UseCaseRemovedPO = UseCaseRemovedPO(
      definitionId = d.definitionId,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: UseCaseRemovedPO): UseCaseRemoved = UseCaseRemoved(
      definitionId = p.definitionId,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
