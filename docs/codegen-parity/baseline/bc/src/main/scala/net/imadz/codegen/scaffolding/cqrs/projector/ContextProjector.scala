package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, GeneratorContext}

case class CodeSnippet(
    fileName: String,
    content: String,
    role: String // "Target", "Dependency"
) {
  def isTarget: Boolean = role == "Target"
}

case class ContextBundle(
    target: CodeSnippet,
    dependencies: Seq[CodeSnippet]
) {
  def allSnippets: Seq[CodeSnippet] = target +: dependencies

  def renderMarkdown: String = {
    allSnippets
      .map { s =>
        s"""### ${s.role}: ${s.fileName}
         |```scala
         |${s.content}
         |```
         |""".stripMargin
      }
      .mkString("\n")
  }
}

trait ContextProjector[M <: ArtifactModel] {
  def project(model: M, ctx: GeneratorContext): ContextBundle
}
