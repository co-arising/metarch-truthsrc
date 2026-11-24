package example.bankwealth.domain.invariants.params

import example.bankwealth.domain.values._

object CreditBalanceRuleParams {
  final case class InitializeAccountParams(resource: AccountId, currency: String, amount: Money)
  final case class ReserveFundsParams(txid: TxId, resource: AccountId, amount: Money)
  final case class DeductFundsParams(txid: TxId, resource: AccountId, amount: Money)
  final case class ReleaseReservedFundsParams(txid: TxId, resource: AccountId, amount: Money)
  final case class RecordIncomingCreditsParams(txid: TxId, resource: AccountId, amount: Money)
  final case class CommitIncomingCreditsParams(txid: TxId, resource: AccountId, amount: Money)
  final case class CancelIncomingCreditParams(txid: TxId, resource: AccountId, amount: Money)
}
