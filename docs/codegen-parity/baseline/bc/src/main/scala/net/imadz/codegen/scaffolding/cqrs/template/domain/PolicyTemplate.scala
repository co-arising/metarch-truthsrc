package net.imadz.codegen.scaffolding.cqrs.template.domain

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.domain.PolicyModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object PolicyTemplate extends CodeTemplate[PolicyModel] {

  def generate(model: PolicyModel): String = {
    val pkgDecl = packageDecl(model.selfType.packageName)

    val importDecl = imports(
      model.dependencies.toList
        .sortBy(_.fqn)
        .map(_.fqn)
        .filterNot(p =>
          p.isEmpty || p == model.selfType.packageName || p.startsWith(
            "java.lang"
          )
        ): _*
    )

    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: 反应式策略（Policy）。
 * on(${model.triggerEvent.name}) => emit(${model.command.name}) —— 事件→命令的 message-driven 反应。
 * 幂等键: ${model.idempotencyKey}（作为命令参数，聚合 invariant 去重）。
 */
@Singleton
object ${model.selfType.name} {
  val policyName = "${model.selfType.name.stripSuffix("Policy")}"

  def createPolicy(system: akka.actor.typed.ActorSystem[_], sharding: akka.cluster.sharding.typed.scaladsl.ClusterSharding, index: Int): Unit = {
    // TODO: EventSourcedProvider.eventsByTag + ProjectionBehavior，handler 发命令
    ???
  }
}

class ${model.selfType.name}Handler {
  def process(envelope: Any): Unit = {
    // TODO: envelope.event match {
    //   case event: ${model.triggerEvent.name} =>
    //     val entityRef = repository.findXxxById(event.${model.entityIdField})
    //     entityRef.ask(replyTo => ${model.command.name}(args..., replyTo))  // 幂等键 ${model.idempotencyKey}
    // }
    ???
  }
}
"""
    sourceCode
  }
}
