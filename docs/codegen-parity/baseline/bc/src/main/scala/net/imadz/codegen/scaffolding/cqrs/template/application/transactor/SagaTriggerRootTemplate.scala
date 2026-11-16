package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaTriggerRootModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 触发聚合 Root 模板（**B·§13**）——分片键 + tags + apply 工厂。
  * golden 参考：playAkkaCQRS `FabSagaTransactor`。 */
object SagaTriggerRootTemplate extends CodeTemplate[SagaTriggerRootModel] {
  def generate(model: SagaTriggerRootModel): String = {
    import model._
    val imports = dependencies.map(_.fqn).toSeq.distinct.sorted.map(i => s"import $i").mkString("\n")
    val behaviorsSimple = behaviorsType.name

    s"""package ${selfType.packageName}

import akka.actor.typed.Behavior
import akka.cluster.sharding.typed.scaladsl.{EntityRef, EntityTypeKey}
import net.imadz.infra.saga.SagaTransactionCoordinator
import ${selfType.packageName}.${selfType.name}Protocol._
$imports

object ${selfType.name} {

  val entityTypeKey: EntityTypeKey[${commandType.name}] = EntityTypeKey("$entityName")
  val tags: Vector[String] = Vector.tabulate(1)(i => s"$tagPrefix-$$i")

  def apply(
    id: String,
    coordinator: EntityRef[${coordinatorType.signature}.Command],
    ctx: ${contextType.signature}
  ): Behavior[${commandType.name}] =
    $behaviorsSimple.apply(id, coordinator, ctx)
}
"""
  }
}
