package example.bankwealth.application.aggregates

import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import example.bankwealth.application.aggregates.FundOrderProtocol.{Command, CommandHandler, ExternalAuthority}
import example.bankwealth.domain.services.FundOrderComputations

object FundOrderAggregate {

  val EntityKey: EntityTypeKey[Command] = EntityTypeKey("FundOrder")
  val tags: Vector[String] = Vector.tabulate(1)(i => s"fund-order-$$i")

  def commandHandler(hosts: FundOrderComputations, authority: ExternalAuthority): CommandHandler =
    behaviors.FundOrderBehaviors(hosts, authority)
}
