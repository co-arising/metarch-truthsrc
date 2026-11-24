package example.bankwealth.application.aggregates

import example.bankwealth.application.aggregates.SipPlanProtocol.CommandHandler
import example.bankwealth.domain.services.SipPlanComputations

object SipPlanAggregate {

  def commandHandler(hosts: SipPlanComputations): CommandHandler =
    behaviors.SipPlanBehaviors(hosts)
}
