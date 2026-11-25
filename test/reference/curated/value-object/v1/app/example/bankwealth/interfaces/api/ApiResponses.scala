package example.bankwealth.interfaces.api

import example.bankwealth.application.readmodels.ReadModelViews._

object ApiResponses {
  final case class BankAccountResponse(metadata: BankReadMetadata, account: Option[BankAccountView])
  final case class BankPendingResponse(
    metadata: BankReadMetadata,
    operations: Vector[BankPendingOperationView],
    nextAfter: Option[Long]
  )
}
