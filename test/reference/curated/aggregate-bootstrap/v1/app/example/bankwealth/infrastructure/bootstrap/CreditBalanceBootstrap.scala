package example.bankwealth.infrastructure.bootstrap

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.EventSourcedBehavior
import example.bankwealth.application.aggregates.CreditBalanceAggregate
import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command
import example.bankwealth.application.aggregates.factories.CreditBalanceAggregateFactory
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.entities.behaviors.CreditBalanceEventHandler
import example.bankwealth.domain.services.CreditBalanceComputations
import example.bankwealth.infrastructure.persistence.{CreditBalanceEventAdapter, CreditBalanceSnapshotAdapter}

object CreditBalanceBootstrap extends CreditBalanceAggregateFactory {

  override def create(persistenceId: String, initial: State, hosts: CreditBalanceComputations): Behavior[Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && hosts != null, "explicit persistence identity and implementations required")

    EventSourcedBehavior[Command, Event, State](
      persistenceId = PersistenceId.ofUniqueId(persistenceId),
      emptyState = initial,
      commandHandler = CreditBalanceAggregate.commandHandler(hosts),
      eventHandler = CreditBalanceEventHandler.apply
    )
      .eventAdapter(CreditBalanceEventAdapter)
      .snapshotAdapter(CreditBalanceSnapshotAdapter)
  }
}
