package example.bankwealth.domain.entities

import example.bankwealth.domain.values._

object CreditBalanceEntity {
  type State = example.bankwealth.domain.CreditBalanceState
  val State: example.bankwealth.domain.CreditBalanceState.type = example.bankwealth.domain.CreditBalanceState

  type Event = example.bankwealth.domain.CreditBalanceProtocol.Event
  val Events: example.bankwealth.domain.CreditBalanceProtocol.type = example.bankwealth.domain.CreditBalanceProtocol

  def empty: State = State(
    id = AccountId(""),
    initialized = false,
    accountBalance = Map(),
    reservedAmount = Map(),
    incomingCredits = Map(),
    committedOutgoing = Map(),
    committedIncoming = Map(),
    compensatedOutgoing = Map(),
    compensatedIncoming = Map()
  )
}
