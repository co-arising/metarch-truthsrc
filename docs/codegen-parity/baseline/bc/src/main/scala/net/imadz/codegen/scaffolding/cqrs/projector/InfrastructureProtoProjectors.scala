package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.proto._

object InfrastructureProtoProjectors {

  implicit object ProtoFileProjector extends ContextProjector[ProtoFileModel] {
    override def project(
        model: ProtoFileModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val messages =
        model.messages.map(m => s"// message ${m.name} { ... }").mkString("\n")
      val content = s"""// Proto File: ${model.fileName}
         |// Package: ${model.packageName}
         |$messages
         |""".stripMargin
      // Proto files are resources, but we project them as text snippets for context
      ContextBundle(CodeSnippet(model.fileName, content, "Target"), Nil)
    }
  }
}
