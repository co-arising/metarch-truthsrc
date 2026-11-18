import { fqn, signature } from '../../../../../lib/classic-architecture/types.mjs';

/** SagaTriggerRootTemplate.scala, complete unstamped raw body. */
export function renderClassicSagaTriggerRoot(model) {
  const imports = [...new Set(model.dependencies.map(fqn))].sort().map(name => `import ${name}`).join('\n');
  const behaviorsSimple = model.behaviorsType.name;

  return `package ${model.selfType.packageName}

import akka.actor.typed.Behavior
import akka.cluster.sharding.typed.scaladsl.{EntityRef, EntityTypeKey}
import net.imadz.infra.saga.SagaTransactionCoordinator
import ${model.selfType.packageName}.${model.selfType.name}Protocol._
${imports}

object ${model.selfType.name} {

  val entityTypeKey: EntityTypeKey[${model.commandType.name}] = EntityTypeKey("${model.entityName}")
  val tags: Vector[String] = Vector.tabulate(1)(i => s"${model.tagPrefix}-$i")

  def apply(
    id: String,
    coordinator: EntityRef[${signature(model.coordinatorType)}.Command],
    ctx: ${signature(model.contextType)}
  ): Behavior[${model.commandType.name}] =
    ${behaviorsSimple}.apply(id, coordinator, ctx)
}
`;
}
