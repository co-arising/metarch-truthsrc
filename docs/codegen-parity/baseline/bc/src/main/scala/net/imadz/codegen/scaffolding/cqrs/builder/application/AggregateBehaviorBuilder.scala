package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application._
import net.imadz.codegen.scaffolding.cqrs.{
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.{
  AggregateBehaviorMetadata,
  AggregateRootMetadata,
  CommandHandlingFlow,
  CommandRef,
  EventFamilyMetadata,
  InvariantRuleRef,
  SubordinateCommandMetadata,
  ValueObjectMetadata
}

object AggregateBehaviorBuilder {

  def build(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateBehaviorModel = {
    val pkg = ctx.layout.application.aggregates.behaviors
    val selfType = ctx.typeResolver.aggregateBehavior(meta)

    // 解析基础类型
    val (aggregateType, stateType, eventType, entityType, commandHelpers) =
      resolveBaseTypes(meta, ctx)

    // 解析行为元数据
    val behaviorMetadata = resolveBehaviorMetadata(meta, ctx)

    // 构建行为组
    val mutatingCommands = meta.commandFamily.commands.filter(!_.isReadOnly)
    val writeBehaviorGroups =
      buildWriteBehaviorGroups(meta, behaviorMetadata, mutatingCommands, ctx)

    val readOnlyCommands = meta.commandFamily.commands.filter(_.isReadOnly)
    val behaviorGroups = if (readOnlyCommands.nonEmpty) {
      writeBehaviorGroups :+ buildQueryBehaviorGroup(readOnlyCommands, ctx)
    } else {
      writeBehaviorGroups
    }
    // P4 形式路径规则组（formal-semantics 桥）：invariant→命令流未覆盖、但真源
    // guards+bindings 可机械解析的变更命令，走 runReplyingPolicy 规则流——规则体在
    // <Agg>Rules.scala（AggregateRulesBuilder 同源解析），行为侧只接线。
    val allBehaviorGroups = behaviorGroups ++ buildFormalRuleGroups(meta, behaviorGroups, ctx)

    // 收集依赖
    val dependencies = collectDependencies(
      allBehaviorGroups,
      aggregateType,
      stateType,
      eventType,
      entityType,
      meta,
      ctx,
      pkg
    )
    val commandRef =
      ctx.typeResolver.commandFamily(CommandRef(meta.commandFamily.name))

    // 构建并返回模型
    AggregateBehaviorModel(
      selfType,
      aggregateType,
      stateType,
      eventType,
      commandRef,
      Some(commandHelpers),
      allBehaviorGroups,
      dependencies,
      noteIds = meta.noteId.toSeq
    )
  }

  /** 解析基础类型引用
    */
  private def resolveBaseTypes(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): (TypeRef, TypeRef, TypeRef, TypeRef, TypeRef) = {
    val aggPkg = ctx.layout.application.aggregates.root
    // 2026-08-21 摄入侧适配：聚合名不带 Aggregate 后缀（bankingSystem 手工元数据自带）；
    // 统一经命名规范解析为 <Base>Aggregate，保证模板的 replace("Aggregate","Protocol") 逻辑一致
    val aggregateType = ctx.typeResolver.aggregateType(NamingConventions.aggregateRootName(NamingConventions.getBaseName(meta.name)), aggPkg)
    val commandHelpers = ctx.typeResolver.commandHelper(meta)
    val stateType = ctx.typeResolver.entityState(meta.stateRef)
    val eventType = ctx.typeResolver.eventFamily(meta.eventFamilyRef)
    val entityType = ctx.typeResolver.entity(meta.entityRef.targetName)

    (aggregateType, stateType, eventType, entityType, commandHelpers)
  }

  /** 解析行为元数据
    */
  private def resolveBehaviorMetadata(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateBehaviorMetadata = {
    ctx.metaRegistry
      .resolveByName[AggregateBehaviorMetadata](meta.behaviorRef.targetName)
      .getOrElse(
        throw new IllegalStateException(
          s"Failed to resolve behavior metadata for aggregate '${meta.name}'. " +
            s"Expected behavior metadata '${meta.behaviorRef.targetName}' not found in registry."
        )
      )
  }

  /** 构建写入行为组，包含所有非只读命令的处理程序
    */
  private def buildWriteBehaviorGroups(
      meta: AggregateRootMetadata,
      behaviorMetadata: AggregateBehaviorMetadata,
      mutatingCommands: Seq[SubordinateCommandMetadata],
      ctx: GeneratorContext
  ): Seq[BehaviorGroupModel] = {
    val groups = behaviorMetadata.behaviors.map { groupMeta =>
      val handlers =
        groupMeta.flows.flatMap(buildCommandHandler(_, mutatingCommands, ctx))
      BehaviorGroupModel(groupMeta.name, handlers)
    }
    // 门/gate 暂态补全（EP_Improvement_Engine 欠账⑦）：refining 未产 invariant→命令流时，
    // behaviorMetadata.behaviors 为空 → 上面循环一次都不跑，行为体落到 ???。若命令族含
    // Run<Agg>/Complete<Agg>/Fail<Agg> 三件套（暂态已建模 RunStarted→…→RunCompleted/FAILED），
    // 按可判定体发射——**不猜**：命令名直接对应事件名（RunX→XRunStarted …），事件参数按实体形状算。
    val hasFlows = groups.exists(_.handlers.nonEmpty)
    if (hasFlows) groups
    else {
      val transient = buildTransientHandlers(meta, mutatingCommands, ctx)
      if (transient.nonEmpty) Seq(BehaviorGroupModel(s"${NamingConventions.getBaseName(meta.name)}TransientBehaviors", transient))
      else groups
    }
  }

  /** 门/gate 暂态命令体：动词→事件后缀（Run→RunStarted / Complete→RunCompleted / Fail→RunFailed）。 */
  private val TransientVerbs = Seq("Run" -> "RunStarted", "Complete" -> "RunCompleted", "Fail" -> "RunFailed")

  private def buildTransientHandlers(
      meta: AggregateRootMetadata,
      mutatingCommands: Seq[SubordinateCommandMetadata],
      ctx: GeneratorContext
  ): Seq[CommandHandlerModel] = {
    // 聚合基名（去 Aggregate 后缀）＝命令/事件前缀（RunGateKbLint → GateKbLintRunStarted）
    val base = NamingConventions.getBaseName(meta.name).replaceAll("Aggregate$", "")
    TransientVerbs.flatMap { case (verb, evSuffix) =>
      val verbCmd = s"$verb$base"
      mutatingCommands.find(_.name == verbCmd).map { _ =>
        val eventName = s"$base$evSuffix"
        val args =
          if (verb == "Run") """cmd.id, "", cmd.triggeredBy, java.time.Instant.now()"""
          else "cmd.id, cmd.result, cmd.triggeredBy, java.time.Instant.now()"
        CommandHandlerModel(ctx.typeResolver.command(CommandRef(verbCmd)), TransientCommandLogic(eventName, args), verbCmd)
      }
    }
  }

  /** P4 形式路径规则组（formal-semantics 桥）：对 invariant→命令流未覆盖的变更命令，
    * 走 runReplyingPolicy(<Cmd>Rule, <Cmd>Helper) 规则流——规则/守卫/发射由
    * AggregateRulesBuilder 同源机械解析（任一命令不可解析＝该命令保持 ??? 桩语义，不猜）。
    * formalSemantics 缺省（Examples/既有入口）＝零行为变化。 */
  private def buildFormalRuleGroups(
      meta: AggregateRootMetadata,
      existingGroups: Seq[BehaviorGroupModel],
      ctx: GeneratorContext
  ): Seq[BehaviorGroupModel] = {
    val aggSemantics = ctx.formalSemantics.toVector.flatMap(_.aggregates.find(_.aggregate == meta.name))
    aggSemantics.headOption.toSeq.flatMap { agg =>
      val emissionByBase = agg.emissions.map(e => (e.event.replace('-', '_'), e)).toMap
      val guardsByCommand = agg.guards.map(g => (g.command, g.guards)).toMap
      val eventFamilyOpt = ctx.metaRegistry.resolveByName[EventFamilyMetadata](meta.eventFamilyRef.targetName)
      val stateFields = ctx.metaRegistry
        .resolveByName[ValueObjectMetadata](meta.stateRef.targetName)
        .map(_.fields).getOrElse(Vector.empty)
      val covered = existingGroups.flatMap(_.handlers).map(_.commandType.name).toSet
      val handlers = meta.commandFamily.commands
        .filter(!_.isReadOnly).filterNot(c => covered(c.name))
        .flatMap(cmd => resolveRuleHandler(cmd, eventFamilyOpt, emissionByBase, guardsByCommand, stateFields, meta, ctx))
      if (handlers.isEmpty) Nil else Seq(BehaviorGroupModel("FormalRuleBehaviors", handlers))
    }
  }

  /** 单命令规则接线：守卫与发射全部可机械解析才成体（与 AggregateRulesBuilder 同一判据），
    * 否则命令级放弃（不猜）。规则引用带对象限定名（CreditBalanceRules.<Cmd>Rule）。 */
  private def resolveRuleHandler(
      cmd: SubordinateCommandMetadata,
      eventFamilyOpt: Option[EventFamilyMetadata],
      emissionByBase: Map[String, net.imadz.meta.filesystem.FormalEmission],
      guardsByCommand: Map[String, Vector[ujson.Value]],
      stateFields: Seq[net.imadz.meta.FieldMetadata],
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): Option[CommandHandlerModel] = {
    val family = eventFamilyOpt.getOrElse(return None)
    val paramNames = cmd.parameters.map(_.name).toSet
    val produced = family.events.filter(_.producedBy.exists(_.targetName == cmd.name))
    if (produced.isEmpty) return None
    val resolvedEvents = produced.map(ev =>
      resolveEmittedEvent(ev, emissionByBase.get(ev.name), paramNames))
    if (resolvedEvents.exists(_.isEmpty)) return None
    val resolvedGuards = guardsByCommand.getOrElse(cmd.name, Vector.empty).map(resolveGuard(_, stateFields.map(_.name).toSet, paramNames))
    if (resolvedGuards.exists(_.isEmpty)) return None
    // 与 AggregateRulesBuilder 输出对齐的规则引用：裸成员名 + 对象路径作包——
    // 成员 import（<pkg>.<Agg>Rules.<Cmd>Rule）已把名字带进作用域；对象名本身
    // 不随成员 import 入域，限定引用会 not found（r11 首轮实测）。
    val ruleType = TypeRef(s"${cmd.name}Rule", s"${ctx.layout.domain.invariants.root}.${meta.name}Rules")
    val helperType = ctx.typeResolver.commandHelper(s"${cmd.name}Helper")
    val cmdType = ctx.typeResolver.command(CommandRef(cmd.name))
    Some(CommandHandlerModel(cmdType, PolicyBasedLogic(ruleType, helperType), cmd.name))
  }

  private def resolveEmittedEvent(
      ev: net.imadz.meta.SubordinateDomainEventMetadata,
      emission: Option[net.imadz.meta.filesystem.FormalEmission],
      paramNames: Set[String]
  ): Option[net.imadz.codegen.scaffolding.cqrs.model.application.EmittedEvent] =
    if (ev.fields.isEmpty) Some(net.imadz.codegen.scaffolding.cqrs.model.application.EmittedEvent(ev.name, Nil))
    else {
      val bindings = emission.map(_.bindings.toMap).getOrElse(Map.empty[String, String])
      val args = ev.fields.toVector.map(f =>
        bindings.get(f.name).flatMap(expr => resolveExpr(expr, paramNames)))
      if (args.exists(_.isEmpty)) None
      else Some(net.imadz.codegen.scaffolding.cqrs.model.application.EmittedEvent(ev.name, args.flatten))
    }

  private def resolveGuard(raw: ujson.Value, stateFieldNames: Set[String], paramNames: Set[String]): Option[Unit] = {
    val obj = raw.objOpt.getOrElse(return None)
    obj.get("errCode").flatMap(v => v.strOpt).getOrElse(return None)
    val onFail = obj.get("onFail").flatMap(v => v.strOpt).getOrElse("reject")
    if (onFail != "reject" && onFail != "succeed-empty") return None
    val when = obj.get("when").flatMap(_.objOpt).getOrElse(return None)
    val form = when.get("form").flatMap(_.strOpt).getOrElse(return None)
    if (!Set("money-positive", "money-sufficient", "map-contains", "map-absent", "collection-covered").contains(form)) return None
    def param(name: String): Boolean =
      when.get(name).flatMap(_.strOpt).filter(_.startsWith("param."))
        .map(_.stripPrefix("param.")).exists(paramNames.contains)
    def stateField(name: String): Boolean =
      when.get(name).flatMap(_.strOpt).exists(stateFieldNames.contains)
    val ok = form match {
      case "money-positive" => param("amount")
      case "money-sufficient" => param("amount") && stateField("in")
      case "map-contains" | "map-absent" => stateField("map") && param("key")
      case "collection-covered" => stateField("map") && param("collection")
    }
    if (ok) Some(()) else None
  }

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

  /** 构建单个命令处理程序
    */
  private def buildCommandHandler(
      flow: CommandHandlingFlow,
      mutatingCommands: Seq[SubordinateCommandMetadata],
      ctx: GeneratorContext
  ): Option[CommandHandlerModel] = {
    mutatingCommands.find(_.name == flow.commandRef.targetName).map { cmdMeta =>
      val cmdType = ctx.typeResolver.command(flow.commandRef)
      // 行为体的 MANUAL 默认体（PolicyBasedLogic）——生成一个开箱可编译的机械骨架：
      //   把命令转成 param（走 CommandHelper.toParam）→ 跑 policy → 持久化事件或回错误。
      //   与 CommandHelpers 的机械骨架同族（2026-09-21 EP_Improvement_Engine 欠账⑦）：
      //   生成的 partial function 分支里，policy 名取自真源 invariantRef，不是猜的。
      val ruleType = ctx.typeResolver.invariantRule(flow.invariantRef.targetName)
      val helperName = s"${flow.commandRef.targetName}Helper"
      val helperType = ctx.typeResolver.commandHelper(helperName)

      val logic = PolicyBasedLogic(ruleType, helperType)
      CommandHandlerModel(cmdType, logic, flow.commandRef.targetName)
    }
  }

  /** 构建查询行为组，包含所有只读命令的处理程序
    */
  private def buildQueryBehaviorGroup(
      readOnlyCommands: Seq[SubordinateCommandMetadata],
      ctx: GeneratorContext
  ): BehaviorGroupModel = {
    val handlers = readOnlyCommands.map { cmd =>
      val cmdType = ctx.typeResolver.command(CommandRef(cmd.name))

      val replyType = cmd.replyToType
        .map(ctx.typeResolver.resolve(_))
        .getOrElse(
          throw new IllegalStateException(
            s"Read-only command '${cmd.name}' must define a reply type"
          )
        )

      CommandHandlerModel(cmdType, ReadOnlyLogic(replyType), "QueryBehaviors")
    }

    BehaviorGroupModel("QueryBehaviors", handlers)
  }

  /** 收集所有依赖关系
    */
  private def collectDependencies(
      behaviorGroups: Seq[BehaviorGroupModel],
      aggregateType: TypeRef,
      stateType: TypeRef,
      eventType: TypeRef,
      entityType: TypeRef,
      meta: AggregateRootMetadata,
      ctx: GeneratorContext,
      pkg: String
  ): Set[TypeRef] = {
    val runReplyingPolicy = ctx.knownFrameworkTypes("runReplyingPolicy")
    val effect = ctx.knownFrameworkTypes("Effect")

    val logicDeps = behaviorGroups.flatMap(_.handlers).flatMap {
      case CommandHandlerModel(_, PolicyBasedLogic(p, h), _) => Set(p, h)
      case CommandHandlerModel(_, ReadOnlyLogic(r), _)       => Set(r)
      case _                                                 => Set.empty
    }

    val commandFamilyDep =
      ctx.typeResolver.commandFamily(CommandRef(meta.commandFamily.name))
    val commandDepends = meta.commandFamily.commands.map(cmd =>
      ctx.typeResolver.command(CommandRef(cmd.name))
    ) ++ Seq(commandFamilyDep)

    // [FIX] Use Protocol instead of Aggregate to break circular dependency
    val protocolType = ctx.typeResolver.aggregateProtocol(meta)

    (Set(
      protocolType, // Use Protocol instead of Aggregate
      stateType,
      eventType,
      runReplyingPolicy,
      effect,
      entityType
    ) ++
      commandDepends.toSet ++ logicDeps)
      .filter(_.shouldImport(pkg))
  }
}
