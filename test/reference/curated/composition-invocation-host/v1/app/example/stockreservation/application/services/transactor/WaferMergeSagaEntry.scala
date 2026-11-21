package example.stockreservation.application.services.transactor

import akka.actor.typed.ActorRef
import akka.actor.typed.ActorSystem
import akka.actor.typed.Behavior
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.cluster.typed.{ClusterSingleton, SingletonActor}
import akka.persistence.typed.PersistenceId
import net.imadz.infra.saga.strict.StrictSagaCoordinator
import scala.concurrent.ExecutionContext

/** 手写部署入口（merge 侧，与 WaferSplitSagaEntry 结构孪生）：授权器共享
  * WaferReconcileAuthorizer（同包引用，零 import）。 */
object WaferMergeSagaEntry {

  val NamespacePrefix = "strict-saga"

  def persistenceId: PersistenceId =
    PersistenceId.ofUniqueId(s"$NamespacePrefix/${WaferMergeSagaModule.name}")

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
    WaferMergeSagaModule.behavior(persistenceId, new MergeFixtureHost(system, sharding),
      WaferReconcileAuthorizer(reconcileToken))

  private def coordinatorName: String =
    s"${WaferMergeSagaModule.name}-strict-saga-coordinator"
}
