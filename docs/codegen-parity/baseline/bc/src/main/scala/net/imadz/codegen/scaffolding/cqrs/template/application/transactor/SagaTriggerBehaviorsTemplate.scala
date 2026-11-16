package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaTriggerBehaviorsModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 触发聚合 Behaviors 模板（**B·§13**）——v3 触发形态。
  *
  * golden 参考：playAkkaCQRS `FabSagaTransactorBehaviors`：
  *   触发命令 → persist(TransactionInitiated) → thenRun { StartSaga(txId, Name, Version, codec.encode(args), …) }
  *   statusCmd → persist(Completed/Failed) → 回复确认
  * 事务编排**不在**聚合里——交给共享 coordinator；参与者由引擎按定义重建。 */
object SagaTriggerBehaviorsTemplate extends CodeTemplate[SagaTriggerBehaviorsModel] {
  def generate(model: SagaTriggerBehaviorsModel): String = {
    import model._
    // 嵌套类型（State/Event/Confirmation）在各自**对象内**，包级 import 取不到——过滤掉，
    // 改以对象通配 import（见下）。其余依赖照发。
    val eventTypeName = stateType.name.replace("State", "Event")
    val nested = Set(stateType.name, eventTypeName, confirmationType.name, commandType.name)
    val imports = dependencies.map(_.fqn).filterNot(f => nested.exists(n => f.endsWith(s".$n"))).toSeq.distinct.sorted.map(i => s"import $i").mkString("\n")

    val triggerCases = triggerCommands.map { c =>
      s"          case cmd: ${c.name} => initiateHandler(state, ${c.handlerArgs.map("cmd." + _).mkString(", ")}, coordinator, context, id)"
    }.mkString("\n")

    s"""package ${selfType.packageName}

import akka.actor.typed.{ActorRef, Behavior, SupervisorStrategy}
import akka.cluster.sharding.typed.scaladsl.EntityRef
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior, RetentionCriteria}
import akka.util.Timeout
import scala.concurrent.ExecutionContext
import scala.concurrent.duration.DurationInt
import net.imadz.infra.saga.SagaTransactionCoordinator
import net.imadz.infra.saga.SagaTransactionCoordinator.{StartSaga, TransactionResult}
import net.imadz.infra.saga.dsl.ArgsCodec
import net.imadz.common.Id
import ${commandType.packageName}.${selfType.name.replace("Behaviors", "Protocol")}._
import ${stateType.packageName}.${entityName}Entity._
$imports

/** <Saga> 触发聚合：journal 业务意图 → StartSaga（v3 coordinator）→ 记录终态。
  * 步骤展开在 ${definitionType.name}，参与者由引擎重建；本聚合**不**编排步骤。 */
object ${selfType.name} {

  def apply(
    id: String,
    coordinator: EntityRef[SagaTransactionCoordinator.Command],
    ctx: ${contextType.signature}
  ): Behavior[${commandType.name}] =
    akka.actor.typed.scaladsl.Behaviors.setup { context =>
      implicit val ec: ExecutionContext = context.executionContext
      EventSourcedBehavior[${commandType.name}, $eventTypeName, ${stateType.name}](
        persistenceId = PersistenceId("$entityName", id),
        emptyState = ${stateType.name}(id = Some(id)),
        commandHandler = (state, command) => command match {
$triggerCases
          case cmd: ${statusCommandType.name} => updateStatusHandler(state, cmd)
        },
        eventHandler = (state, event) => state.applyEvent(event)
      ).withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
        .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1))
    }

  /** 触发：persist 意图 → StartSaga 交给 v3 coordinator（args 经 codec 编码）。 */
  private def initiateHandler(
    state: ${stateType.name},
    ${triggerCommands.headOption.map(c => c.params.map(p => s"${p.name}: ${p.typeRef.signature}").mkString(",\n    ")).getOrElse("")},
    replyTo: ActorRef[${confirmationType.name}],
    coordinator: EntityRef[SagaTransactionCoordinator.Command],
    context: akka.actor.typed.scaladsl.ActorContext[${commandType.name}],
    id: String
  )(implicit ec: ExecutionContext): Effect[$eventTypeName, ${stateType.name}] = {
    val args = ${definitionType.name}.${argsType.name}($argsCtorExpr)
    val event = TransactionInitiated($argsCtorExpr, System.currentTimeMillis())
    Effect.persist(event).thenRun { _ =>
      val transactionId = state.id.getOrElse(id)
      implicit val timeout: Timeout = 30.seconds
      val argsBytes = ArgsCodec.playJson[${definitionType.name}.${argsType.name}].encode(args)
      context.ask(coordinator, (ref: ActorRef[TransactionResult]) =>
        StartSaga(
          transactionId = transactionId,
          definitionName = ${definitionType.name}.Name,
          definitionVersion = ${definitionType.name}.Version,
          argsBytes = argsBytes,
          traceId = s"TRACE-$${transactionId.take(8)}",
          completionReply = Some(ref))
      ) {
        case scala.util.Success(result) => ${statusCommandType.name}(transactionId, result, replyTo)
        case scala.util.Failure(_)      => ${statusCommandType.name}(transactionId, TransactionResult(successful = false, null, "start failed"), replyTo)
      }
    }
  }

  /** 终态回灌：coordinator 的 TransactionResult → Completed / Failed。 */
  private def updateStatusHandler(
    state: ${stateType.name},
    cmd: ${statusCommandType.name}
  ): Effect[$eventTypeName, ${stateType.name}] = {
    val event = if (cmd.newStatus.successful)
      TransactionCompleted(cmd.id, System.currentTimeMillis())
    else
      TransactionFailed(cmd.id, Option(cmd.newStatus.failReason).getOrElse("Unknown Error"), System.currentTimeMillis())
    Effect.persist(event).thenReply(cmd.replyTo) { _ =>
      ${confirmationType.name}(_root_.net.imadz.common.Id.of(cmd.id),
        if (cmd.newStatus.successful) None else Option(cmd.newStatus.failReason),
        Nil)  // tracing：StepSpecSnapshot ≠ TracingStep·暂传空
    }
  }
}
"""
  }
}
