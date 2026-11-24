package example.bankwealth.application.api

import example.bankwealth.application.projection.{BankAccountView, BankReadMetadata}

final case class BankAccountResponse(metadata: BankReadMetadata, account: Option[BankAccountView])
