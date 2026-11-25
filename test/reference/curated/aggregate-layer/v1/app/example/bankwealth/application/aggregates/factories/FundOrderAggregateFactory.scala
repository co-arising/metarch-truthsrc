package example.bankwealth.application.aggregates.factories

import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import javax.inject.Inject
import example.bankwealth.application.aggregates.FundOrderAggregate
import example.bankwealth.application.aggregates.FundOrderProtocol.Command

class FundOrderAggregateFactory @Inject() (clusterSharding: ClusterSharding) {

  def entityRefFor(entityId: String): EntityRef[Command] =
    clusterSharding.entityRefFor(FundOrderAggregate.EntityKey, entityId)
}
