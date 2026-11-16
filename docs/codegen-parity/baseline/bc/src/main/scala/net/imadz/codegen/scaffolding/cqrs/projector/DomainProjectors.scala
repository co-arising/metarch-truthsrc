package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.domain._

object DomainProjectors {

  implicit object ValueObjectProjector
      extends ContextProjector[ValueObjectModel] {
    override def project(
        model: ValueObjectModel,
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

  implicit object DomainEntityProjector
      extends ContextProjector[DomainEntityModel] {
    override def project(
        model: DomainEntityModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      // 1. State Snippet
      val stateContent = ContextGenDSL.renderCaseClass(
        model.state.name,
        model.state.fields.map(f => f.name -> f.typeRef.name)
      )
      val stateSnippet =
        CodeSnippet(model.state.name + ".scala", stateContent, "Dependency")

      // 2. Event Family Snippet
      val eventsContent = {
        val traitDef = ContextGenDSL.renderSealedTrait(model.eventFamily.name)
        val evts = model.eventFamily.events.map { evt =>
          val fields = evt.fields.map(f => f.name -> f.typeRef.name)
          s"case class ${evt.name}(${fields.map { case (n, t) => s"$n: $t" }.mkString(", ")}) extends ${model.eventFamily.name}"
        }
        (traitDef +: evts).mkString("\n\n")
      }
      val eventSnippet = CodeSnippet(
        model.eventFamily.name + ".scala",
        eventsContent,
        "Dependency"
      )

      // 3. Entity Target Snippet
      val targetContent =
        s"// Entity: ${model.selfType.name}\n// State: ${model.state.name}\n// Events: ${model.eventFamily.name}"
      val targetSnippet =
        CodeSnippet(model.selfType.name + ".scala", targetContent, "Target")

      ContextBundle(targetSnippet, Seq(stateSnippet, eventSnippet))
    }
  }

  implicit object DomainServiceProjector
      extends ContextProjector[DomainServiceModel] {
    override def project(
        model: DomainServiceModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val methods = model.methods.map { m =>
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

  implicit object InvariantRuleProjector
      extends ContextProjector[InvariantRuleModel] {
    override def project(
        model: InvariantRuleModel,
        ctx: GeneratorContext
    ): ContextBundle = {
      val content =
        s"// Policy: ${model.selfType.name}\n// Trigger: ${model.triggerType.name}\n// Output: ${model.outputType.name}"
      // Rules?
      val rules = model.conditions
        .map(r => s"// Rule: ${r.name} -> ${r.errorCode}")
        .mkString("\n")
      ContextBundle(
        CodeSnippet(
          model.selfType.name + ".scala",
          content + "\n" + rules,
          "Target"
        ),
        Nil
      )
    }
  }
}
