package example.bankwealth.infrastructure.repositories.aggregate

import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import javax.inject.{Inject, Singleton}
import example.bankwealth.application.aggregates.SipPlanAggregate
import example.bankwealth.application.aggregates.SipPlanProtocol.Command
import example.bankwealth.application.aggregates.repository.SipPlanRepository

@Singleton
final class SipPlanRepositoryImpl @Inject() (sharding: ClusterSharding) extends SipPlanRepository {
  override def entityRefFor(id: String): EntityRef[Command] =
    sharding.entityRefFor(SipPlanAggregate.EntityKey, id)
}
