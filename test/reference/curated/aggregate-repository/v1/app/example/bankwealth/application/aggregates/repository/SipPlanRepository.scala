package example.bankwealth.application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef
import example.bankwealth.application.aggregates.SipPlanProtocol.Command

trait SipPlanRepository {
  def entityRefFor(id: String): EntityRef[Command]
}
