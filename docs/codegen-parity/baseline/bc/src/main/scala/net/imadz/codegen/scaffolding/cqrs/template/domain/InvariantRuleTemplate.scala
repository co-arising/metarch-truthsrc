package net.imadz.codegen.scaffolding.cqrs.template.domain

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.domain.InvariantRuleModel
import net.imadz.codegen.structure.NamingConventions

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object InvariantRuleTemplate extends CodeTemplate[InvariantRuleModel] {

  def generate(model: InvariantRuleModel): String = {
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
        ): _*
    )

    // 3. 渲染错误定义
    val errorsCode = model.conditions
      .map { c =>
        s"  private val ${c.name}: iMadzError = iMadzError(\"${c.errorCode}\", \"${c.errorMsg}\")"
      }
      .mkString("\n")

    // 4. 渲染规则检查逻辑
    val logicCode = model.conditions
      .map { c =>
        s"    // if (${c.logicDescription}) Left(${c.name}) // Raw logic injection disabled"
      }
      .mkString("\n    // else ")

    // 5. 参数名
    val stateParamName = NamingConventions.firstLower(model.subjectType.name)
    val triggerParamName = NamingConventions.firstLower(model.triggerType.name)

    // 6. 构建apply方法代码
    val applyMethodCode =
      s"""  def apply($stateParamName: ${model.subjectType.signature}, $triggerParamName: ${model.triggerType.signature}): Either[iMadzError, List[${model.outputType.signature}]] = {
    /*
    >>> AI_PROMPT_START
    Context: Invariant Rule Execution
    Task: Validate conditions and generate events
    Subject: $stateParamName
    Trigger: $triggerParamName
    Defined Conditions: ${model.conditions.map(_.name).mkString(", ")}
    Goal: If all validations pass (logic below), return Right(List(events...)).
    <<< AI_PROMPT_END
    */
    // Logic disabled for referenced variables mismatch
    /*
    $logicCode
    */
    
    // Result
    {
      // TODO: All conditions passed. Generate events.
      ???
    }
  }"""

    // 7. 构建对象定义
    val invariantRuleObj = objectDef(
      name = model.selfType.name,
      extendsClause = model.superInterface.signature,
      body = s"$errorsCode\n\n$applyMethodCode"
    )

    // 8. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(invariantRuleObj)
    )

    // 9. 生成代码
    sourceFile.code
  }

  private def firstLower(s: String): String = s.head.toLower + s.tail
}
