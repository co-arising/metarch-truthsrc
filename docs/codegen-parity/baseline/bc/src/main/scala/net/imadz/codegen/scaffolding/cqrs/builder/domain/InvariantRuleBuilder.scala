package net.imadz.codegen.scaffolding.cqrs.builder.domain

import net.imadz.codegen.scaffolding.cqrs.model.domain.{
  InvariantRuleModel,
  InvariantConditionModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  GeneratorContext,
  NestedTypeName,
  OwnerEntityName,
  TypeRef,
  TypeResolver
}
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object InvariantRuleBuilder {
  def build(
      meta: InvariantRuleMetadata,
      ctx: GeneratorContext
  ): InvariantRuleModel = {
    val pkg = ctx.layout.domain.invariants.root
    val selfType = ctx.typeResolver.invariantRule(meta.name)

    // [FIX] Use TypeResolver.resolve to correctly handle Ref types (EntityStateRef, EventFamilyRef)
    val subjectType = ctx.typeResolver.resolve(meta.subject)
    val triggerType = ctx.typeResolver.resolve(meta.trigger)
    val outputType = ctx.typeResolver.resolve(meta.output)

    val baseRuleType = ctx.types.InvariantRule
    val implementedInterface = baseRuleType.copy(typeParams =
      Seq(outputType, subjectType, triggerType)
    )

    val conditions = meta.conditions.map { c =>
      InvariantConditionModel(
        name = c.name,
        errorCode = c.errorCode,
        errorMsg = c.logic.intent,
        // [FIX] 兜底为 "true"，保证编译通过
        logicDescription = c.logic.referenceCode.getOrElse("true")
      )
    }

    // 通过 SymbolTable 查找 subject（State）所属的 Entity
    val entityDeps: Set[TypeRef] =
      ctx.symbolTable.resolve(NestedTypeName(meta.subject.targetName)) match {
        case Some(OwnerEntityName(entityName)) =>
          Set(ctx.typeResolver.entity(entityName))
        case None =>
          Set.empty
      }

    val deps =
      implementedInterface.collectAllDependencies ++ Set(
        ctx.types.iMadzError
      ) ++ entityDeps

    val dependencies = deps.filter(t => t.shouldImport(pkg))

    InvariantRuleModel(
      selfType,
      outputType,
      subjectType,
      triggerType,
      implementedInterface,
      conditions,
      dependencies
    )
  }

}
