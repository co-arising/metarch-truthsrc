package example.bankwealth.domain.services

import example.bankwealth.domain.entities.SipPlanEntity.State
import example.bankwealth.domain.invariants.params.SipPlanRuleParams._
import example.bankwealth.domain.values._

trait SipPlanComputations {
  def StableSipOccurrence(state: State, p: TriggerSipInstallmentParams): SipOccurrence
}
object SipPlanComputations {
}
