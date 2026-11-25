package example.bankwealth.infrastructure.repositories.aggregate

import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import javax.inject.{Inject, Singleton}
import example.bankwealth.application.aggregates.FundOrderAggregate
import example.bankwealth.application.aggregates.FundOrderProtocol.Command
import example.bankwealth.application.aggregates.repository.FundOrderRepository

@Singleton
final class FundOrderRepositoryImpl @Inject() (sharding: ClusterSharding) extends FundOrderRepository {
  override def entityRefFor(id: String): EntityRef[Command] =
    sharding.entityRefFor(FundOrderAggregate.EntityKey, id)
}
