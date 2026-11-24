package example.bankwealth.domain.events

import example.bankwealth.domain.values._

object CreditBalanceEvents {
  sealed trait Command
  sealed trait Event
  final case class InitializeAccount(resource: AccountId, currency: String, amount: Money) extends Command
  final case class ReserveFunds(txid: TxId, resource: AccountId, amount: Money) extends Command
  final case class DeductFunds(txid: TxId, resource: AccountId, amount: Money) extends Command
  final case class ReleaseReservedFunds(txid: TxId, resource: AccountId, amount: Money) extends Command
  final case class RecordIncomingCredits(txid: TxId, resource: AccountId, amount: Money) extends Command
  final case class CommitIncomingCredits(txid: TxId, resource: AccountId, amount: Money) extends Command
  final case class CancelIncomingCredit(txid: TxId, resource: AccountId, amount: Money) extends Command
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
}
