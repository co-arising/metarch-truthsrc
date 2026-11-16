package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.CommandHelpersModel

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.scaffolding.cqrs.model.application.CommandHelpersModel

object CommandHelpersTemplate extends CodeTemplate[CommandHelpersModel] {

  def generate(model: CommandHelpersModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importList = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(t =>
        t.isEmpty || t.startsWith("scala") || t.startsWith("java.lang")
      )
      .distinct

    val importDecl = imports(importList: _*)

    // 3. 渲染每个 Helper Object
    val helpersCode = model.helpers
      .map { helper =>
        // 泛型参数：[T, S, P, R]
        val genericArgs = Seq(
          helper.commandType.signature,
          helper.stateType.signature,
          helper.paramType.signature,
          helper.replyType.signature
        ).mkString(", ")

        // T 是 Command, S 是 State, P 是 Param, R 是 Reply
        // ★ 手写区（2026-09-20 EP_Improvement_Engine；2026-09-21 修欠账⑦）：
        //   三方法体各包一个 MANUAL 块——本文件自称「AI 填空的主要战场」。MANUAL 块按最近
        //   前置 `def` 名锚定（WriteTerritory.DefAnchorRegex），重生成字节级保留。
        //   ★ 块内**默认值＝可编译的机械骨架**（不是裸 `???`）：开箱即编译；需要自定义语义
        //     （如按 error.code 分支）时人在块内改，重生成保留其编辑。
        //     修复前 successLogic/failureLogic 被 builder 丢弃成裸 `???` → 87 域不可填。
        s"""
  implicit object ${helper.name} extends CommandHelper[$genericArgs] {
    override def toParam(state: ${helper.stateType.name}, command: ${helper.commandType.name}): ${helper.paramType.signature} = {
      // ==== BEGIN MANUAL ====
      ${helper.toParamLogic} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }

    override def createFailureReply(param: ${helper.paramType.signature})(error: iMadzError): ${helper.replyType.name} = {
      // ==== BEGIN MANUAL ====
      ${helper.failureReplyLogic} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }

    override def createSuccessReply(param: ${helper.paramType.signature})(state: ${helper.stateType.name}): ${helper.replyType.name} = {
      // ==== BEGIN MANUAL ====
      ${helper.successReplyLogic} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }
  }
"""
      }
      .mkString("\n")

    // 4. 构建trait定义
    val traitComment = s"""/**
 * 胶水代码库：负责将 Command 转换为 Policy 参数，并将结果包装为 Reply。
 * 这里是 AI 填空的主要战场。
 */
"""

    val traitDef = s"""
$traitComment
trait ${model.selfType.name} {

$helpersCode

}
"""

    // 5. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

$traitDef
"""

    // 6. 生成代码
    sourceCode
  }
}
