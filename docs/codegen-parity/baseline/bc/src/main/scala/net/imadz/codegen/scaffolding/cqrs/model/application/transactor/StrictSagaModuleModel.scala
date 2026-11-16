package net.imadz.codegen.scaffolding.cqrs.model.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}
import net.imadz.meta.execution._

/** Structural IR only. Technical FQNs describe required host bindings, not Scala expressions. */
final case class StrictAddressModel(member: String, participant: String, resourceSlot: String,
                                    resourceType: TypeRef, addressing: SagaAddressing)
final case class StrictReceiptReadModel(local: String, producerStep: String, producerPhase: SagaPhase,
                                        producerParticipant: String, producerAddress: StrictAddressModel,
                                        receiptType: TypeRef, codecMember: String, pin: SagaRuntimeCodec)
final case class StrictPhaseModel(stem: String, member: String, inputType: TypeRef, receiptType: TypeRef,
                                  inputFields: Vector[FieldDef], outputFields: Vector[FieldDef],
                                  inputs: Vector[SagaInput], reads: Vector[StrictReceiptReadModel],
                                  stepId: String, participantId: String, address: StrictAddressModel,
                                  technical: SagaPhaseExecution)
final case class StrictStepModel(stepId: String, participantId: String, address: StrictAddressModel,
                                 phases: Vector[StrictPhaseModel])
final case class StrictTriggerModel(member: String, sourceType: TypeRef, execution: SagaTriggerExecution)
final case class StrictCompletionModel(member: String, inputType: TypeRef, eventType: TypeRef,
                                       fields: Vector[FieldDef], execution: SagaCompletionExecution)
final case class StrictSagaModuleModel(override val selfType: TypeRef, argsType: TypeRef,
                                       argsFields: Vector[FieldDef], steps: Vector[StrictStepModel],
                                       triggers: Vector[StrictTriggerModel], completions: Vector[StrictCompletionModel],
                                       pinned: PinnedSagaExecution, override val dependencies: Set[TypeRef])
    extends ArtifactModel {
  def phases: Vector[StrictPhaseModel] = steps.flatMap(_.phases)
}
