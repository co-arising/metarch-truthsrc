package example.bankwealth.domain.services

import example.bankwealth.domain.entities.FundOrderEntity.State
import example.bankwealth.domain.invariants.params.FundOrderRuleParams._
import example.bankwealth.domain.values._

trait FundOrderComputations {
  def StableRefundOperationId(state: State, p: RequestFundPurchaseRefundParams): OperationId
  def StableTaRequestId(state: State, p: RegisterFundTASubmissionParams): TaRequestId
}
object FundOrderComputations {
}
