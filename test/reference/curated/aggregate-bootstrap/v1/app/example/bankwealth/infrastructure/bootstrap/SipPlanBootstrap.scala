package example.bankwealth.infrastructure.bootstrap

import akka.actor.typed.{Behavior, SupervisorStrategy}
import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity, EntityContext}
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{EventSourcedBehavior, RetentionCriteria}
import example.bankwealth.application.aggregates.SipPlanAggregate
import example.bankwealth.application.aggregates.SipPlanProtocol.Command
import example.bankwealth.domain.entities.SipPlanEntity
import example.bankwealth.domain.entities.SipPlanEntity.{Event, State}
import example.bankwealth.domain.entities.behaviors.SipPlanEventHandler
import example.bankwealth.domain.services.SipPlanComputations
import example.bankwealth.infrastructure.persistence.{SipPlanEventAdapter, SipPlanSnapshotAdapter}
import scala.concurrent.duration.DurationInt

trait SipPlanBootstrap {

  def initSipPlanAggregate(sharding: ClusterSharding, hosts: SipPlanComputations): Unit = {
    val behaviorFactory: EntityContext[Command] => Behavior[Command] = { context =>
      val i = math.abs(context.entityId.hashCode % SipPlanAggregate.tags.size)
      val selectedTag = SipPlanAggregate.tags(i)
      create(PersistenceId(SipPlanAggregate.EntityKey.name, context.entityId).id, SipPlanEntity.empty, hosts, selectedTag)
    }
    sharding.init(Entity(SipPlanAggregate.EntityKey)(behaviorFactory))
  }

  def create(persistenceId: String, initial: State, hosts: SipPlanComputations): Behavior[Command] =
    create(persistenceId, initial, hosts, SipPlanAggregate.tags.head)

  def create(persistenceId: String, initial: State, hosts: SipPlanComputations, tag: String): Behavior[Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && hosts != null, "explicit persistence identity and implementations required")

    EventSourcedBehavior[Command, Event, State](
      persistenceId = PersistenceId.ofUniqueId(persistenceId),
      emptyState = initial,
      commandHandler = SipPlanAggregate.commandHandler(hosts),
      eventHandler = SipPlanEventHandler.apply
    )
      .withTagger(_ => Set(tag))
      .withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
      .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1).withStashCapacity(100))
      .eventAdapter(new SipPlanEventAdapter)
      .snapshotAdapter(new SipPlanSnapshotAdapter)
  }
}

object SipPlanBootstrap extends SipPlanBootstrap
