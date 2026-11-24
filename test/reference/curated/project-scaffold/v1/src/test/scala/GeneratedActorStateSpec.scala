import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.testkit.PersistenceTestKitPlugin
import com.typesafe.config.ConfigFactory
import org.scalatest.funsuite.AnyFunSuite

final class GeneratedActorStateSpec extends AnyFunSuite {
  example.bankwealth.service.UnitConfigurationCheck.main(Array.empty)
  test("bankwealth/CreditBalance real actor serves typed state") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    try {
      val hosts = new example.bankwealth.domain.CreditBalanceComputations {
        def BalanceAfterCommitIncomingCredits(state: example.bankwealth.domain.CreditBalanceState, p: example.bankwealth.domain.CreditBalanceProtocol.CommitIncomingCredits): example.bankwealth.domain.values.Money = throw new UnsupportedOperationException("query-only test port")
        def BalanceAfterReleaseReservedFunds(state: example.bankwealth.domain.CreditBalanceState, p: example.bankwealth.domain.CreditBalanceProtocol.ReleaseReservedFunds): example.bankwealth.domain.values.Money = throw new UnsupportedOperationException("query-only test port")
        def BalanceAfterReserveFunds(state: example.bankwealth.domain.CreditBalanceState, p: example.bankwealth.domain.CreditBalanceProtocol.ReserveFunds): example.bankwealth.domain.values.Money = throw new UnsupportedOperationException("query-only test port")
      }
      val ref = kit.spawn(example.bankwealth.domain.CreditBalanceAggregateFactory.create("generated-CreditBalance", example.bankwealth.domain.CreditBalanceState.empty, hosts))
      val probe = kit.createTestProbe[example.bankwealth.domain.CreditBalanceState]()
      ref ! example.bankwealth.domain.CreditBalanceAggregate.GetState(probe.ref)
      probe.expectMessage(example.bankwealth.domain.CreditBalanceState.empty)
    } finally kit.shutdownTestKit()
  }
  test("bankwealth/FundOrder real actor serves typed state") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    try {
      val hosts = new example.bankwealth.domain.FundOrderComputations {
        def StableRefundOperationId(state: example.bankwealth.domain.FundOrderState, p: example.bankwealth.domain.FundOrderProtocol.RequestFundPurchaseRefund): example.bankwealth.domain.values.OperationId = throw new UnsupportedOperationException("query-only test port")
        def StableTaRequestId(state: example.bankwealth.domain.FundOrderState, p: example.bankwealth.domain.FundOrderProtocol.RegisterFundTASubmission): example.bankwealth.domain.values.TaRequestId = throw new UnsupportedOperationException("query-only test port")
      }
      val ref = kit.spawn(example.bankwealth.domain.FundOrderAggregateFactory.create("generated-FundOrder", example.bankwealth.domain.FundOrderState.empty, hosts, new example.bankwealth.domain.FundOrderAggregate.ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean = false }))
      val probe = kit.createTestProbe[example.bankwealth.domain.FundOrderState]()
      ref ! example.bankwealth.domain.FundOrderAggregate.GetState(probe.ref)
      probe.expectMessage(example.bankwealth.domain.FundOrderState.empty)
    } finally kit.shutdownTestKit()
  }
  test("bankwealth/SipPlan real actor serves typed state") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    try {
      val hosts = new example.bankwealth.domain.SipPlanComputations {
        def StableSipOccurrence(state: example.bankwealth.domain.SipPlanState, p: example.bankwealth.domain.SipPlanProtocol.TriggerSipInstallment): example.bankwealth.domain.values.SipOccurrence = throw new UnsupportedOperationException("query-only test port")
      }
      val ref = kit.spawn(example.bankwealth.domain.SipPlanAggregateFactory.create("generated-SipPlan", example.bankwealth.domain.SipPlanState.empty, hosts))
      val probe = kit.createTestProbe[example.bankwealth.domain.SipPlanState]()
      ref ! example.bankwealth.domain.SipPlanAggregate.GetState(probe.ref)
      probe.expectMessage(example.bankwealth.domain.SipPlanState.empty)
    } finally kit.shutdownTestKit()
  }
}
