package example.bankwealth.domain.values

final case class BankPendingResponse(metadata: BankReadMetadata, operations: Vector[BankPendingOperationView], nextAfter: Option[Long])
