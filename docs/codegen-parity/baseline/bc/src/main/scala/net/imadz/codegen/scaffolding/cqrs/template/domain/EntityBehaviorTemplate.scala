package net.imadz.codegen.scaffolding.cqrs.template.domain

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.domain.EntityBehaviorModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object EntityBehaviorTemplate extends CodeTemplate[EntityBehaviorModel] {

  def generate(model: EntityBehaviorModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importDecl = imports(
      model.dependencies.toList
        .sortBy(_.fqn)
        .map(_.fqn)
        .filterNot(p =>
          p.isEmpty || p == model.selfType.packageName || p.startsWith(
            "java.lang"
          )
        ) :+
        model.handlerTypeAlias.fqn // 显式导入类型别名
      : _*
    )

    // 3. 生成mutations代码
    val mutationsCode = model.mutations
      .map { m =>
        val code = if (m.collectionFolds.isEmpty) m.logicCode else {
          def expr(value: String): String = if (value.startsWith("literal:")) ujson.write(ujson.Str(value.drop(8))) else value
          val rows = m.collectionFolds.map { row =>
            val key = expr(row.key.get)
            row.op match {
              case "put" => s"${row.slot} = state.${row.slot} + ($key -> ${expr(row.value.get)})"
              case "remove" => s"${row.slot} = state.${row.slot} - $key"
              case "put-all" => s"${row.slot} = state.${row.slot} ++ $key.map(k => k -> ${expr(row.value.get)})"
              case "remove-all" => s"${row.slot} = state.${row.slot} -- $key"
              case _ => throw new IllegalArgumentException("unsupported collection fold")
            }
          }
          "state.copy(\n        " + rows.mkString(",\n        ") + "\n      )"
        }
        s"    case event: ${m.eventType.name} =>\n      $code"
      }
      .mkString("\n\n")

    // 4. 生成辅助方法代码 (注入 AI Prompt)
    val helpersCode = model.helperMethods
      .map { m =>
        val params =
          m.params.map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}").mkString(", ")

        // 2026-09-23 EP_GenerationTime_Code_Anchors B4（**形态③**）：辅助方法参数＝命令参数落点
        // （`EntityBehaviorBuilder:181` 早已透传 noteId），在 `def` 前补 `@param … @knowledge` 块。
        val fieldDoc = net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.fieldDoc(m.params, "  ")

        // 提取 logicCode 作为 Prompt 的一部分
        val logicDesc = m.logicCode

        s"""$fieldDoc  private def ${m.name}($params): ${m.returnType.signature} = {
    /*
    >>> AI_PROMPT_START
    Context: Domain Entity Helper Method
    Task: Implement logic for ${m.name}
    Description: $logicDesc
    Input Params: $params
    Return: ${m.returnType.signature}
    <<< AI_PROMPT_END
    */
    ???
  }"""
      }
      .mkString("\n\n")

    // 5. 构建apply方法代码
    val applyMethodCode =
      s"  def apply: ${model.handlerTypeAlias.name} = (state, event) => event match {\n$mutationsCode\n    case _ => state // 默认兜底，或者抛异常\n  }"

    // 6. 构建对象定义
    val behaviorObj = objectDef(
      name = model.selfType.name,
      body = s"$applyMethodCode\n\n$helpersCode"
    )

    // 7. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(behaviorObj)
    )

    // 8. 生成代码
    sourceFile.code
  }
}
