package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaTriggerEntityModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 触发聚合 Entity 模板（**B·§13**）——极简状态（id/status）+ 事件携带业务意图。
  * golden 参考：playAkkaCQRS `FabSagaTransactionEntity`。 */
object SagaTriggerEntityTemplate extends CodeTemplate[SagaTriggerEntityModel] {
  def generate(model: SagaTriggerEntityModel): String = {
    import model._
    val imports = dependencies.map(_.fqn).toSeq.distinct.sorted.map(i => s"import $i").mkString("\n")
    val eventTypeName = stateType.name.replace("State", "Event")
    val eventParams = argsFields.map(f => s"${f.name}: ${f.typeRef.signature}").mkString(", ")
    // 事件 = argsFields 各参 + timestamp → applyEvent 通配元数须匹配
    val initiatedPattern = (argsFields.map(_ => "_") :+ "_").mkString(", ")

    s"""package ${selfType.packageName}

$imports

object ${selfType.name} {

  // --- State（极简：只记身份与状态；业务意图在事件里）---
  sealed trait ${statusType.name} extends _root_.net.imadz.common.CborSerializable
  object ${statusType.name} {
    case object New extends ${statusType.name}
    case object Initiated extends ${statusType.name}
    case object Completed extends ${statusType.name}
    case class Failed(reason: String) extends ${statusType.name}
  }

  case class ${stateType.name}(
    id: Option[String] = None,
    status: ${statusType.name} = ${statusType.name}.New
  ) extends _root_.net.imadz.common.CborSerializable {

    def applyEvent(event: $eventTypeName): ${stateType.name} = event match {
      case TransactionInitiated($initiatedPattern) =>
        copy(status = ${statusType.name}.Initiated)
      case TransactionCompleted(_, _) =>
        copy(status = ${statusType.name}.Completed)
      case TransactionFailed(_, reason, _) =>
        copy(status = ${statusType.name}.Failed(reason))
    }
  }

  // --- Events ---
  sealed trait $eventTypeName extends _root_.net.imadz.common.CborSerializable
  case class TransactionInitiated($eventParams, timestamp: Long) extends $eventTypeName
  case class TransactionCompleted(id: String, timestamp: Long) extends $eventTypeName
  case class TransactionFailed(id: String, reason: String, timestamp: Long) extends $eventTypeName
}
"""
  }
}
