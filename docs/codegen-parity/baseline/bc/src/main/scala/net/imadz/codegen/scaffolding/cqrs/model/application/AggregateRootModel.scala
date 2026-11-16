package net.imadz.codegen.scaffolding.cqrs.model.application

import net.imadz.codegen.scaffolding.cqrs.model.domain.{EventModel, StateModel}
import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, ArtifactRegistry, FieldDef, TypeRef}

// 聚合根对象模型
// 聚合根对象模型
case class AggregateRootModel(
    override val selfType: TypeRef,

    // 1. Commands & Replies (Referenced from Protocol)
    commandFamilyType: TypeRef,
    // replies field removed as they are defined in Protocol

    // 2. Handler Wiring
    stateType: TypeRef,
    eventType: TypeRef,
    behaviorObject: TypeRef,

    // 3. Akka / Sharding
    sharding: ShardingModel,

    // 4. [NEW] 内联定义 (Saga 特有)
    inlineEvents: Seq[EventModel] = Nil,
    inlineState: Option[StateModel] = None,

    // 5. [NEW] 步骤工厂 (Saga 特有: createTransactionSteps)
    stepsFactory: Option[StepsFactoryModel] = None,
    contextType: Option[TypeRef] = None,
    override val dependencies: Set[TypeRef],
    /** S7（EP §二 G1）：本制品承载的知识元素 id（聚合号）——台账 artifacts[] 的文件级落点由此可查。 */
    override val noteIds: Seq[String] = Nil
) extends ArtifactModel {
  override def registerTo(registry: ArtifactRegistry): ArtifactRegistry = {
    super.registerTo(registry)
  }
}

// 辅助模型
case class CommandFamilyModel(
    name: String,
    commands: Seq[CommandModel],
    superTypes: Seq[TypeRef] = Nil
)
case class CommandModel(
    name: String,
    fields: Seq[FieldDef],
    superTypes: Seq[TypeRef] = Nil
)
case class CommandReplyModel(
    name: String,
    fields: Seq[FieldDef],
    superTypes: Seq[TypeRef] = Nil
)
case class ShardingModel(
    typeKeyName: String,
    taggingBaseName: String,
    shardCount: Int
)

// 步骤工厂模型
case class StepsFactoryModel(
    methodName: String,
    parameters: Seq[FieldDef],
    participantInstantiations: Seq[ParticipantInstantiation],
    steps: Seq[SagaStepModel],
    contextType: TypeRef
)

case class ParticipantInstantiation(
    name: String,
    participantType: TypeRef,
    constructorArgs: Seq[String]
)

case class SagaStepModel(
    stepName: String,
    participantName: String,
    prepareCmd: Option[TypeRef],
    commitCmd: Option[TypeRef],
    compensateCmd: Option[TypeRef],
    phase: String = "PreparePhase",
    maxRetries: Int = 0
)
