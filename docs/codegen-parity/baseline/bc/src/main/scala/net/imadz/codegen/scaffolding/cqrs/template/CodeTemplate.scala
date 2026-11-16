package net.imadz.codegen.scaffolding.cqrs.template

import net.imadz.codegen.scaffolding.cqrs.ArtifactModel

trait CodeTemplate[M <: ArtifactModel] {
  def generate(model: M): String
}
