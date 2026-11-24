package example.bankwealth.domain

import example.bankwealth.domain.values._

final case class CreditBalanceState(
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

object CreditBalanceState {
  def empty: CreditBalanceState = example.bankwealth.domain.entities.CreditBalanceEntity.empty
}
