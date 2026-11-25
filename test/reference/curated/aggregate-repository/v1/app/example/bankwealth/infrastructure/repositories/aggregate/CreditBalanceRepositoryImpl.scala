package example.bankwealth.infrastructure.repositories.aggregate

import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import javax.inject.{Inject, Singleton}
import example.bankwealth.application.aggregates.CreditBalanceAggregate
import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command
import example.bankwealth.application.aggregates.repository.CreditBalanceRepository

@Singleton
final class CreditBalanceRepositoryImpl @Inject() (sharding: ClusterSharding) extends CreditBalanceRepository {
  override def entityRefFor(id: String): EntityRef[Command] =
    sharding.entityRefFor(CreditBalanceAggregate.EntityKey, id)
}
