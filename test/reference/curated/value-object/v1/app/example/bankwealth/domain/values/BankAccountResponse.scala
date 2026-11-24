package example.bankwealth.domain.values

final case class BankAccountResponse(metadata: BankReadMetadata, account: Option[BankAccountView])
