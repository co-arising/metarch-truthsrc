package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

// ===========================================
// 1. Model Definitions (Production Ready)
// ===========================================

case class AggregateBehaviorModel(
                                   override val selfType: TypeRef, // e.g. application...CreditBalanceBehaviors
                                   aggregateType: TypeRef, // e.g. domain...CreditBalanceAggregate (用于引用 Protocol)
                                   stateType: TypeRef, // e.g. CreditBalanceState
                                   eventType: TypeRef, // e.g. CreditBalanceEvent
                                   commandType: TypeRef, // e.g. Withdraw
                                   commandHelpers: Option[TypeRef],
                                   behaviorGroups: Seq[BehaviorGroupModel],
                                   override val dependencies: Set[TypeRef],
                                   /** S7（EP §二 G1）：聚合号——台账 artifacts[] 文件级落点由此可查。 */
                                   override val noteIds: Seq[String] = Nil,
                                   contextType: Option[TypeRef] = None
                                 ) extends ArtifactModel

case class BehaviorGroupModel(name: String, handlers: Seq[CommandHandlerModel])

case class CommandHandlerModel(commandType: TypeRef, logic: HandlerLogic, groupName: String = "default")

sealed trait HandlerLogic

case class PolicyBasedLogic(policy: TypeRef, helper: TypeRef) extends HandlerLogic

case class ReadOnlyLogic(replyType: TypeRef) extends HandlerLogic

/** 门/gate 暂态命令的可判定体（EP_Improvement_Engine 欠账⑦）。
  *
  * 判据＝命令名匹配 `Run|Complete|Fail<Agg>` 三件套（refining 未产 invariant→命令流，但暂态已建模：
  * `RunStarted → status=RUNNING → RunCompleted/FAILED`）。这类命令只持久化事件、无业务回复。
  * eventArgs＝事件构造参数字面量（Run 用 `id, "", triggeredBy, java.time.Instant.now()`；
  * Complete/Fail 用 `id, state.result, ...`）。 */
case class TransientCommandLogic(eventName: String, eventArgs: String) extends HandlerLogic

/** 形式路径发射行（事件名 + 已解析的位置实参）。P4 起由规则流消费
  * （守卫 + 发射装进 <Cmd>Rule 的成功臂）——直接 persist 的 EmissionLogic 已被取代移除。 */
case class EmittedEvent(name: String, args: Seq[String])
