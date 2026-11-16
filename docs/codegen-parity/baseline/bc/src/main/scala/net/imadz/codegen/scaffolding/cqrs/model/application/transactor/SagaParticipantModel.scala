package net.imadz.codegen.scaffolding.cqrs.model.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

/** saga_v3 participant model: a pure-data AskParticipant subclass with per-phase
  * PhaseAsk bindings. No serialization artifacts — participants are never journaled. */
case class SagaParticipantModel(
    override val selfType: TypeRef,
    constructorParams: Seq[FieldDef],
    contextType: TypeRef,
    rules: ParticipantErrorRulesModel,
    askTimeout: String,
    prepareBinding: Option[ParticipantPhaseAskModel],
    commitBinding: Option[ParticipantPhaseAskModel],
    compensateBinding: Option[ParticipantPhaseAskModel],
    override val dependencies: Set[TypeRef]
) extends ArtifactModel

/** Dual-track classification declared once per participant (companion object val —
  * Scala 2.13 premature-access safe). */
case class ParticipantErrorRulesModel(
    errorType: String,
    codes: Seq[String],
    retryable: Boolean
)

/** One PhaseAsk.ask[Cmd, Reply, E, R, C] binding. */
case class ParticipantPhaseAskModel(
    commandType: TypeRef,
    replyType: TypeRef,
    commandArgs: Seq[String],
    repositoryFieldName: String,
    resultField: String,
    resultFieldIsString: Boolean
)
