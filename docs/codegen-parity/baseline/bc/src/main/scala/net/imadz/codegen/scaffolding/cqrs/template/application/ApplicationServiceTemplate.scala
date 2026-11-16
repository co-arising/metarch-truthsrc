package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.ApplicationServiceModel
import net.imadz.codegen.structure.NamingConventions

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object ApplicationServiceTemplate
    extends CodeTemplate[ApplicationServiceModel] {

  def generate(model: ApplicationServiceModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val baseImports = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .distinct
      .filterNot(t =>
        t == "javax.inject.Inject" || t == "javax.inject.Singleton" || t == "scala.concurrent.ExecutionContext"
      )
      .filterNot(t => t.startsWith("scala") || t.startsWith("java.lang"))

    val additionalImports = Seq(
      "javax.inject.{Inject, Singleton}",
      "scala.concurrent.{ExecutionContext, Future}",
      "akka.actor.typed.scaladsl.adapter._"
    )

    val importDecl = imports((baseImports ++ additionalImports): _*)

    // 3. 构造函数参数
    val constructorArgs = model.dependencies
      .filterNot(t =>
        t.name == "Inject" || t.name == "Singleton" || t.name == "ExecutionContext"
      )
      .filterNot(t =>
        t.packageName.startsWith("scala") || t.packageName.startsWith("java")
      )
      .filter { t =>
        val name = t.name
        name.endsWith("Repository") ||
        name.endsWith("Factory") ||
        name.endsWith("Service") ||
        name.endsWith("Query") ||
        name.endsWith("Connector") ||   // 2026-09-20 EP_Improvement_Engine：Connector 注入
        name == "ActorSystem"
      }
      .map { dep =>
        val paramName = NamingConventions.firstLower(dep.name)
        if (dep.name == "ActorSystem") s"classicSystem: akka.actor.ActorSystem"
        else s"$paramName: ${dep.name}"
      }
      .mkString(",\n    ")

    // 4. 构建类方法
    // ★ 手写区（2026-09-20 EP_Improvement_Engine）：方法体包一个 MANUAL 块——此前 `= ???` 无标记，
    //   重生成整文件 COVER → 手写逻辑必丢。MANUAL 块按最近前置 `def` 名锚定，重生成字节级保留。
    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        s"""  def ${m.name}($params): ${m.returnType.signature} = {
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }"""
      }
      .mkString("\n\n")

    // 5. 额外字段（ActorSystem转换）
    val extraFields = if (model.dependencies.exists(_.name == "ActorSystem")) {
      "\n  private val system = classicSystem.toTyped\n"
    } else ""

    // 6. 构建类定义
    val classDef = s"""@Singleton
class ${model.selfType.name} @Inject() (
    $constructorArgs
) (implicit ec: ExecutionContext) {

$extraFields$methodsCode

}
"""

    // 5. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

$classDef
"""

    // 6. 生成代码
    sourceCode
  }
}
