package example.bankwealth.application.aggregates.factories

import akka.actor.typed.Behavior
import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command
import example.bankwealth.domain.entities.CreditBalanceEntity.State
import example.bankwealth.domain.services.CreditBalanceComputations

trait CreditBalanceAggregateFactory {

  def create(persistenceId: String, initial: State, hosts: CreditBalanceComputations): Behavior[Command]
}
