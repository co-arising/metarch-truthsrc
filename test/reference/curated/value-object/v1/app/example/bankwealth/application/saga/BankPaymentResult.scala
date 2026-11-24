package example.bankwealth.application.saga

import example.bankwealth.domain.values.TxId

final case class BankPaymentResult(txid: TxId)
