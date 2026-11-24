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

  sealed trait Event
  final case class AccountInitialized(resource: AccountId, currency: String, amount: Money) extends Event
  final case class ReserveFundsConfirmed(
    txid: TxId,
    resource: AccountId,
    amount: Money,
    currency: String,
    available: Money
  ) extends Event
  final case class DeductFundsConfirmed(txid: TxId, resource: AccountId, amount: Money) extends Event
  final case class ReleaseReservedFundsConfirmed(
    txid: TxId,
    resource: AccountId,
    amount: Money,
    currency: String,
    available: Money
  ) extends Event
  final case class RecordIncomingCreditsConfirmed(
    txid: TxId,
    resource: AccountId,
    amount: Money
  ) extends Event
  final case class CommitIncomingCreditsConfirmed(
    txid: TxId,
    resource: AccountId,
    amount: Money,
    currency: String,
    available: Money
  ) extends Event
  final case class CancelIncomingCreditConfirmed(txid: TxId, resource: AccountId, amount: Money) extends Event

  type EventHandler = (State, Event) => State
}
