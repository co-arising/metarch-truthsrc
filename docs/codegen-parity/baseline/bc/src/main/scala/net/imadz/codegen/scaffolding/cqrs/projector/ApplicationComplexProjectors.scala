package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.application._

object ApplicationComplexProjectors {

  implicit object AggregateBehaviorProjector
      extends ContextProjector[AggregateBehaviorModel] {
    override def project(
        model: AggregateBehaviorModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val stateName = model.stateType.name
      val eventName = model.eventType.name
      val cmdName = model.commandType.name // Base Command

      val content = s"""trait ${model.selfType.name} {
        |  // Handles commands and produces effects
        |  def handleCommand(state: $stateName, cmd: $cmdName): ReplyEffect
        |}""".stripMargin
      val targetSnippet =
        CodeSnippet(model.selfType.name + ".scala", content, "Target")

      val deps = Seq(
        ProjectorUtils.resolveStateSnippet(model.stateType, ctx),
        ProjectorUtils.resolveEventFamilySnippet(model.eventType, ctx)
        // Command snippet?
      ).flatten

      ContextBundle(targetSnippet, deps)
    }
  }

  implicit object AggregateFactoryProjector
      extends ContextProjector[AggregateFactoryModel] {
    override def project(
        model: AggregateFactoryModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val methods = model.factoryMethods.map { m =>
        val params = m.parameters.map(p => p.name -> p.typeRef.name)
        ContextGenDSL.renderMethod(m.name, params, m.returnType.name)
      }
      val content = ContextGenDSL.renderTrait(model.selfType.name, methods)
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object CommandHelpersProjector
      extends ContextProjector[CommandHelpersModel] {
    override def project(
        model: CommandHelpersModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val helpers = model.helpers
        .map(h => s"// Helper: ${h.name} for ${h.commandType.name}")
        .mkString("\n")
      val content = s"trait ${model.selfType.name} {\n  $helpers\n}"
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }

  implicit object ProjectionProjector
      extends ContextProjector[ProjectionModel] {
    override def project(
        model: ProjectionModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val handlers = model.handlers
        .map(h => s"// Handler: ${h.selfType.name} for ${h.event.name}")
        .mkString("\n")
      val content = s"""trait ${model.selfType.name} {
         |  // Projection wiring
         |  $handlers
         |}""".stripMargin
      ContextBundle(
        CodeSnippet(model.selfType.name + ".scala", content, "Target"),
        Nil
      )
    }
  }
}
