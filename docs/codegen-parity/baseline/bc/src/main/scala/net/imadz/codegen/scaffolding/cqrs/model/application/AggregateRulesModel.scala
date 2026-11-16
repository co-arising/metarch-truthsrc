package net.imadz.codegen.scaffolding.cqrs.model.application

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

/** P4 形式路径规则面（formal-semantics → runReplyingPolicy 规则流）：
  * 每个聚合一个 `<Agg>Rules.scala`（domain.invariant），params case class + 规则对象，
  * 与 js 侧 rules_domain_gen 输出同风格（规则＝纯 domain，不依赖 application/akka）。
  * 守卫按真源声明序求值（金主语义）；`succeed-empty`＝幂等空事件成功（Right(Nil)）；
  * 成功臂发射＝真源 bindings 的机械解析（p.<param> 相对引用）。 */
case class AggregateRulesModel(
    override val selfType: TypeRef, // object <Agg>Rules（domain.invariant）
    eventType: TypeRef, // <Agg>Events 族（规则泛型 Event 参数）
    stateType: TypeRef, // <Agg>State
    ownerType: TypeRef, // <Agg>Entity（事件值引用 owner object——Slice 2 教训）
    rules: Seq[RuleModel],
    override val dependencies: Set[TypeRef],
    override val noteIds: Seq[String] = Nil
) extends ArtifactModel

case class RuleModel(
    name: String, // <Cmd>Rule
    paramsName: String, // <Cmd>Params
    paramFields: Seq[(String, TypeRef)], // 命令参数序（replyTo 除外）
    guards: Seq[GuardModel], // 真源声明序＝求值序
    emission: Option[EmittedEvent], // 成功臂事件（载荷序位置实参）
    comment: String // 规则说明（真源 desc 原文）
)

/** 单条守卫的可渲染体：cond＝成功条件（真源 when 形式）的 Scala 布尔表达式；
  * onFail ∈ reject（Left(err)）| succeed-empty（Right(Nil) 幂等成功）。 */
case class GuardModel(cond: String, onFail: String, errCode: String, desc: String)
