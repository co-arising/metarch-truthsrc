import { fqn, signature } from '../../../../../lib/classic-architecture/types.mjs';

/** SagaTriggerEntityTemplate.scala, complete unstamped raw body. */
export function renderClassicSagaTriggerEntity(model) {
  const imports = [...new Set(model.dependencies.map(fqn))].sort().map(name => `import ${name}`).join('\n');
  const eventTypeName = model.stateType.name.replaceAll('State', 'Event');
  const eventParams = model.argsFields.map(field => `${field.name}: ${signature(field.typeRef)}`).join(', ');
  const initiatedPattern = [...model.argsFields.map(() => '_'), '_'].join(', ');

  // Leave the original comma before timestamp even for an empty argsFields.
  // Admission of that defective raw variant belongs to the central compiler.
  return `package ${model.selfType.packageName}

${imports}

object ${model.selfType.name} {

  // --- State（极简：只记身份与状态；业务意图在事件里）---
  sealed trait ${model.statusType.name} extends _root_.net.imadz.common.CborSerializable
  object ${model.statusType.name} {
    case object New extends ${model.statusType.name}
    case object Initiated extends ${model.statusType.name}
    case object Completed extends ${model.statusType.name}
    case class Failed(reason: String) extends ${model.statusType.name}
  }

  case class ${model.stateType.name}(
    id: Option[String] = None,
    status: ${model.statusType.name} = ${model.statusType.name}.New
  ) extends _root_.net.imadz.common.CborSerializable {

    def applyEvent(event: ${eventTypeName}): ${model.stateType.name} = event match {
      case TransactionInitiated(${initiatedPattern}) =>
        copy(status = ${model.statusType.name}.Initiated)
      case TransactionCompleted(_, _) =>
        copy(status = ${model.statusType.name}.Completed)
      case TransactionFailed(_, reason, _) =>
        copy(status = ${model.statusType.name}.Failed(reason))
    }
  }

  // --- Events ---
  sealed trait ${eventTypeName} extends _root_.net.imadz.common.CborSerializable
  case class TransactionInitiated(${eventParams}, timestamp: Long) extends ${eventTypeName}
  case class TransactionCompleted(id: String, timestamp: Long) extends ${eventTypeName}
  case class TransactionFailed(id: String, reason: String, timestamp: Long) extends ${eventTypeName}
}
`;
}
