package example.bankwealth.application.aggregates.factories

import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import javax.inject.Inject
import example.bankwealth.application.aggregates.CreditBalanceAggregate
import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command

class CreditBalanceAggregateFactory @Inject() (clusterSharding: ClusterSharding) {

  def entityRefFor(entityId: String): EntityRef[Command] =
    clusterSharding.entityRefFor(CreditBalanceAggregate.EntityKey, entityId)
}
