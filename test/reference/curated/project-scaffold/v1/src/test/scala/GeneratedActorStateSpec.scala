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
        def BalanceAfterCommitIncomingCredits(state: example.bankwealth.domain.entities.CreditBalanceEntity.State, p: example.bankwealth.domain.invariants.params.CreditBalanceRuleParams.CommitIncomingCreditsParams): example.bankwealth.domain.values.Money = throw new UnsupportedOperationException("query-only test port")
        def BalanceAfterReleaseReservedFunds(state: example.bankwealth.domain.entities.CreditBalanceEntity.State, p: example.bankwealth.domain.invariants.params.CreditBalanceRuleParams.ReleaseReservedFundsParams): example.bankwealth.domain.values.Money = throw new UnsupportedOperationException("query-only test port")
        def BalanceAfterReserveFunds(state: example.bankwealth.domain.entities.CreditBalanceEntity.State, p: example.bankwealth.domain.invariants.params.CreditBalanceRuleParams.ReserveFundsParams): example.bankwealth.domain.values.Money = throw new UnsupportedOperationException("query-only test port")
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
        def StableRefundOperationId(state: example.bankwealth.domain.entities.FundOrderEntity.State, p: example.bankwealth.domain.invariants.params.FundOrderRuleParams.RequestFundPurchaseRefundParams): example.bankwealth.domain.values.OperationId = throw new UnsupportedOperationException("query-only test port")
        def StableTaRequestId(state: example.bankwealth.domain.entities.FundOrderEntity.State, p: example.bankwealth.domain.invariants.params.FundOrderRuleParams.RegisterFundTASubmissionParams): example.bankwealth.domain.values.TaRequestId = throw new UnsupportedOperationException("query-only test port")
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
        def StableSipOccurrence(state: example.bankwealth.domain.entities.SipPlanEntity.State, p: example.bankwealth.domain.invariants.params.SipPlanRuleParams.TriggerSipInstallmentParams): example.bankwealth.domain.values.SipOccurrence = throw new UnsupportedOperationException("query-only test port")
      }
      val ref = kit.spawn(example.bankwealth.infrastructure.bootstrap.SipPlanBootstrap.create("generated-SipPlan", example.bankwealth.domain.entities.SipPlanEntity.empty, hosts))
      val probe = kit.createTestProbe[example.bankwealth.domain.entities.SipPlanEntity.State]()
      ref ! example.bankwealth.application.aggregates.SipPlanProtocol.GetState(probe.ref)
      probe.expectMessage(example.bankwealth.domain.entities.SipPlanEntity.empty)
    } finally kit.shutdownTestKit()
  }
}
