package example.bankwealth.infrastructure.bootstrap

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.adapter._
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import example.bankwealth.application.aggregates.CreditBalanceAggregate
import example.bankwealth.domain.services.CreditBalanceComputations
import example.bankwealth.application.aggregates.FundOrderAggregate
import example.bankwealth.application.aggregates.FundOrderProtocol
import example.bankwealth.domain.services.FundOrderComputations
import example.bankwealth.application.aggregates.SipPlanAggregate
import example.bankwealth.domain.services.SipPlanComputations
import example.bankwealth.application.readmodels.bank_journal.BankJournalReadsideProjectionHandler
import example.bankwealth.application.readmodels.bank_journal.repository.BankJournalReadsideRepository
import javax.inject.{Inject, Singleton}
import play.api.{Application, ApplicationLoader}
import scala.concurrent.ExecutionContext
import scala.util.control.NonFatal
import BankServiceContract._

/** Guice eager-singleton application bootstrap mounting all CQRS aggregates and projections. */
@Singleton
class ApplicationBootstrap @Inject()(
  classicSystem: akka.actor.ActorSystem,
  sharding: ClusterSharding,
  creditBalanceComputations: CreditBalanceComputations,
  fundOrderComputations: FundOrderComputations,
  fundOrderAuthority: FundOrderProtocol.ExternalAuthority,
  sipPlanComputations: SipPlanComputations,
  bankJournalReadsideRepository: BankJournalReadsideRepository,
  bankJournalReadsideBindings: BankJournalReadsideProjectionHandler.Bindings
) extends CreditBalanceBootstrap
  with FundOrderBootstrap
  with SipPlanBootstrap
  with BankJournalReadsideBootstrap {
  private implicit val system: ActorSystem[Nothing] = classicSystem.toTyped
  private implicit val ec: ExecutionContext = system.executionContext

  initCreditBalanceAggregate(sharding, creditBalanceComputations)
  initFundOrderAggregate(sharding, fundOrderComputations, fundOrderAuthority)
  initSipPlanAggregate(sharding, sipPlanComputations)
  initBankJournalReadsideProjection(
    system = system,
    readJournalPluginId = classicSystem.settings.config.getString("akka.persistence.query.journal.id"),
    tags = CreditBalanceAggregate.tags ++ FundOrderAggregate.tags ++ SipPlanAggregate.tags,
    repository = bankJournalReadsideRepository,
    bindings = bankJournalReadsideBindings
  )
}

object ApplicationBootstrap {
  def load(context: ApplicationLoader.Context): Application = {
    BankServiceConfiguration.validate(context.initialConfiguration)
    val factory = context.environment.classLoader.loadClass("example.bankwealth.integration.BankServiceFactory").getDeclaredConstructor().newInstance().asInstanceOf[Factory]
    require(factory.implementation == "example.bankwealth.integration.BankServiceFactory" && factory.version == "bank-v1-service-1", "composition factory pin mismatch")
    val composition = factory.create(context)
    try {
      requireInstalled(composition)
      new BankServiceComponents(context, composition).application
    } catch { case NonFatal(error) =>
      context.lifecycle.stop()
      composition.close()
      throw error
    }
  }
}
