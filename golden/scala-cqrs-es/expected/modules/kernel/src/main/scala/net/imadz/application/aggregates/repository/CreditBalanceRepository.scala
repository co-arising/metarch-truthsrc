package net.imadz..application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef
import akka.cluster.sharding.typed.scaladsl.EntityRef
import com.google.inject.ImplementedBy
import com.google.inject.ImplementedBy
import javax.inject.Inject
import javax.inject._
import net.imadz..application.aggregates.CreditBalanceAggregate
import net.imadz..application.aggregates.CreditBalanceAggregate._
import net.imadz..application.aggregates.CreditBalanceAggregateProtocol.CreditBalanceAggregateCommandFamily
import net.imadz..application.aggregates.CreditBalanceCommand
import net.imadz..infrastructure.repositories.aggregate.CreditBalanceRepositoryImpl
import net.imadz.framework.common.CommonTypes.Id

/**
 * CreditBalanceRepository: Application Layer Repository Interface for CreditBalanceAggregate
 * The abstraction for interacting with the Aggregate via sharding and persistence.
 */
@ImplementedBy(classOf[CreditBalanceRepositoryImpl])
trait CreditBalanceRepository {

  def entityRef(id: String): EntityRef[CreditBalanceAggregateCommandFamily]
  // Logic: sharding 实体引用（聚合隐式契约——对齐 gen_api_layer entityRef，2026-08-28 终局原则）

  def findCreditBalanceByUserId(userId: Id): EntityRef[CreditBalanceCommand]
  // Logic: 通过 Sharding 获取聚合根引用

}

