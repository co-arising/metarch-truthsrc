package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor._

object SagaProjectors {

  implicit object SagaParticipantProjector
      extends ContextProjector[SagaParticipantModel] {
    override def project(
        model: SagaParticipantModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val actions = Seq(
        model.prepareBinding,
        model.commitBinding,
        model.compensateBinding
      ).flatten
        .map(a =>
          s"// Action: ${a.commandType.name} -> ${a.repositoryFieldName}"
        )
        .mkString("\n  ")

      val content = s"""trait ${model.selfType.name} {
         |  // Participant Logic
         |  $actions
         |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object SagaContextProjector
      extends ContextProjector[SagaContextModel] {
    override def project(
        model: SagaContextModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val fields = model.fields.map(f => f.name -> f.typeRef.name)
      val content = ContextGenDSL.renderCaseClass(model.selfType.name, fields)
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }
}
