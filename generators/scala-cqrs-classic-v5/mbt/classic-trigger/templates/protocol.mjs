import { fqn, signature } from '../../../../../lib/classic-architecture/types.mjs';

/** SagaTriggerProtocolTemplate.scala, complete unstamped raw body. */
export function renderClassicSagaTriggerProtocol(model) {
  const baseName = model.selfType.name.replaceAll('SagaTransactorProtocol', '');
  const cmdFamily = `${baseName}SagaCommand`;
  const imports = [...new Set(model.dependencies.map(fqn))].sort().map(name => `import ${name}`).join('\n');
  const triggerCases = model.triggerCommands.map(command => {
    const params = [
      ...command.params.map(parameter => `    ${parameter.name}: ${signature(parameter.typeRef)}`),
      `    replyTo: ActorRef[${model.confirmationType.name}]`,
    ].join(',\n');
    return `  case class ${command.name}(\n${params}\n  ) extends ${cmdFamily}`;
  }).join('\n\n');

  // The fixed ActorRef import intentionally duplicates the dependency import.
  return `package ${model.selfType.packageName}

import akka.actor.typed.ActorRef
${imports}

object ${model.selfType.name} {

  // --- Commands ---
  sealed trait ${cmdFamily} extends _root_.net.imadz.common.CborSerializable

${triggerCases}

  // 内部：接收 saga coordinator 的异步终态
  case class ${model.statusCommandType.name}(
    id: String,
    newStatus: ${signature(model.transactionResultType)},
    replyTo: ActorRef[${model.confirmationType.name}]
  ) extends ${cmdFamily}

  // --- Replies ---
  case class ${model.confirmationType.name}(
    transactionId: _root_.net.imadz.common.CommonTypes.Id,
    error: Option[String],
    tracing: List[${signature(model.tracingStepType)}] = Nil
  ) extends _root_.net.imadz.common.CborSerializable
}
`;
}
