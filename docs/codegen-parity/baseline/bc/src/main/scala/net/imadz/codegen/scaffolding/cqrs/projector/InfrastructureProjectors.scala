package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.ControllerModel
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap.BootstrapModel

object InfrastructureProjectors {

  implicit object ControllerProjector
      extends ContextProjector[ControllerModel] {
    override def project(
        model: ControllerModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val endpoints = model.endpoints.map { ep =>
        val fullPath =
          if (model.basePath.endsWith("/") && ep.path.startsWith("/")) {
            model.basePath + ep.path.drop(1)
          } else if (
            !model.basePath.endsWith("/") && !ep.path.startsWith("/")
          ) {
            model.basePath + "/" + ep.path
          } else {
            model.basePath + ep.path
          }
        s"// ${ep.method} $fullPath -> ${ep.actionName}"
      }
      val content = s"""trait ${model.selfType.name} {
         |  // Controller Endpoints
         |  ${endpoints.mkString("\n  ")}
         |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object BootstrapProjector extends ContextProjector[BootstrapModel] {
    override def project(
        model: BootstrapModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content = s"object ${model.selfType.name} extends App { ... }"
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }
}
