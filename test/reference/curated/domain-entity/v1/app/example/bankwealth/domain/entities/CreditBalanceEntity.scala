package example.bankwealth.domain.entities

import example.bankwealth.domain.values._

object CreditBalanceEntity {
  final case class State(
    id: AccountId,
    initialized: Boolean,
    accountBalance: Map[String, Money],
    reservedAmount: Map[TxId, Money],
    incomingCredits: Map[TxId, Money],
    committedOutgoing: Map[TxId, Money],
    committedIncoming: Map[TxId, Money],
    compensatedOutgoing: Map[TxId, Money],
    compensatedIncoming: Map[TxId, Money]
  )

  type Event = example.bankwealth.domain.events.CreditBalanceEvents.Event
  val Events: example.bankwealth.domain.events.CreditBalanceEvents.type = example.bankwealth.domain.events.CreditBalanceEvents

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
