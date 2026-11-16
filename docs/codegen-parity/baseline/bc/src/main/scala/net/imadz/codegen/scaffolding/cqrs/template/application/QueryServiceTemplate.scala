package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application.QueryServiceModel
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.domain.ValueObjectModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object QueryServiceTemplate extends CodeTemplate[QueryServiceModel] {

  // Helper to render ValueObject as companion object DTO
  private def renderStruct(model: ValueObjectModel): String = {
    val fields = model.fields
      .map(f => s"${NamingConventions.scalaIdentifier(f.name)}: ${f.typeRef.signature}")
      .mkString(", ")

    val extendsReadModel = model.dependencies.exists(_.name == "ReadModel")
    val extendsClause = if (extendsReadModel) " extends ReadModel" else ""

    s"  case class ${model.selfType.name}($fields)$extendsClause"
  }

  def generate(model: QueryServiceModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val baseImports = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(t =>
        t == "javax.inject.Inject" || t == "scala.concurrent.ExecutionContext" || t == "akka.util.Timeout"
      )
      .filterNot(t => t.startsWith("scala") || t.startsWith("java.lang"))
      .distinct

    val additionalImports = Seq(
      "javax.inject.Inject",
      "scala.concurrent.ExecutionContext",
      "scala.concurrent.Future",
      "akka.util.Timeout"
    )

    val importDecl = imports((baseImports ++ additionalImports): _*)

    // 3. 构建伴生对象（用于DTO/Struct定义）
    val structsCode = model.structs.map(renderStruct).mkString("\n\n")

    val companionObject: Option[ObjectDefinition] = if (structsCode.nonEmpty) {
      Some(
        ObjectDefinition(
          name = model.selfType.name,
          body = structsCode
        )
      )
    } else None

    // 4. 构建构造函数参数（依赖项）
    val deps = model.dependencies
      .filterNot(t =>
        t.name == "Inject" || t.name == "Timeout" || t.name == "ExecutionContext" || t.name == "Singleton"
      )
      .filterNot(t =>
        t.packageName.startsWith("scala") || t.packageName.startsWith("java")
      )
      .filter { t =>
        t.name.endsWith("Repository") ||
        t.name.endsWith("Factory") ||
        t.name.endsWith("Service") ||
        t.name.endsWith("Query")
      }

    val constructorArgs = deps
      .map { dep =>
        val paramName = dep.name.head.toLower + dep.name.tail
        s"$paramName: ${dep.name}"
      }
      .mkString(",\n    ")

    val availableDeps =
      deps.map(d => d.name.head.toLower + d.name.tail).mkString(", ")

    // 5. 构建服务方法
    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        val returnSig = m.returnType.signature

        val logicDesc = m.bodyLogic.replace("\n", " ").trim

        s"""
  /**
   * ${m.name}
   */
  def ${m.name}($params): $returnSig = {
    /*
    >>> AI_PROMPT_START
    Context: Query Service (Read Side)
    Task: Implement query logic for '${m.name}'
    Description: $logicDesc
    Available Repos/Services: $availableDeps
    Input Params: $params
    Return: $returnSig
    <<< AI_PROMPT_END
    */
    ???
  }
"""
      }
      .mkString("\n")

    // 6. 构建Timeout定义
    val hasTimeout = model.dependencies.exists(_.name == "Timeout")
    val timeoutDefinition = if (hasTimeout) {
      "\n  implicit val askTimeout: Timeout = Timeout(30 seconds)\n  import scala.concurrent.duration.DurationInt\n  import scala.language.postfixOps"
    } else ""

    // 7. 构建类定义
    val classDef = s"""/**
 * ${model.selfType.name}: Query Service
 */
class ${model.selfType.name} @Inject() (${constructorArgs}) (implicit val ec: ExecutionContext) {
$timeoutDefinition

$methodsCode
}
"""

    // 8. 构建完整源代码
    val companionCode = companionObject.map(_.code).getOrElse("")
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

$companionCode

$classDef
"""

    // 9. 生成代码
    sourceCode
  }
}
