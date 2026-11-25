package example.bankwealth.infrastructure.bootstrap

import akka.actor.typed.{Behavior, SupervisorStrategy}
import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity, EntityContext}
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{EventSourcedBehavior, RetentionCriteria}
import example.bankwealth.application.aggregates.CreditBalanceAggregate
import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command
import example.bankwealth.domain.entities.CreditBalanceEntity
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.entities.behaviors.CreditBalanceEventHandler
import example.bankwealth.domain.services.CreditBalanceComputations
import example.bankwealth.infrastructure.persistence.{CreditBalanceEventAdapter, CreditBalanceSnapshotAdapter}
import scala.concurrent.duration.DurationInt

trait CreditBalanceBootstrap {

  def initCreditBalanceAggregate(sharding: ClusterSharding, hosts: CreditBalanceComputations): Unit = {
    val behaviorFactory: EntityContext[Command] => Behavior[Command] = { context =>
      val i = math.abs(context.entityId.hashCode % CreditBalanceAggregate.tags.size)
      val selectedTag = CreditBalanceAggregate.tags(i)
      create(PersistenceId(CreditBalanceAggregate.EntityKey.name, context.entityId).id, CreditBalanceEntity.empty, hosts, selectedTag)
    }
    sharding.init(Entity(CreditBalanceAggregate.EntityKey)(behaviorFactory))
  }

  def create(persistenceId: String, initial: State, hosts: CreditBalanceComputations, tag: String = CreditBalanceAggregate.tags.head): Behavior[Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && hosts != null, "explicit persistence identity and implementations required")

    EventSourcedBehavior[Command, Event, State](
      persistenceId = PersistenceId.ofUniqueId(persistenceId),
      emptyState = initial,
      commandHandler = CreditBalanceAggregate.commandHandler(hosts),
      eventHandler = CreditBalanceEventHandler.apply
    )
      .withTagger(_ => Set(tag))
      .withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
      .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1).withStashCapacity(100))
      .eventAdapter(new CreditBalanceEventAdapter)
      .snapshotAdapter(new CreditBalanceSnapshotAdapter)
  }
}

object CreditBalanceBootstrap extends CreditBalanceBootstrap
