import { fqn, signature } from '../../../../../lib/classic-architecture/types.mjs';

/** SagaTriggerBehaviorsTemplate.scala, complete unstamped raw body. */
export function renderClassicSagaTriggerBehaviors(model) {
  // The original event name is derived from stateType, NOT model.eventType.
  const eventTypeName = model.stateType.name.replaceAll('State', 'Event');
  const nested = new Set([
    model.stateType.name, eventTypeName, model.confirmationType.name, model.commandType.name,
  ]);
  const imports = [...new Set(model.dependencies.map(fqn)
    .filter(name => ![...nested].some(nestedName => name.endsWith(`.${nestedName}`))))]
    .sort().map(name => `import ${name}`).join('\n');
  const triggerCases = model.triggerCommands.map(command =>
    `          case cmd: ${command.name} => initiateHandler(state, ${command.handlerArgs.map(name => `cmd.${name}`).join(', ')}, coordinator, context, id)`
  ).join('\n');
  const triggerParams = (model.triggerCommands[0]?.params ?? [])
    .map(parameter => `${parameter.name}: ${signature(parameter.typeRef)}`).join(',\n    ');

  // Fixed imports and dynamic imports are separate original blocks. Neither
  // unused ctx nor null snapshot nor the zero-parameter comma is repaired here.
  return `package ${model.selfType.packageName}

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
import ${model.commandType.packageName}.${model.selfType.name.replaceAll('Behaviors', 'Protocol')}._
import ${model.stateType.packageName}.${model.entityName}Entity._
${imports}

/** <Saga> 触发聚合：journal 业务意图 → StartSaga（v3 coordinator）→ 记录终态。
  * 步骤展开在 ${model.definitionType.name}，参与者由引擎重建；本聚合**不**编排步骤。 */
object ${model.selfType.name} {

  def apply(
    id: String,
    coordinator: EntityRef[SagaTransactionCoordinator.Command],
    ctx: ${signature(model.contextType)}
  ): Behavior[${model.commandType.name}] =
    akka.actor.typed.scaladsl.Behaviors.setup { context =>
      implicit val ec: ExecutionContext = context.executionContext
      EventSourcedBehavior[${model.commandType.name}, ${eventTypeName}, ${model.stateType.name}](
        persistenceId = PersistenceId("${model.entityName}", id),
        emptyState = ${model.stateType.name}(id = Some(id)),
        commandHandler = (state, command) => command match {
${triggerCases}
          case cmd: ${model.statusCommandType.name} => updateStatusHandler(state, cmd)
        },
        eventHandler = (state, event) => state.applyEvent(event)
      ).withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
        .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1))
    }

  /** 触发：persist 意图 → StartSaga 交给 v3 coordinator（args 经 codec 编码）。 */
  private def initiateHandler(
    state: ${model.stateType.name},
    ${triggerParams},
    replyTo: ActorRef[${model.confirmationType.name}],
    coordinator: EntityRef[SagaTransactionCoordinator.Command],
    context: akka.actor.typed.scaladsl.ActorContext[${model.commandType.name}],
    id: String
  )(implicit ec: ExecutionContext): Effect[${eventTypeName}, ${model.stateType.name}] = {
    val args = ${model.definitionType.name}.${model.argsType.name}(${model.argsCtorExpr})
    val event = TransactionInitiated(${model.argsCtorExpr}, System.currentTimeMillis())
    Effect.persist(event).thenRun { _ =>
      val transactionId = state.id.getOrElse(id)
      implicit val timeout: Timeout = 30.seconds
      val argsBytes = ArgsCodec.playJson[${model.definitionType.name}.${model.argsType.name}].encode(args)
      context.ask(coordinator, (ref: ActorRef[TransactionResult]) =>
        StartSaga(
          transactionId = transactionId,
          definitionName = ${model.definitionType.name}.Name,
          definitionVersion = ${model.definitionType.name}.Version,
          argsBytes = argsBytes,
          traceId = s"TRACE-\${transactionId.take(8)}",
          completionReply = Some(ref))
      ) {
        case scala.util.Success(result) => ${model.statusCommandType.name}(transactionId, result, replyTo)
        case scala.util.Failure(_)      => ${model.statusCommandType.name}(transactionId, TransactionResult(successful = false, null, "start failed"), replyTo)
      }
    }
  }

  /** 终态回灌：coordinator 的 TransactionResult → Completed / Failed。 */
  private def updateStatusHandler(
    state: ${model.stateType.name},
    cmd: ${model.statusCommandType.name}
  ): Effect[${eventTypeName}, ${model.stateType.name}] = {
    val event = if (cmd.newStatus.successful)
      TransactionCompleted(cmd.id, System.currentTimeMillis())
    else
      TransactionFailed(cmd.id, Option(cmd.newStatus.failReason).getOrElse("Unknown Error"), System.currentTimeMillis())
    Effect.persist(event).thenReply(cmd.replyTo) { _ =>
      ${model.confirmationType.name}(_root_.net.imadz.common.Id.of(cmd.id),
        if (cmd.newStatus.successful) None else Option(cmd.newStatus.failReason),
        Nil)  // tracing：StepSpecSnapshot ≠ TracingStep·暂传空
    }
  }
}
`;
}
