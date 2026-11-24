package example.bankwealth.domain

import FundOrderProtocol._

object FundOrderEventHandler {
  def apply(state: FundOrderState, input: Event): FundOrderState =
    example.bankwealth.domain.entities.behaviors.FundOrderEventHandler(state, input)
}
