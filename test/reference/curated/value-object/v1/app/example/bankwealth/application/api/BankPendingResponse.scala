package example.bankwealth.application.api

import example.bankwealth.application.projection.{BankPendingOperationView, BankReadMetadata}

final case class BankPendingResponse(
  metadata: BankReadMetadata,
  operations: Vector[BankPendingOperationView],
  nextAfter: Option[Long]
)
