package example.bankwealth.generated

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.testkit.PersistenceTestKitPlugin
import com.typesafe.config.ConfigFactory
import org.scalatest.funsuite.AnyFunSuite

final class GeneratedActorStateSpec extends AnyFunSuite {
  example.bankwealth.infrastructure.bootstrap.UnitConfigurationCheck.main(Array.empty)
  test("bankwealth/CreditBalance real actor serves typed state") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    try {
      val hosts = new example.bankwealth.domain.services.CreditBalanceComputations {
        def balanceAfterCommitIncomingCredits(state: example.bankwealth.domain.entities.CreditBalanceEntity.State, p: example.bankwealth.domain.invariants.params.CreditBalanceRuleParams.CommitIncomingCreditsParams): Either[net.imadz.common.CommonTypes.iMadzError, example.bankwealth.domain.values.Money] = Left(net.imadz.common.CommonTypes.iMadzError("UNSUPPORTED", "query-only test port"))
        def balanceAfterReleaseReservedFunds(state: example.bankwealth.domain.entities.CreditBalanceEntity.State, p: example.bankwealth.domain.invariants.params.CreditBalanceRuleParams.ReleaseReservedFundsParams): Either[net.imadz.common.CommonTypes.iMadzError, example.bankwealth.domain.values.Money] = Left(net.imadz.common.CommonTypes.iMadzError("UNSUPPORTED", "query-only test port"))
        def balanceAfterReserveFunds(state: example.bankwealth.domain.entities.CreditBalanceEntity.State, p: example.bankwealth.domain.invariants.params.CreditBalanceRuleParams.ReserveFundsParams): Either[net.imadz.common.CommonTypes.iMadzError, example.bankwealth.domain.values.Money] = Left(net.imadz.common.CommonTypes.iMadzError("UNSUPPORTED", "query-only test port"))
      }
      val ref = kit.spawn(example.bankwealth.infrastructure.bootstrap.CreditBalanceBootstrap.create("generated-CreditBalance", example.bankwealth.domain.entities.CreditBalanceEntity.empty, hosts))
      val probe = kit.createTestProbe[example.bankwealth.domain.entities.CreditBalanceEntity.State]()
      ref ! example.bankwealth.application.aggregates.CreditBalanceProtocol.GetState(probe.ref)
      probe.expectMessage(example.bankwealth.domain.entities.CreditBalanceEntity.empty)
    } finally kit.shutdownTestKit()
  }
  test("bankwealth/FundOrder real actor serves typed state") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    try {
      val hosts = new example.bankwealth.domain.services.FundOrderComputations {
        def stableRefundOperationId(state: example.bankwealth.domain.entities.FundOrderEntity.State, p: example.bankwealth.domain.invariants.params.FundOrderRuleParams.RequestFundPurchaseRefundParams): Either[net.imadz.common.CommonTypes.iMadzError, example.bankwealth.domain.values.OperationId] = Left(net.imadz.common.CommonTypes.iMadzError("UNSUPPORTED", "query-only test port"))
        def stableTaRequestId(state: example.bankwealth.domain.entities.FundOrderEntity.State, p: example.bankwealth.domain.invariants.params.FundOrderRuleParams.RegisterFundTASubmissionParams): Either[net.imadz.common.CommonTypes.iMadzError, example.bankwealth.domain.values.TaRequestId] = Left(net.imadz.common.CommonTypes.iMadzError("UNSUPPORTED", "query-only test port"))
      }
      val ref = kit.spawn(example.bankwealth.infrastructure.bootstrap.FundOrderBootstrap.create("generated-FundOrder", example.bankwealth.domain.entities.FundOrderEntity.empty, hosts, new example.bankwealth.application.aggregates.FundOrderProtocol.ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = false }))
      val probe = kit.createTestProbe[example.bankwealth.domain.entities.FundOrderEntity.State]()
      ref ! example.bankwealth.application.aggregates.FundOrderProtocol.GetState(probe.ref)
      probe.expectMessage(example.bankwealth.domain.entities.FundOrderEntity.empty)
    } finally kit.shutdownTestKit()
  }
  test("bankwealth/SipPlan real actor serves typed state") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    try {
      val hosts = new example.bankwealth.domain.services.SipPlanComputations {
        def stableSipOccurrence(state: example.bankwealth.domain.entities.SipPlanEntity.State, p: example.bankwealth.domain.invariants.params.SipPlanRuleParams.TriggerSipInstallmentParams): Either[net.imadz.common.CommonTypes.iMadzError, example.bankwealth.domain.values.SipOccurrence] = Left(net.imadz.common.CommonTypes.iMadzError("UNSUPPORTED", "query-only test port"))
      }
      val ref = kit.spawn(example.bankwealth.infrastructure.bootstrap.SipPlanBootstrap.create("generated-SipPlan", example.bankwealth.domain.entities.SipPlanEntity.empty, hosts))
      val probe = kit.createTestProbe[example.bankwealth.domain.entities.SipPlanEntity.State]()
      ref ! example.bankwealth.application.aggregates.SipPlanProtocol.GetState(probe.ref)
      probe.expectMessage(example.bankwealth.domain.entities.SipPlanEntity.empty)
    } finally kit.shutdownTestKit()
  }
  test("BootstrapModule satisfies all ApplicationBootstrap Guice DI bindings") {
    val playStub = new com.google.inject.AbstractModule {
      override def configure(): Unit = {
        bind(classOf[akka.actor.ActorSystem]).toProvider(new javax.inject.Provider[akka.actor.ActorSystem] {
          override def get(): akka.actor.ActorSystem = throw new UnsupportedOperationException("Stage.TOOL only")
        })
        bind(classOf[play.api.Configuration]).toInstance(play.api.Configuration.empty)
      }
    }
    val injector = com.google.inject.Guice.createInjector(
      com.google.inject.Stage.TOOL,
      playStub,
      new example.bankwealth.modules.BootstrapModule()
    )
    assert(injector.getBinding(classOf[example.bankwealth.infrastructure.bootstrap.ApplicationBootstrap]) != null)
  }
}
