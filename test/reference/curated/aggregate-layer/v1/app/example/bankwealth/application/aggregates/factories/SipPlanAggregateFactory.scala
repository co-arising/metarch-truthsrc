package example.bankwealth.application.aggregates.factories

import akka.actor.typed.Behavior
import example.bankwealth.application.aggregates.SipPlanProtocol.Command
import example.bankwealth.domain.entities.SipPlanEntity.State
import example.bankwealth.domain.services.SipPlanComputations

trait SipPlanAggregateFactory {

  def create(persistenceId: String, initial: State, hosts: SipPlanComputations): Behavior[Command]
}
