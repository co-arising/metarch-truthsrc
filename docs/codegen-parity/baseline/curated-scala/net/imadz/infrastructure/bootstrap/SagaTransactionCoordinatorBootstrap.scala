package net.imadz.infrastructure.bootstrap

import akka.actor.typed.ActorSystem
import akka.actor.typed.Behavior
import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity, EntityRef}
import akka.persistence.typed.PersistenceId
import akka.util.Timeout
import net.imadz.infra.saga.SagaTransactionCoordinator
import net.imadz.infra.saga.StepExecutor

import scala.concurrent.duration._

/** saga_v3 generic engine bootstrap: one coordinator sharding (per transactionId)
  * shared by ALL saga definitions. Step executors spawn as coordinator children
  * with deterministic pids so they replay correctly after crashes.
  *
  * Journal pid scheme (getHistory and the onResult projector depend on these):
  *   coordinator: "saga-coordinator-$txId"
  *   executor:    "saga-executor-$txId-$stepId-$phase"
  */
trait SagaTransactionCoordinatorBootstrap {

  def initSagaEngine[C](sharding: ClusterSharding, context: C, system: ActorSystem[_],
                        globalTimeout: FiniteDuration = 5.minutes): Unit = {
    implicit val ec: scala.concurrent.ExecutionContext = system.executionContext
    implicit val askTimeout: Timeout = Timeout(30.seconds)
    val extendedSystem = system.classicSystem.asInstanceOf[akka.actor.ExtendedActorSystem]

    val executorBehavior: String => Behavior[StepExecutor.Command] = name =>
      StepExecutor[Any, Any, C](
        PersistenceId.ofUniqueId(s"saga-executor-$name"),
        context = context,
        defaultMaxRetries = 5,
        initialRetryDelay = 100.millis,
        circuitBreakerSettings = StepExecutor.CircuitBreakerSettings(5, 30.seconds, 30.seconds),
        extendedSystem = extendedSystem)

    sharding.init(Entity(SagaTransactionCoordinator.entityTypeKey) { entityContext =>
      SagaTransactionCoordinator(
        PersistenceId.ofUniqueId(s"saga-coordinator-${entityContext.entityId}"),
        executorBehavior,
        globalTimeout = globalTimeout)(ec, askTimeout)
    })
  }

  /** Resolves the sharded coordinator for a transaction id (for SagaRunner). */
  def coordinatorRef(sharding: ClusterSharding, transactionId: String): EntityRef[SagaTransactionCoordinator.Command] =
    sharding.entityRefFor(SagaTransactionCoordinator.entityTypeKey, transactionId)
}
