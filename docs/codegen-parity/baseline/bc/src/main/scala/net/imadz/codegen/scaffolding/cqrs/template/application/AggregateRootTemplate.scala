package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.FieldDef
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application.AggregateRootModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object AggregateRootTemplate extends CodeTemplate[AggregateRootModel] {

  def generate(model: AggregateRootModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importList = model.dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct
    val importDecl = imports(importList: _*)

    def renderFields(fields: Seq[FieldDef]): String = {
      fields
        .map(f =>
          s"${NamingConventions.scalaIdentifier(f.name)}: ${f.typeRef.signature}${f.defaultValue.map(d => s" = $d").getOrElse("")}"
        )
        .mkString(", ")
    }

    // [FIX] 检测 Saga 应该使用名称后缀，而不是依赖 inlineState
    val isSaga = model.selfType.name.endsWith("SagaTransactor")

    // 3. 构建inline状态和事件代码
    val inlineCode = if (model.inlineState.isDefined) {
      val state = model.inlineState.get
      val evName =
        if (model.eventType != null) model.eventType.name
        else "TransactionEvent"

      s"""
  // --- Inline State & Events ---
  sealed trait $evName extends CborSerializable
  ${model.inlineEvents
          .map(e =>
            s"case class ${e.name}(${renderFields(e.fields)}) extends $evName"
          )
          .mkString("\n  ")}

  sealed trait Status extends CborSerializable
  object Status { case object New extends Status; case object Initiated extends Status; case object Prepared extends Status; case object Completed extends Status; case class Failed(reason: String) extends Status }

  case class ${state.name}(${renderFields(
          state.fields
        )}, status: Status = Status.New) extends CborSerializable {
    def applyEvent(event: $evName): ${state.name} = {
      /*
      >>> AI_PROMPT_START
      Context: Saga Inline State Transition
      Task: Update state based on event
      Event: $evName
      Current State: ${state.name}
      Goal: Return a new copy of the state with updated fields and status.
      <<< AI_PROMPT_END
      */
      ???
    }
  }

  object ${state.name} {
     def empty(id: String): ${state.name} = ${state.name}(id = Some(id))
  }
"""
    } else ""

    // 5. 构建factory代码
    val factoryCode = model.stepsFactory
      .map { f =>
        val params = renderFields(f.parameters)
        s"""  def ${f.methodName}($params): List[SagaTransactionStep[iMadzError, String, ${f.contextType.name}]] = {
    /*
    >>> AI_PROMPT_START
    Context: Saga Transaction Definition
    Task: Define the sequence of steps for this Saga
    Input Params: $params
    Return: List of SagaTransactionStep
    Logic: Define steps (initial, compensating, etc.) using the DSL.
    <<< AI_PROMPT_END
    */
    ???
  }"""
      }
      .getOrElse("")

    // 6. 构建commands和replies代码
    // 6. Commands & Replies Generation (Removed - Moved to Protocol)
    val commandsCode = "// Commands are defined in Protocol"

    val repliesCode = "// Replies are defined in Protocol"

    // 7. 构建wiring代码
    val wiringCode = if (isSaga) {
      val ctxName = model.contextType.map(_.name).getOrElse("Any")

      s"""
  // --- Factory ---
  def apply(id: String, coordinator: akka.cluster.sharding.typed.scaladsl.EntityRef[net.imadz.infra.saga.SagaTransactionCoordinator.Command], sagaContext: $ctxName): akka.actor.typed.Behavior[${model.commandFamilyType.name}] =
    ${model.behaviorObject.name}.apply(id, coordinator, sagaContext)
"""
    } else {
      // CommandHandler type alias moved to Protocol to break circular dependency
      // commandFamilyType.packageName is the Protocol object FQN (e.g. net.imadz...CreditBalanceProtocol)
      val protocolFqn = model.commandFamilyType.packageName
      val handlerTypeName =
        model.commandFamilyType.name.replace("Command", "CommandHandler")
      s"""
  // Wiring (Separated Behavior) - Type alias now in Protocol
  def commandHandler: $protocolFqn.$handlerTypeName = ${model.behaviorObject.name}.apply
"""
    }

    // 8. 构建sharding代码
    val shardingCode =
      if (isSaga) {
        s"  val entityTypeKey: EntityTypeKey[${model.commandFamilyType.name}] = EntityTypeKey(\"${model.sharding.typeKeyName}\")"
      } else if (model.sharding != null && model.sharding.typeKeyName != null) {
        s"""
  val entityTypeKey: EntityTypeKey[${model.commandFamilyType.name}] = EntityTypeKey("${model.sharding.typeKeyName}")
  val tags: Vector[String] = Vector.tabulate(${model.sharding.shardCount})(i => s"${model.sharding.taggingBaseName}$$i")
"""
      } else {
        s"  val entityTypeKey: EntityTypeKey[${model.commandFamilyType.name}] = EntityTypeKey(\"${model.commandFamilyType.name}\")"
      }

    // 9. 构建所有内容的主体部分
    // sealed trait removed
    val body = s"""
$commandsCode
$repliesCode
$inlineCode
$factoryCode

$wiringCode

$shardingCode
"""

    // 10. 构建对象定义
    val objectDef = ObjectDefinition(
      name = model.selfType.name,
      body = body
    )

    // 11. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(objectDef)
    )

    // 12. 生成代码
    sourceFile.code
  }
}
