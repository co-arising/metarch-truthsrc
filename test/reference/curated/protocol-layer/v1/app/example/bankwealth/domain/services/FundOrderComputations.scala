package example.bankwealth.domain.services

import example.bankwealth.domain.entities.FundOrderEntity.State
import example.bankwealth.domain.invariants.params.FundOrderRuleParams._
import example.bankwealth.domain.values._
import net.imadz.common.CommonTypes.DomainService

trait FundOrderComputations extends DomainService {
  def stableRefundOperationId(state: State, p: RequestFundPurchaseRefundParams): OperationId
  def stableTaRequestId(state: State, p: RegisterFundTASubmissionParams): TaRequestId
}
object FundOrderComputations {
}
