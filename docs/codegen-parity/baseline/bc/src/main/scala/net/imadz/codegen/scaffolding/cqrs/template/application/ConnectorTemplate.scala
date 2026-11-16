package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.ConnectorModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.structure.NamingConventions

/** Connector 能力面模板（application 层）——镜像 AggregateRepositoryTemplate。
  * 产出：`@ImplementedBy(classOf[<Impl>]) trait <Name> { def m(...): R }`。 */
object ConnectorTemplate extends CodeTemplate[ConnectorModel] {

  def generate(model: ConnectorModel): String = {
    val pkgDecl = packageDecl(model.selfType.packageName)

    val importList = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(p => p.isEmpty || p == model.selfType.packageName || p.startsWith("java.lang"))
      .++(Seq("javax.inject._", "com.google.inject.ImplementedBy"))
      .distinct

    val importDecl = imports(importList: _*)

    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        s"  def ${m.name}($params): scala.concurrent.Future[${m.returnType.signature}]\n  // Logic: ${m.intent}"
      }
      .mkString("\n\n")

    val annotation = s"@ImplementedBy(classOf[${model.isImplementedBy.name}])"
    val anchor = net.imadz.codegen.scaffolding.cqrs.CQRSApplicationGenerator.annotateKnowledge(model.noteId)
      .map(id => s"/** @knowledge $id */\n").getOrElse("")
    val traitDefinition = s"""/**
 * ${model.selfType.name}: Application Layer Connector Interface
 * 调外部工具（Node 子进程）的能力面——子进程机械在 infrastructure impl 里（注入手写基建）。
 */
$anchor$annotation
trait ${model.selfType.name} {

$methodsCode

}
"""

    s"""${pkgDecl.code}

${importDecl.code}

$traitDefinition
"""
  }
}
