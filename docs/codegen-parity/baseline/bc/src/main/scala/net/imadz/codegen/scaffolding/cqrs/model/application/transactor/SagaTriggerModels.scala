package net.imadz.codegen.scaffolding.cqrs.model.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

/** saga_v3 触发聚合家族（**B·EP_Improvement_Engine §13**）。
  *
  * v3 形态（golden 参考 `playAkkaCQRS/.../FabSagaTransactor*`）：触发聚合**不再自己编排步骤**——
  * 它 journal 业务意图（`TransactionInitiated`），把 `(txId, name, version, argsBytes)` 交给共享的
  * v3 coordinator（`StartSaga`），并记录终态；步骤展开在 SagaDefinition、参与者由引擎重建。
  *
  * 本模型覆盖一族的四件：Protocol（命令/回复）、Entity（状态/事件）、Root（分片键/工厂）、
  * Behaviors（命令处理器）。 */

/** Protocol：触发命令（带 replyTo）+ 状态回灌命令 + admin 命令 + 确认回复。 */
case class SagaTriggerProtocolModel(
    override val selfType: TypeRef,
    triggerCommands: Seq[SagaTriggerCommandModel],
    confirmationType: TypeRef,
    statusCommandType: TypeRef,
    transactionResultType: TypeRef,
    tracingStepType: TypeRef,
    dependencies: Set[TypeRef]
) extends ArtifactModel

case class SagaTriggerCommandModel(
    name: String,
    params: Seq[FieldDef],       // 参数（不含 replyTo·模板自动补）
    handlerArgs: Seq[String]     // 处理器实参名（params + replyTo）——模板经 `cmd.<名>` 解构
)

/** Entity：状态 + 事件（Initiated / Completed / Failed）。 */
case class SagaTriggerEntityModel(
    override val selfType: TypeRef,
    stateType: TypeRef,
    argsFields: Seq[FieldDef],
    statusType: TypeRef,
    dependencies: Set[TypeRef]
) extends ArtifactModel

/** Root：entityTypeKey + tags + apply（把 coordinator / context 透传给 Behaviors）。 */
case class SagaTriggerRootModel(
    override val selfType: TypeRef,
    entityName: String, // 分片键名（如 "MoneyTransferTransaction"）
    tagPrefix: String,
    commandType: TypeRef,
    coordinatorType: TypeRef,
    contextType: TypeRef,
    behaviorsType: TypeRef,
    dependencies: Set[TypeRef]
) extends ArtifactModel

/** Behaviors：命令处理器（触发→StartSaga→回灌 Status；admin→coordinator 直通道）。 */
case class SagaTriggerBehaviorsModel(
    override val selfType: TypeRef,
    entityName: String,
    stateType: TypeRef,
    eventType: TypeRef,
    commandType: TypeRef,
    definitionType: TypeRef, // <Saga>Definition（取 Name/Version/codec）
    argsType: TypeRef,       // <Saga>Args（构造 + encode）
    argsFields: Seq[FieldDef],
    triggerCommands: Seq[SagaTriggerCommandModel],
    /** 从触发命令参数构造 args 的表达式（如 `Money(...).amount, ..., currency`）——builder 算好。 */
    argsCtorExpr: String,
    confirmationType: TypeRef,
    statusCommandType: TypeRef,
    coordinatorType: TypeRef,
    contextType: TypeRef,
    transactionResultType: TypeRef,
    dependencies: Set[TypeRef]
) extends ArtifactModel
