package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.connector

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.connector.ConnectorImplModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.structure.NamingConventions

/** Connector 实现模板（infrastructure 层）——镜像 ProjectionRepositoryImplTemplate：
  * `@Singleton class X @Inject()(handwrittenRunner) extends XConnector`，每方法一个 MANUAL 块。
  *
  * 注入式构造必须 `@Inject()`（Guice 对无注解多参构造不实例化——9000 CreationException 实证）。
  * MANUAL 块按最近前置 `def` 名锚定（WriteTerritory.DefAnchorRegex）——重生成字节级保留手写调用。 */
object ConnectorImplTemplate extends CodeTemplate[ConnectorImplModel] {

  def generate(model: ConnectorImplModel): String = {
    val pkgDecl = packageDecl(model.selfType.packageName)

    val hasInjectedCtor = model.injectedConstructorParams.nonEmpty
    val constructorParams = if (hasInjectedCtor)
      "(" + model.injectedConstructorParams.map(p => s"${p.name}: ${p.typeRef.signature}").mkString(", ") + ")"
    else ""

    val baseImports = model.dependencies.toList
      .sortBy(_.fqn).map(_.fqn)
      .filterNot(p => p.isEmpty || p == model.selfType.packageName || p.startsWith("java.lang"))

    val importList = (baseImports ++ Seq(
      s"${model.interfaceType.packageName}.${model.interfaceType.name}",
      "scala.concurrent.{ExecutionContext, Future}",
      "javax.inject.Singleton"
    ) ++ (if (hasInjectedCtor) Seq("javax.inject.Inject") else Nil)).distinct
    val importDecl = imports(importList: _*)

    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}").mkString(", ")
        val anchor = net.imadz.codegen.scaffolding.cqrs.CQRSApplicationGenerator.annotateKnowledge(m.anchorNoteId)
          .map(id => s"    // @knowledge $id\n").getOrElse("")
        val body = m.defaultBody.split("\n").map(l => s"    $l").mkString("\n")
        s"""  override def ${m.name}($params): scala.concurrent.Future[${m.returnType.signature}] = {
    // ==== BEGIN MANUAL ====
$anchor$body
    // ==== END MANUAL ====
  }"""
      }
      .mkString("\n\n")

    s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: Connector Implementation
 * 机械委托给注入的手写基建（子进程机械在手写区·不在此生成物）。
 */
@Singleton
class ${model.selfType.name}${if (hasInjectedCtor) " @Inject() " else ""}$constructorParams extends ${model.interfaceType.name} {

$methodsCode

}
"""
  }
}
