package example.bankwealth.domain.services

import example.bankwealth.domain.entities.FundOrderEntity.State
import example.bankwealth.domain.invariants.params.FundOrderRuleParams._
import example.bankwealth.domain.values._
import net.imadz.common.CommonTypes.{DomainService, iMadzError}

trait FundOrderComputations extends DomainService {
  def stableRefundOperationId(state: State, p: RequestFundPurchaseRefundParams): Either[iMadzError, OperationId]
  def stableTaRequestId(state: State, p: RegisterFundTASubmissionParams): Either[iMadzError, TaRequestId]
}
object FundOrderComputations {
}
