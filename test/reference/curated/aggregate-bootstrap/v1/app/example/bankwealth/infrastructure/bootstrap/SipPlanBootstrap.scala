package example.bankwealth.infrastructure.bootstrap

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.EventSourcedBehavior
import example.bankwealth.application.aggregates.{SipPlanAggregate, SipPlanAggregateFactory}
import example.bankwealth.application.aggregates.SipPlanProtocol.Command
import example.bankwealth.domain.SipPlanComputations
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.entities.behaviors.SipPlanEventHandler
import example.bankwealth.infrastructure.serialization.{SipPlanEventAdapter, SipPlanSnapshotAdapter}

object SipPlanBootstrap extends SipPlanAggregateFactory {

  override def create(persistenceId: String, initial: State, hosts: SipPlanComputations): Behavior[Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && hosts != null, "explicit persistence identity and implementations required")

    EventSourcedBehavior[Command, Event, State](
      persistenceId = PersistenceId.ofUniqueId(persistenceId),
      emptyState = initial,
      commandHandler = SipPlanAggregate.commandHandler(hosts),
      eventHandler = SipPlanEventHandler.apply
    )
      .eventAdapter(SipPlanEventAdapter)
      .snapshotAdapter(SipPlanSnapshotAdapter)
  }
}
