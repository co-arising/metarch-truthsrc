package example.bankwealth.modules

import akka.actor.{ActorSystem, ExtendedActorSystem}
import akka.actor.typed.scaladsl.adapter._
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import com.google.inject.{AbstractModule, Module, Provides}
import example.bankwealth.application.aggregates.repository.CreditBalanceRepository
import example.bankwealth.application.aggregates.repository.FundOrderRepository
import example.bankwealth.application.aggregates.repository.SipPlanRepository
import example.bankwealth.infrastructure.repositories.aggregate.CreditBalanceRepositoryImpl
import example.bankwealth.infrastructure.repositories.aggregate.FundOrderRepositoryImpl
import example.bankwealth.infrastructure.repositories.aggregate.SipPlanRepositoryImpl
import example.bankwealth.infrastructure.bootstrap.ApplicationBootstrap
import javax.inject.Singleton

final class BootstrapModule extends AbstractModule {
  override def configure(): Unit = {
    bind(classOf[CreditBalanceRepository]).to(classOf[CreditBalanceRepositoryImpl])
    bind(classOf[FundOrderRepository]).to(classOf[FundOrderRepositoryImpl])
    bind(classOf[SipPlanRepository]).to(classOf[SipPlanRepositoryImpl])
    installOptionalModule("example.bankwealth.modules.HandwrittenBindingsModule")
    bind(classOf[ApplicationBootstrap]).asEagerSingleton()
  }

  private def installOptionalModule(className: String): Unit =
    try {
      val cls = Class.forName(className)
      install(cls.getDeclaredConstructor().newInstance().asInstanceOf[Module])
    } catch {
      case _: ClassNotFoundException => ()
    }

  @Provides
  @Singleton
  def provideExtendedSystem(system: ActorSystem): ExtendedActorSystem =
    system.asInstanceOf[ExtendedActorSystem]

  @Provides
  @Singleton
  def provideClusterSharding(system: ActorSystem): ClusterSharding =
    ClusterSharding(system.toTyped)
}
