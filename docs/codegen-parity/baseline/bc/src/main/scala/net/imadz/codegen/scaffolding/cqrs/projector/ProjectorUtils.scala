package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.meta.{ValueObjectMetadata, EventFamilyMetadata}

object ProjectorUtils {

  def resolveTypeName(meta: net.imadz.meta.MetaType): String = {
    import net.imadz.meta._
    meta match {
      case d: DataType => d.fullQualifiedName.dottedPath
      case r: MetaRef  => r.targetName
      case _           => meta.toString
    }
  }

  def resolveStateSnippet(
      typeRef: TypeRef,
      ctx: GeneratorContext
  ): Option[CodeSnippet] = {
    ctx.metaRegistry.resolveByName[ValueObjectMetadata](typeRef.name).map {
      meta =>
        val fields =
          meta.fields.map(f => f.name -> resolveTypeName(f.fieldType))
        CodeSnippet(
          typeRef.name + ".scala",
          ContextGenDSL.renderCaseClass(typeRef.name, fields),
          "Dependency"
        )
    }
  }

  def resolveEventFamilySnippet(
      familyRef: TypeRef,
      ctx: GeneratorContext
  ): Option[CodeSnippet] = {
    ctx.metaRegistry.resolveByName[EventFamilyMetadata](familyRef.name).map {
      meta =>
        val traitDef = ContextGenDSL.renderSealedTrait(familyRef.name)
        val eventDefs = meta.events.map { evt =>
          val fields =
            evt.fields.map(f => f.name -> resolveTypeName(f.fieldType))
          s"case class ${evt.name}(${fields.map { case (n, t) => s"$n: $t" }.mkString(", ")}) extends ${familyRef.name}"
        }
        val content = (traitDef +: eventDefs).mkString("\n\n")
        CodeSnippet(familyRef.name + ".scala", content, "Dependency")
    }
  }
}
