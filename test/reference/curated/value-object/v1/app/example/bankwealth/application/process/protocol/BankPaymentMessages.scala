package example.bankwealth.application.process.protocol

import example.bankwealth.domain.values.TxId

object BankPaymentMessages {
  final case class BankPaymentResult(txid: TxId)
}
