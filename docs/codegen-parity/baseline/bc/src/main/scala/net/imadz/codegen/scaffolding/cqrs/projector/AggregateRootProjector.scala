package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, ArtifactModel}
import net.imadz.codegen.scaffolding.cqrs.model.application.AggregateRootModel

object AggregateRootProjector extends ContextProjector[AggregateRootModel] {

  override def project(
      model: AggregateRootModel,
      ctx: GeneratorContext
  ): ContextBundle = {
    // 1. Target Snippet
    val stateName = model.stateType.name
    val eventName = model.eventType.name
    val commandName = model.commandFamilyType.name

    val targetContent = ContextGenDSL.renderTrait(
      model.selfType.name,
      Seq(
        s"// State: $stateName",
        s"// Event: $eventName",
        s"// Command: $commandName",
        "def handleCommand(state: State, cmd: Command): ReplyEffect",
        "def onEvent(state: State, event: Event): State"
      )
    )
    val targetSnippet =
      CodeSnippet(model.selfType.name + ".scala", targetContent, "Target")

    // 2. Dependencies
    val stateSnippet = ProjectorUtils.resolveStateSnippet(model.stateType, ctx)
    val eventSnippet =
      ProjectorUtils.resolveEventFamilySnippet(model.eventType, ctx)

    val commandSnippet = CodeSnippet(
      model.commandFamilyType.name + ".scala",
      s"// Protocol: ${model.commandFamilyType.name}",
      "Dependency"
    )

    ContextBundle(
      targetSnippet,
      Seq(stateSnippet, eventSnippet, Option(commandSnippet)).flatten
    )
  }
}
