package example.bankwealth.domain.services

import example.bankwealth.domain.entities.SipPlanEntity.State
import example.bankwealth.domain.invariants.params.SipPlanRuleParams._
import example.bankwealth.domain.values._
import net.imadz.common.CommonTypes.DomainService

trait SipPlanComputations extends DomainService {
  def stableSipOccurrence(state: State, p: TriggerSipInstallmentParams): SipOccurrence
}
object SipPlanComputations {
}
