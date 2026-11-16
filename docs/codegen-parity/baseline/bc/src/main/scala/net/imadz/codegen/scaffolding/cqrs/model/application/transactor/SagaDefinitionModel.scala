package net.imadz.codegen.scaffolding.cqrs.model.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

/** saga_v3: the single declarative artifact a business developer writes —
  * participants are pure functions of (definition, args); the journal never
  * stores them. */
case class SagaDefinitionModel(
    override val selfType: TypeRef,
    sagaName: String,
    version: Int,
    argsType: TypeRef,
    argsFields: Seq[FieldDef],
    contextType: TypeRef,
    steps: Seq[DefinitionStepModel],
    needsMoneyHelper: Boolean,
    override val dependencies: Set[TypeRef]
) extends ArtifactModel

case class DefinitionStepModel(
    stepId: String,
    participantType: TypeRef,
    participantArgs: Seq[String],
    resilienceCode: String,
    stepGroup: Int
)
