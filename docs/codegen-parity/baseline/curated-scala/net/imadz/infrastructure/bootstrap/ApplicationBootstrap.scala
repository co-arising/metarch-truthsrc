package net.imadz.infrastructure.bootstrap

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.adapter._
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import net.imadz.application.aggregates.repository.CreditBalanceRepository
import net.imadz.application.projection.repository.MonthlyIncomeAndExpenseSummaryRepository
import net.imadz.application.services.transactor.MoneyTransferContext

import javax.inject.{Inject, Singleton}
import scala.concurrent.ExecutionContext

/**
 * ApplicationBootstrap: 系统的总启动入口。
 * 负责在应用启动时，一次性初始化所有的 Aggregate、Saga 引擎（saga_v3）和 Projection。
 */
@Singleton
class ApplicationBootstrap @Inject()(
                                       // Play 默认注入的是 Classic ActorSystem，我们需要转换
                                       classicSystem: akka.actor.ActorSystem,
                                       sharding: ClusterSharding,
                                       // 注入各个 Bootstrap 所需的 Repository
                                       creditBalanceRepository: CreditBalanceRepository,
                                       monthlyRepository: MonthlyIncomeAndExpenseSummaryRepository
                                     ) extends CreditBalanceBootstrap
  with SagaTransactionCoordinatorBootstrap
  with MoneyTransferSagaTransactorBootstrap
  with MonthlyIncomeAndExpenseBootstrap {

  // 转换为 Typed ActorSystem
  private implicit val system: ActorSystem[Nothing] = classicSystem.toTyped
  private implicit val ec: ExecutionContext = system.executionContext
  private implicit val scheduler: akka.actor.typed.Scheduler = system.scheduler

  // --- 1. 注册 Saga 定义（必须在 sharding 恢复任何实体之前完成） ---
  // 来自 MoneyTransferSagaTransactorBootstrap
  initMoneyTransferSagaTransactor

  // --- 2. 初始化标准聚合根 (CreditBalance) ---
  // 来自 CreditBalanceBootstrap
  initCreditBalanceAggregate(sharding)

  // --- 3. 初始化 Saga 引擎（Coordinator sharding + 子 StepExecutor） ---
  // 来自 SagaTransactionCoordinatorBootstrap
  initSagaEngine(sharding, MoneyTransferContext(creditBalanceRepository), system)

  // --- 4. 初始化投影 (Projection) ---
  // 来自 MonthlyIncomeAndExpenseBootstrap
  initMonthlySummaryProjection(system, sharding, monthlyRepository)

  println("🚀 [ApplicationBootstrap] All CQRS components initialized successfully (saga_v3).")
}
