package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{AggregateRulesModel, EmittedEvent, GuardModel, RuleModel}
import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.meta._

/** P4 形式路径规则构建器：真源 guards（结构化闭形）+ bindings（发射）→
  * `<Agg>Rules.scala` 模型。全部命令的守卫与发射均可机械解析才成体——
  * 任一失败＝命令级放弃保持 ??? 桩语义（不猜）。formalSemantics 缺省＝不发射（Examples 零漂移）。 */
object AggregateRulesBuilder {

  private val GuardForms = Set("money-positive", "money-sufficient", "map-contains", "map-absent", "collection-covered")

  def build(meta: AggregateRootMetadata, ctx: GeneratorContext): Option[AggregateRulesModel] = {
    val aggSemantics = ctx.formalSemantics.toVector
      .flatMap(_.aggregates.find(_.aggregate == meta.name)).headOption
    val agg = aggSemantics.getOrElse(return None)
    val eventFamily = ctx.metaRegistry.resolveByName[EventFamilyMetadata](meta.eventFamilyRef.targetName).getOrElse(return None)
    val stateFields = ctx.metaRegistry.resolveByName[ValueObjectMetadata](meta.stateRef.targetName)
      .map(_.fields).getOrElse(return None)
    val stateFieldNames = stateFields.map(_.name).toSet

    val emissionByBase = agg.emissions.map(e => (e.event.replace('-', '_'), e)).toMap
    val guardsByCommand = agg.guards.map(g => (g.command, g.guards)).toMap

    val commands = meta.commandFamily.commands.filter(!_.isReadOnly)
    if (commands.isEmpty) return None
    val rules = commands.flatMap(cmd =>
      buildRule(cmd, eventFamily, emissionByBase, guardsByCommand, stateFields, stateFieldNames, meta, ctx))
    if (rules.isEmpty) None
    else {
      val rulesPkg = ctx.layout.domain.invariants.root
      // 事件值引用走实体对象 owner（CreditBalanceEvents 只是 trait 类型名——Slice 2 教训）。
      // 嵌套族约定：族 TypeRef 的 packageName＝owner object 的 FQN——owner 的 import
      // 面是其容器包 + 对象名（import 到 object 自身，限定引用方可解析，r11c 实测）。
      val eventType = ctx.typeResolver.eventFamily(meta.eventFamilyRef)
      val ownerFqn = eventType.packageName
      val ownerType = TypeRef(meta.entityRef.targetName, ownerFqn.substring(0, ownerFqn.lastIndexOf('.')))
      val stateType = ctx.typeResolver.entityState(meta.stateRef)
      val selfName = meta.name + "Rules"
      // 依赖：事件 owner、族/状态、参数值类型、MoneyOps（money 守卫/折叠算术）、iMadzError
      val paramTypes = rules.flatMap(_.paramFields.map(_._2)).toSet
      val usesMoneyOps = rules.exists(r => r.guards.exists(g => g.cond.contains("MoneyOps")))
      val deps = (paramTypes + eventType + stateType + ownerType ++
        (if (usesMoneyOps) Some(TypeRef("MoneyOps", "net.imadz.common")) else None).toSeq).toSet
        .filter(_.shouldImport(rulesPkg)) + ctx.knownFrameworkTypes("iMadzError") +
        TypeRef("InvariantRule", "net.imadz.common.CommonTypes")
      Some(AggregateRulesModel(
        selfType = TypeRef(selfName, rulesPkg),
        eventType = eventType,
        stateType = stateType,
        ownerType = ownerType,
        rules = rules,
        dependencies = deps,
        noteIds = meta.noteId.toSeq))
    }
  }

  private def buildRule(
      cmd: SubordinateCommandMetadata,
      family: EventFamilyMetadata,
      emissionByBase: Map[String, net.imadz.meta.filesystem.FormalEmission],
      guardsByCommand: Map[String, Vector[ujson.Value]],
      stateFields: Seq[net.imadz.meta.FieldMetadata],
      stateFieldNames: Set[String],
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): Option[RuleModel] = {
    val paramNames = cmd.parameters.map(_.name).toSet
    val produced = family.events.filter(_.producedBy.exists(_.targetName == cmd.name))
    if (produced.isEmpty) return None
    // 发射解析（p.<param> 相对引用）——全产出事件全槽位可解析才成体
    val resolvedEvents = produced.map { ev =>
      resolveEmittedEvent(ev, emissionByBase.get(ev.name), paramNames)
    }
    if (resolvedEvents.exists(_.isEmpty)) return None
    // 守卫解析（闭形 → 可渲染条件）——任一行不可解析＝命令级放弃
    val rawGuards = guardsByCommand.getOrElse(cmd.name, Vector.empty)
    val resolvedGuards = rawGuards.map(resolveGuard(_, stateFieldNames, paramNames))
    if (resolvedGuards.exists(_.isEmpty)) return None
    val payloadParams = cmd.parameters.filter(_.name != "replyTo")
    val comment = s"${cmd.name}: guards ${resolvedGuards.flatten.size}, emission ${produced.map(_.name).mkString(", ")} (truth-source formal path)"
    Some(RuleModel(
      name = cmd.name + "Rule",
      paramsName = cmd.name + "Params",
      paramFields = payloadParams.map(p => (p.name, ctx.typeResolver.parameterType(p.parameterType))),
      guards = resolvedGuards.flatten,
      emission = resolvedEvents.flatten.headOption,
      comment = comment))
  }

  /** 真源结构化守卫 → GuardModel（cond＝成功条件的 Scala 布尔表达式）。
    * money 形式走 MoneyOps 字符串算术（Money 形状＝minorUnits/currency）。 */
  private def resolveGuard(raw: ujson.Value, stateFieldNames: Set[String], paramNames: Set[String]): Option[GuardModel] = {
    val obj = raw.objOpt.getOrElse(return None)
    val errCode = obj.get("errCode").flatMap(v => v.strOpt).getOrElse(return None)
    val onFail = obj.get("onFail").flatMap(v => v.strOpt).getOrElse("reject")
    if (onFail != "reject" && onFail != "succeed-empty") return None
    val desc = obj.get("desc").flatMap(v => v.strOpt).getOrElse("")
    val when = obj.get("when").flatMap(_.objOpt).getOrElse(return None)
    val form = when.get("form").flatMap(_.strOpt).getOrElse(return None)
    if (!GuardForms.contains(form)) return None
    def param(name: String): Option[String] =
      when.get(name).flatMap(_.strOpt).filter(_.startsWith("param."))
        .map(_.stripPrefix("param."))
        .filter(paramNames.contains).map("p." + _)
    def stateField(name: String): Option[String] =
      when.get(name).flatMap(_.strOpt).filter(stateFieldNames.contains)
    val cond: Option[String] = form match {
      case "money-positive" => param("amount").map(a => s"MoneyOps.isPositive($a.minorUnits)")
      case "money-sufficient" =>
        for { a <- param("amount"); in <- stateField("in") }
          yield s"state.$in.get($a.currency).exists(v => MoneyOps.compare(v.minorUnits, $a.minorUnits) >= 0)"
      case "map-contains" =>
        for { m <- stateField("map"); k <- param("key") } yield s"state.$m.contains($k)"
      case "map-absent" =>
        for { m <- stateField("map"); k <- param("key") } yield s"!state.$m.contains($k)"
      case "collection-covered" =>
        for { m <- stateField("map"); c <- param("collection") } yield s"$c.forall(state.$m.contains)"
    }
    cond.map(GuardModel(_, onFail, errCode, desc))
  }

  /** 事件发射行：载荷非空须全槽位绑定覆盖（载荷字段序位置实参）；空载荷＝无参发射。 */
  private def resolveEmittedEvent(
      ev: SubordinateDomainEventMetadata,
      emission: Option[net.imadz.meta.filesystem.FormalEmission],
      paramNames: Set[String]
  ): Option[EmittedEvent] =
    if (ev.fields.isEmpty) Some(EmittedEvent(ev.name, Nil))
    else {
      val bindings = emission.map(_.bindings.toMap).getOrElse(Map.empty[String, String])
      val args = ev.fields.toVector.map(f =>
        bindings.get(f.name).flatMap(expr => resolveExpr(expr, paramNames)))
      if (args.exists(_.isEmpty)) None
      else Some(EmittedEvent(ev.name, args.flatten))
    }

  /** 真源绑定表达式 → 规则内 Scala 实参（V13 词法）。param.x→p.x；receipt.s→命令同名参
    * （P4 真源已声明收据值起源＝param，此为兼容形态）；literal:v 转义字面量。 */
  private def resolveExpr(expr: String, paramNames: Set[String]): Option[String] = {
    if (expr.startsWith("param.")) {
      val p = expr.stripPrefix("param.")
      if (paramNames.contains(p)) Some("p." + p) else None
    } else if (expr.startsWith("receipt.")) {
      val slot = expr.stripPrefix("receipt.")
      if (paramNames.contains(slot)) Some("p." + slot)
      else if (paramNames.contains("txid") && Set("reservation", "receiptId").contains(slot))
        Some("p.txid + \":receipt:" + slot + "\"")
      else None
    } else if (expr.startsWith("literal:")) {
      Some("\"" + expr.stripPrefix("literal:").replace("\\", "\\\\").replace("\"", "\\\"") + "\"")
    } else None
  }
}
