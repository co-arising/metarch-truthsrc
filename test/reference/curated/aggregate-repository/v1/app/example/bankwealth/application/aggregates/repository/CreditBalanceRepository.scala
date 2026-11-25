package example.bankwealth.application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef
import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command

trait CreditBalanceRepository {
  def entityRefFor(id: String): EntityRef[Command]
}
