package example.bankwealth.application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef
import example.bankwealth.application.aggregates.FundOrderProtocol.Command

trait FundOrderRepository {
  def entityRefFor(id: String): EntityRef[Command]
}
