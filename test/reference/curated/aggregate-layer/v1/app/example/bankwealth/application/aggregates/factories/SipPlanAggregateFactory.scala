package example.bankwealth.application.aggregates.factories

import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import javax.inject.Inject
import example.bankwealth.application.aggregates.SipPlanAggregate
import example.bankwealth.application.aggregates.SipPlanProtocol.Command

class SipPlanAggregateFactory @Inject() (clusterSharding: ClusterSharding) {

  def entityRefFor(entityId: String): EntityRef[Command] =
    clusterSharding.entityRefFor(SipPlanAggregate.EntityKey, entityId)
}
