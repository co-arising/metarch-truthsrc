package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application._

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object AggregateBehaviorTemplate extends CodeTemplate[AggregateBehaviorModel] {
  private def toCamelCase(s: String) = s.head.toLower + s.tail

  def generate(model: AggregateBehaviorModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val baseImports =
      model.dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct
    // [FIX] Import Protocol instead of Aggregate to break circular dependency
    val aggregateImport =
      if (model.aggregateType.name.endsWith("SagaTransactor")) {
        s"${model.commandType.packageName}._"
      } else {
        // Use Protocol instead of Aggregate to avoid cycle
        val protocolFqn =
          model.aggregateType.fqn.replace("Aggregate", "Protocol")
        s"$protocolFqn._"
      }
    val additionalImports = Seq(
      aggregateImport,
      "net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy",
      "scala.concurrent.duration._"
    )
    val importDecl = imports((baseImports ++ additionalImports): _*)

    val extendsClause = model.commandHelpers.map(_.name).getOrElse("")
    val handlerTypeName = s"${model.aggregateType.name}CommandHandler"
    val commandTypeName = model.commandType.name

    // [FIX] 参数名称与 Root 保持一致 (sagaContext vs repo)
    val dependencyParam = model.contextType match {
      case Some(ctx) => s"sagaContext: ${ctx.name}"
      case None      =>
        val repoType = model.dependencies
          .find(_.name.endsWith("Repository"))
          .map(_.name)
          .getOrElse("Any")
        s"repo: $repoType"
    }
    val dependencyArg =
      if (model.contextType.isDefined) "sagaContext" else "repo"

    val eventObjFqn = model.eventType.packageName
    val ctxName = model.contextType.map(_.name).getOrElse("Any")

    // 3. 构建behavior groups方法
    val groupsCode = model.behaviorGroups
      .map { g =>
        val cases = g.handlers
          .map { h =>
            val cmdName = h.commandType.name

            // AI Prompt 构建
            val aiPrompt =
              s"""      /*
      >>> AI_PROMPT_START
      Context: Command Handler
      Task: Handle command '$cmdName'
      State: ${model.stateType.name}
      Available: $dependencyArg
      Expected Result: Return Effect.persist(event) or Effect.reply
      <<< AI_PROMPT_END
      */"""

            h.logic match {
              case PolicyBasedLogic(p, helper) =>
                s"    case cmd: $cmdName => runReplyingPolicy(${p.name}, ${helper.name})(state, cmd).replyWith(cmd.replyTo)"
              case ReadOnlyLogic(replyType) =>
                // S1 聚合面（2026-09-27）：只读命令的标准机械体＝直接回当前状态（不产事件）。
                // Get<X>State 形态＝Get<X>StateReply(state)——Effect.reply 强一致（akka typed read 命令先例）。
                val replyExpr = if (replyType.name.startsWith("Get") && replyType.name.endsWith("StateReply"))
                  s"${replyType.name}(state)"
                else "???"
                s"""    case cmd: $cmdName =>
$aiPrompt
      Effect.reply(cmd.replyTo)($replyExpr) """
              case TransientCommandLogic(eventName, eventArgs) =>
                // 门/gate 暂态命令（EP_Improvement_Engine 欠账⑦）：持久化事件 **并回复**。
                //   ★ 必须 thenReply（EP §15 实测）：saga 参与者经 ask 调本命令——无回复则 ask
                //     永不完成 → 步骤 CircuitBreaker 超时（54s 假失败）。reply 类型＝<Cmd>Reply(error=None)。
                s"    case cmd: $cmdName =>\n$aiPrompt\n      Effect.persist($eventObjFqn.$eventName($eventArgs)).thenReply(cmd.replyTo)((_: ${model.stateType.name}) => ${cmdName}Reply(None))"
              case _ => ""
            }
          }
          .mkString("\n")

        val params =
          if (model.commandHelpers.isEmpty)
            s"(state: ${model.stateType.name}, context: akka.actor.typed.scaladsl.ActorContext[${commandTypeName}], coordinator: akka.cluster.sharding.typed.scaladsl.EntityRef[net.imadz.infra.saga.SagaTransactionCoordinator.Command], $dependencyParam)"
          else
            s"(state: ${model.stateType.name})"

        s"  private def ${toCamelCase(g.name)}$params: PartialFunction[${commandTypeName}, Effect[${model.eventType.name}, ${model.stateType.name}]] = {\n$cases\n  }"
      }
      .mkString("\n")

    // 4. 构建apply方法
    val applyMethod = if (model.commandHelpers.isEmpty) {
      s"""
  def apply(id: String, coordinator: akka.cluster.sharding.typed.scaladsl.EntityRef[net.imadz.infra.saga.SagaTransactionCoordinator.Command], $dependencyParam): akka.actor.typed.Behavior[${commandTypeName}] = {
    akka.actor.typed.scaladsl.Behaviors.setup { context =>
      implicit val ec: scala.concurrent.ExecutionContext = context.executionContext
      akka.persistence.typed.scaladsl.EventSourcedBehavior[$commandTypeName, ${model.eventType.name}, ${model.stateType.name}](
        persistenceId = akka.persistence.typed.PersistenceId("${model.aggregateType.name
          .replace("SagaTransactor", "")}Transaction", id),
        emptyState = ${model.stateType.name}(id = Some(id)),
        commandHandler = (state, cmd) => ${toCamelCase(
          model.behaviorGroups.head.name
        )}(state, context, coordinator, $dependencyArg).apply(cmd),
        eventHandler = (state, event) => state.applyEvent(event)
      )
      .onPersistFailure(akka.actor.typed.SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1))
    }
  }
"""
    } else {
      val funcCalls =
        model.behaviorGroups.map(g => s"${toCamelCase(g.name)}(state)")
      // 有命令被处理（无论 policy/只读/暂态）⇒ 发射接线的 orElse 链；全空才退 ??? 桩。
      val hasHandlers = model.behaviorGroups.exists(_.handlers.nonEmpty)
      if (funcCalls.nonEmpty && hasHandlers) {
        val logicChain =
          funcCalls.tail.map(call => s".orElse($call)").mkString("")
        // ★ MANUAL 块（2026-09-21 EP_Improvement_Engine 欠账⑦）：`def apply` 是**人手写行为体**
        //   的挂点（默认＝生成器拼的 orElse 链）。此前无标记 → 重生成整文件 COVER → 手写必丢。
        //   块按最近 `def` 名（apply）锚定；重生成保留人手写体，生成链仅作默认。
        s"""
  type $handlerTypeName = (${model.stateType.name}, ${commandTypeName}) => Effect[${model.eventType.name}, ${model.stateType.name}]
  def apply: $handlerTypeName = (state, command) => {
    // ==== BEGIN MANUAL ====
    ${funcCalls.head}${logicChain}.apply(command)
    // ==== END MANUAL ====
  }
"""
      } else {
        // 空行为流（工作坊 refining 未产出 invariant→命令流、且无只读命令）：
        // 生成可编译占位处理器（骨架哲学，与 H021 同类的 ??? 桩——行为侧 TDD 补全时接入）。
        // ★ MANUAL 块（2026-09-21 EP_Improvement_Engine 欠账⑦）：此前此分支**无标记** →
        //   重生成整文件 COVER → 手写行为体必丢（87 域实测）。块按最近 `def` 名（apply）锚定，
        //   重生成字节级保留人手写体。默认 `???` 与骨架哲学一致（不冒充已接线）。
        s"""
  type $handlerTypeName = (${model.stateType.name}, ${commandTypeName}) => Effect[${model.eventType.name}, ${model.stateType.name}]
  def apply: $handlerTypeName = (state, command) => {
    // ==== BEGIN MANUAL ====
    // TODO: 行为流未接线（无 invariant→命令流，且无只读命令）——行为侧补全；
    //        典型体：runReplyingPolicy(<Rule>, <Cmd>Helper)(state, cmd).replyWith(cmd.replyTo)
    ???
    // ==== END MANUAL ====
  }
"""
      }
    }

    // 5. 构建对象定义
    val objectDef = ObjectDefinition(
      name = model.selfType.name,
      extendsClause = if (extendsClause.nonEmpty) Some(extendsClause) else None,
      body = s"$applyMethod\n$groupsCode"
    )

    // 6. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(objectDef)
    )

    // 7. 生成代码
    sourceFile.code
  }
}
