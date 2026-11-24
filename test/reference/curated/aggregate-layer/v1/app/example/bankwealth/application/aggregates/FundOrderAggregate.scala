package example.bankwealth.application.aggregates

import example.bankwealth.application.aggregates.FundOrderProtocol.{CommandHandler, ExternalAuthority}
import example.bankwealth.domain.services.FundOrderComputations

object FundOrderAggregate {

  def commandHandler(hosts: FundOrderComputations, authority: ExternalAuthority): CommandHandler =
    behaviors.FundOrderBehaviors(hosts, authority)
}
