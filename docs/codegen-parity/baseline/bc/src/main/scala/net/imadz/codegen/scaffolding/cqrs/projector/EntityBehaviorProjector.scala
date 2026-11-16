package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.domain.EntityBehaviorModel
import net.imadz.meta.{
  ValueObjectMetadata,
  EventFamilyMetadata,
  DomainEventMetadata
}

object EntityBehaviorProjector extends ContextProjector[EntityBehaviorModel] {

  override def project(
      model: EntityBehaviorModel,
      ctx: GeneratorContext
  ): ContextBundle = {
    // 1. Identify Types
    val stateType = model.stateType
    // Use resolved EventFamily type directly
    val eventBaseRef = model.eventFamilyType

    // 2. Generate Dependency Snippets
    val dependencies = Seq(
      ProjectorUtils.resolveStateSnippet(stateType, ctx),
      ProjectorUtils.resolveEventFamilySnippet(eventBaseRef, ctx)
    ).flatten

    // 3. Generate Target Snippet
    val targetContent = ContextGenDSL.renderTrait(
      model.selfType.name,
      Seq(
        ContextGenDSL.renderMethod(
          "applyEvent",
          Seq("state" -> stateType.name, "event" -> eventBaseRef.name),
          stateType.name
        )
      )
    )
    val targetSnippet =
      CodeSnippet(model.selfType.name + ".scala", targetContent, "Target")

    ContextBundle(targetSnippet, dependencies)
  }
}
