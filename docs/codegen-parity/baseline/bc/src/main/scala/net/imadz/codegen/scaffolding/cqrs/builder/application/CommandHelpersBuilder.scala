package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{CommandHelperModel, CommandHelpersModel}
import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object CommandHelpersBuilder {

  def build(meta: AggregateRootMetadata, ctx: GeneratorContext): CommandHelpersModel = {
    val pkg = ctx.layout.application.aggregates.behaviors
    val selfType = ctx.typeResolver.commandHelper(NamingConventions.getCommandHelperNameFromAggregateName(meta.name))

    val stateType = ctx.typeResolver.entityState(meta.stateRef)
    val errorType = ctx.knownFrameworkTypes("iMadzError")

    // 解析 Behavior Metadata 以获取 Command -> Reply 的映射关系
    val behaviorMeta = ctx.metaRegistry.resolveByName[AggregateBehaviorMetadata](meta.behaviorRef.targetName)

    // P4 形式路径：真源规则流在场（guards/emissions 非空）⇒ 写命令回复＝聚合回复族首回复
    //（error: Option[iMadzError] 单槽形制，与 runReplyingPolicy 两臂同形）。
    val formalReplyName: Option[String] =
      ctx.formalSemantics.flatMap(_.aggregates.find(_.aggregate == meta.name))
        .filter(a => a.guards.nonEmpty || a.emissions.nonEmpty)
        .flatMap(_ => meta.replyFamily.replies.headOption.map(_.name))

    // 构建映射表: CommandName -> ReplyType
    val commandReplyMap: Map[String, TypeRef] = behaviorMeta.map { bm =>
      bm.behaviors.flatMap(_.flows).map { flow =>
        // 获取成功时的回复类型
        val replyRef = flow.replyMapping.successReplyRef
        // 使用DSL解析回复类型
        val replyType = ctx.typeResolver.resolve(replyRef)
        flow.commandRef.targetName -> replyType
      }.toMap
    }.getOrElse(Map.empty)

    // P4 Slice 2：只读查询命令不产 helper——其回复（Get*StateReply(state)）由行为侧
    // ReadOnlyLogic 直接整状态构造；(param, error) 形态的 helper 对它无意义也构造不出
    //（整状态不在 helper 的参数域里）。
    val helpers = meta.commandFamily.commands.filterNot(_.isReadOnly).map { cmd =>
      // 自动解析 Command 类型（使用CommandRef以支持内嵌类）
      val cmdType = ctx.typeResolver.command(CommandRef(cmd.name))

      // 增强 Reply 类型推断逻辑
      val formalReply = formalReplyName.map(rn => (rn, ctx.typeResolver.commandReply(CommandReplyRef(rn))))
      val replyTypeRef = if (cmd.isReadOnly) {
        // ReadOnly 命令通常在定义时指定了 replyToType
        cmd.replyToType.map(ctx.typeResolver.resolve(_))
          .getOrElse(ctx.typeResolver.any)
      } else {
        // P4 形式路径（真源规则流在场）：回复＝聚合回复族（error: Option[iMadzError]），
        // 与 runReplyingPolicy 失败/成功臂同形——helper 成为活接线而非 Unit 骨架。
        formalReply.map(_._2).orElse {
          // Write 命令：优先从 Behavior 映射中查找
          commandReplyMap.get(cmd.name).orElse {
            // 兜底：尝试从 replyTo 参数推断 (兼容旧逻辑)
            cmd.parameters.find(_.name == "replyTo").flatMap { p =>
              p.parameterType match {
                case CustomType(_, _, args) if args.nonEmpty =>
                  val rawName = args.head.asInstanceOf[MetaRef].targetName
                  Some(ctx.typeResolver.resolve(StructRef(rawName)))
                case _ => None
              }
            }
          }
        }.getOrElse(ctx.typeResolver.unit) // 实在找不到就 Unit
      }

      // Params Logic (使用DSL风格解析参数类型)
      // P4 形式路径：规则参数＝<Agg>Rules.<Cmd>Params 命名类（InvariantRule 的 Param 不变型——
      // tuple 助手与规则参数类失配，r11b 实测），toParam 按命令参数序构造。
      val formalParamOpt = formalReplyName.map { _ =>
        val paramsName = s"${cmd.name}Params"
        val paramsType = TypeRef(paramsName, s"${ctx.layout.domain.invariants.root}.${meta.name}Rules")
        val args = cmd.parameters.filter(_.name != "replyTo").map(p => s"command.${p.name}").mkString(", ")
        (paramsType, s"$paramsName($args)")
      }
      val (paramType, toParamLogic) = formalParamOpt.getOrElse {
        if (cmd.parameters.exists(p => p.name != "replyTo")) {
          val payloadParams = cmd.parameters.filter(_.name != "replyTo")
          if (payloadParams.size == 1) {
            val p = payloadParams.head
            (ctx.typeResolver.parameterType(p.parameterType), s"command.${p.name}")
          } else {
            val tupleTypes = payloadParams.map(p => ctx.typeResolver.parameterType(p.parameterType))
            val tupleType = ctx.typeResolver.tuple(tupleTypes)
            val tupleArgs = payloadParams.map(p => s"command.${p.name}").mkString(", ")
            (tupleType, s"($tupleArgs)")
          }
        } else {
          (TypeRef.Unit, "()")
        }
      }

      val helperName = s"${cmd.name}Helper"

      // 机械回复骨架（2026-09-21 EP_Improvement_Engine 欠账⑦）：
      //   修复前此处 `val successLogic = "???"` / `val failureLogic = "???"` 把上面算好的
      //   构造表达式**丢弃**，模板只收到裸 `???`——87 个行为域的 createSuccessReply/
      //   createFailureReply 全不可填。修复：把真构造表达式喂给模板（不再用 ???）。
      //   ★ 这是**机械外壳**（可编译·语义默认），放 MANUAL 块**之外**——重生成自动更新；
      //   需要自定义语义（如按 error.code 分支）时才改 MANUAL 块。
      // ★ replyType=Unit 的判据是**回复类型**，不是 paramType——构造表达式是给 reply 用的：
      //   replyType=Unit → `()`（`Unit(x)` 非法·273 错实测）；replyType 是元组构造时取 param._1。
      val replyIsUnit = replyTypeRef.name == "Unit"
      // P4 形式路径回复族＝单槽 error: Option[iMadzError]（Reply(None)/Reply(Some(error))）；
      // 既有机械外壳（reply(error-值, Option) 两参形态）保持不变。
      val formalSingleSlot = formalReply.exists(_._2.name == replyTypeRef.name)
      val successLogic =
        if (replyIsUnit) "()"
        else if (formalSingleSlot) s"${replyTypeRef.name}(None)"
        else if (paramType.name.startsWith("Tuple")) s"${replyTypeRef.name}(param._1, None)"
        else s"${replyTypeRef.name}(param, None)"
      val failureLogic =
        if (replyIsUnit) "()"
        else if (formalSingleSlot) s"${replyTypeRef.name}(Some(error))"
        else if (paramType.name.startsWith("Tuple")) s"${replyTypeRef.name}(param._1, Some(error))"
        else s"${replyTypeRef.name}(param, Some(error))"

      CommandHelperModel(name = helperName,
        commandType = cmdType, stateType = stateType,
        paramType = paramType,
        replyType = replyTypeRef,
        errorType = errorType,
        toParamLogic = toParamLogic,
        successReplyLogic = successLogic,
        failureReplyLogic = failureLogic
      )
    }

    // 2026-08-21：递归展开 typeParams（List[Finding] 等嵌套值对象引用需进 import）
    def expandTypeRefs(t: TypeRef): Seq[TypeRef] = t +: t.typeParams.flatMap(expandTypeRefs)
    val dependencies = helpers.flatMap(h =>
      (Set(h.commandType, h.stateType, h.errorType) ++
        expandTypeRefs(h.paramType) ++ expandTypeRefs(h.replyType)).toSeq
    )
      .filter(t => t.shouldImport(pkg))
      .toSet + ctx.knownFrameworkTypes("CommandHelper")

    CommandHelpersModel(selfType, helpers, dependencies, noteIds = meta.noteId.toSeq)
  }
}
