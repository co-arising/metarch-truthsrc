package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaTriggerProtocolModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 触发聚合 Protocol 模板（**B·§13**）——触发命令 + 状态回灌命令 + 确认回复。
  * golden 参考：playAkkaCQRS `FabSagaProtocol`。 */
object SagaTriggerProtocolTemplate extends CodeTemplate[SagaTriggerProtocolModel] {
  def generate(model: SagaTriggerProtocolModel): String = {
    import model._
    val baseName = selfType.name.replace("SagaTransactorProtocol", "")
    val cmdFamily = s"${baseName}SagaCommand"

    val imports = dependencies.map(_.fqn).toSeq.distinct.sorted.map(i => s"import $i").mkString("\n")

    val triggerCases = triggerCommands.map { c =>
      val ps = (c.params.map(p => s"    ${p.name}: ${p.typeRef.signature}") :+ s"    replyTo: ActorRef[${confirmationType.name}]").mkString(",\n")
      s"""  case class ${c.name}(
$ps
  ) extends $cmdFamily"""
    }.mkString("\n\n")

    s"""package ${selfType.packageName}

import akka.actor.typed.ActorRef
$imports

object ${selfType.name} {

  // --- Commands ---
  sealed trait $cmdFamily extends _root_.net.imadz.common.CborSerializable

$triggerCases

  // 内部：接收 saga coordinator 的异步终态
  case class ${statusCommandType.name}(
    id: String,
    newStatus: ${transactionResultType.signature},
    replyTo: ActorRef[${confirmationType.name}]
  ) extends $cmdFamily

  // --- Replies ---
  case class ${confirmationType.name}(
    transactionId: _root_.net.imadz.common.CommonTypes.Id,
    error: Option[String],
    tracing: List[${tracingStepType.signature}] = Nil
  ) extends _root_.net.imadz.common.CborSerializable
}
"""
  }
}
