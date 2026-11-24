package example.bankwealth.application.aggregates.factories

import akka.actor.typed.Behavior
import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.domain.entities.FundOrderEntity.State
import example.bankwealth.domain.services.FundOrderComputations

trait FundOrderAggregateFactory {

  def create(persistenceId: String, initial: State, hosts: FundOrderComputations, authority: ExternalAuthority): Behavior[Command]
}
