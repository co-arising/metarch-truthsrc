package example.stockreservation.application.services.transactor

import akka.actor.typed.ActorRef
import akka.actor.typed.ActorSystem
import akka.actor.typed.Behavior
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.cluster.typed.{ClusterSingleton, SingletonActor}
import akka.persistence.typed.PersistenceId
import net.imadz.infra.saga.strict.{ReconcileAuthorizer, StrictSagaCoordinator, TransactionIdentity}
import scala.concurrent.ExecutionContext

/** 手写部署入口（#42 组合供给，#41 族紧凑形）：组合宿主与测试 spec 消费的
  * 协调器装配面——固定模块 PID（独立 strict 命名空间）、ClusterSingleton 装配、
  * 恒时比较授权器。installEventSource/completion 发布面不在本 profile：组合
  * 宿主自身就是编排者，聚合完成无下游发布命令可投递（记档，#41 F12 同类）。 */
object WaferSplitSagaEntry {

  val NamespacePrefix = "strict-saga"

  def persistenceId: PersistenceId =
    PersistenceId.ofUniqueId(s"$NamespacePrefix/${WaferSplitSagaModule.name}")

  def spawnClusterSingleton(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      reconcileToken: String
  )(implicit ec: ExecutionContext): ActorRef[StrictSagaCoordinator.Command] = {
    require(reconcileToken != null && reconcileToken.nonEmpty, "reconcile token required")
    ClusterSingleton(system).init(
      SingletonActor(coordinatorBehavior(system, sharding, reconcileToken), coordinatorName))
  }

  private def coordinatorBehavior(
      system: ActorSystem[_],
      sharding: ClusterSharding,
      reconcileToken: String
  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] =
    WaferSplitSagaModule.behavior(persistenceId, new SplitFixtureHost(system, sharding),
      WaferReconcileAuthorizer(reconcileToken))

  private def coordinatorName: String =
    s"${WaferSplitSagaModule.name}-strict-saga-coordinator"
}

/** 恒时比较对账授权器（两个 wafer 入口共享；fixture 令牌，非生产凭据）。 */
final case class WaferReconcileAuthorizer(expected: String) extends ReconcileAuthorizer {
  def authorize(identity: TransactionIdentity, token: String): Either[String, String] = {
    val provided = Option(token).getOrElse("")
    val expectedToken = Option(expected).getOrElse("")
    if (expectedToken.isEmpty) Left("reconciliation token mismatch")
    else if (java.security.MessageDigest.isEqual(
      provided.getBytes(java.nio.charset.StandardCharsets.UTF_8),
      expectedToken.getBytes(java.nio.charset.StandardCharsets.UTF_8))) Right("wafer-reconciler")
    else Left("reconciliation token mismatch")
  }
}
