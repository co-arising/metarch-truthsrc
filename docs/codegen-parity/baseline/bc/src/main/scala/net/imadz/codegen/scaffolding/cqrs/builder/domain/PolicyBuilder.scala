package net.imadz.codegen.scaffolding.cqrs.builder.domain

import net.imadz.codegen.scaffolding.cqrs.model.domain.PolicyModel
import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.meta._

object PolicyBuilder {
  def build(meta: PolicyMetadata, ctx: GeneratorContext): PolicyModel = {
    val pkg = ctx.layout.domain.policies.root
    val selfType = ctx.typeResolver.policy(meta.name)
    val sourceAggregate = ctx.typeResolver.aggregateRoot(meta.sourceAggregate)
    val targetAggregate = ctx.typeResolver.aggregateRoot(meta.targetAggregate)
    val command = ctx.typeResolver.resolve(meta.command)
    val triggerEvent = ctx.typeResolver.resolve(meta.triggerEvent)

    val deps = Set(sourceAggregate, targetAggregate, command, triggerEvent) ++ Set(
      ctx.knownFrameworkTypes("ClusterSharding"),
      ctx.knownFrameworkTypes("ExecutionContext"),
      ctx.knownFrameworkTypes("Singleton"),
      ctx.knownFrameworkTypes("ActorSystem")
    )
    val dependencies = deps.filter(_.shouldImport(pkg))

    PolicyModel(
      selfType,
      sourceAggregate,
      targetAggregate,
      command,
      triggerEvent,
      meta.entityIdField,
      meta.idempotencyKey,
      meta.logic.referenceCode.getOrElse("???"),
      dependencies
    )
  }
}
