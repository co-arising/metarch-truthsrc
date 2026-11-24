package example.bankwealth.infrastructure.bootstrap

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.EventSourcedBehavior
import example.bankwealth.application.aggregates.FundOrderAggregate
import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.application.aggregates.factories.FundOrderAggregateFactory
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.domain.entities.behaviors.FundOrderEventHandler
import example.bankwealth.domain.services.FundOrderComputations
import example.bankwealth.infrastructure.persistence.{FundOrderEventAdapter, FundOrderSnapshotAdapter}

object FundOrderBootstrap extends FundOrderAggregateFactory {

  override def create(persistenceId: String, initial: State, hosts: FundOrderComputations, authority: ExternalAuthority): Behavior[Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && hosts != null && authority != null, "explicit persistence identity and implementations required")

    EventSourcedBehavior[Command, Event, State](
      persistenceId = PersistenceId.ofUniqueId(persistenceId),
      emptyState = initial,
      commandHandler = FundOrderAggregate.commandHandler(hosts, authority),
      eventHandler = FundOrderEventHandler.apply
    )
      .eventAdapter(FundOrderEventAdapter)
      .snapshotAdapter(FundOrderSnapshotAdapter)
  }
}
