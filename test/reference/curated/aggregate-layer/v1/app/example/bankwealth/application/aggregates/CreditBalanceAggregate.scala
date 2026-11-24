package example.bankwealth.application.aggregates

import example.bankwealth.application.aggregates.CreditBalanceProtocol.CommandHandler
import example.bankwealth.domain.services.CreditBalanceComputations

object CreditBalanceAggregate {

  def commandHandler(hosts: CreditBalanceComputations): CommandHandler =
    behaviors.CreditBalanceBehaviors(hosts)
}
