package net.imadz.codegen.scaffolding.cqrs.builder.domain

import net.imadz.codegen.scaffolding.cqrs.model.domain.{
  DomainServiceMethodModel,
  DomainServiceModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeResolver
}
import net.imadz.meta._

object DomainServiceBuilder {

  def build(
      meta: DomainServiceMetadata,
      ctx: GeneratorContext
  ): DomainServiceModel = {
    // 1. Self Type
    val pkg = ctx.layout.domain.services.root
    val selfType = ctx.typeResolver.domainService(meta.name)

    // 2. Super Interface (注入 DomainService)
    val superInterface = ctx.types.DomainService

    // 3. Methods
    val methods = meta.methods.map { m =>
      DomainServiceMethodModel(
        name = m.name,
        parameters = m.parameters.map(p =>
          FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType), noteId = p.noteId, description = p.description)
        ),
        returnType = ctx.typeResolver.resolve(m.returnType),
        logicCode = m.logic.fold(
          err => s"// Error: $err",
          l => l.referenceCode.getOrElse(s"// TODO: ${l.intent}")
        )
      )
    }

    // 4. Dependencies
    val methodDeps = methods.flatMap { m =>
      m.returnType.collectAllDependencies ++ m.parameters.flatMap(
        _.typeRef.collectAllDependencies
      )
    }

    val allDeps = (methodDeps ++ superInterface.collectAllDependencies).toSet
    val dependencies = allDeps.filter(_.shouldImport(pkg))

    DomainServiceModel(selfType, superInterface, methods, dependencies)
  }
}
