package example.bankwealth.infrastructure.bootstrap

import akka.actor.typed.{Behavior, SupervisorStrategy}
import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity, EntityContext}
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{EventSourcedBehavior, RetentionCriteria}
import example.bankwealth.application.aggregates.FundOrderAggregate
import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.domain.entities.FundOrderEntity
import example.bankwealth.domain.entities.FundOrderEntity.{Event, State}
import example.bankwealth.domain.entities.behaviors.FundOrderEventHandler
import example.bankwealth.domain.services.FundOrderComputations
import example.bankwealth.infrastructure.persistence.{FundOrderEventAdapter, FundOrderSnapshotAdapter}
import scala.concurrent.duration.DurationInt

trait FundOrderBootstrap {

  def initFundOrderAggregate(sharding: ClusterSharding, hosts: FundOrderComputations, authority: ExternalAuthority): Unit = {
    val behaviorFactory: EntityContext[Command] => Behavior[Command] = { context =>
      val i = math.abs(context.entityId.hashCode % FundOrderAggregate.tags.size)
      val selectedTag = FundOrderAggregate.tags(i)
      create(PersistenceId(FundOrderAggregate.EntityKey.name, context.entityId).id, FundOrderEntity.empty, hosts, authority, selectedTag)
    }
    sharding.init(Entity(FundOrderAggregate.EntityKey)(behaviorFactory))
  }

  def create(persistenceId: String, initial: State, hosts: FundOrderComputations, authority: ExternalAuthority, tag: String = FundOrderAggregate.tags.head): Behavior[Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && hosts != null && authority != null, "explicit persistence identity and implementations required")

    EventSourcedBehavior[Command, Event, State](
      persistenceId = PersistenceId.ofUniqueId(persistenceId),
      emptyState = initial,
      commandHandler = FundOrderAggregate.commandHandler(hosts, authority),
      eventHandler = FundOrderEventHandler.apply
    )
      .withTagger(_ => Set(tag))
      .withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
      .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1).withStashCapacity(100))
      .eventAdapter(new FundOrderEventAdapter)
      .snapshotAdapter(new FundOrderSnapshotAdapter)
  }
}

object FundOrderBootstrap extends FundOrderBootstrap
