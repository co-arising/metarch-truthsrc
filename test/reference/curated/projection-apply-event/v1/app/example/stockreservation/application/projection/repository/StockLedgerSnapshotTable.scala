package example.stockreservation.application.projection.repository

import net.imadz.common.CommonTypes.Id

/** 手写名义读表供给（传统合同）：persistenceId 寻址的快照视图——
  * identity 列（Id）＋租户补列＋字面默认列。 */
object StockLedgerSnapshotTable {

  final case class StockLedgerSnapshotView(
    snapshotId: Id,
    tenantId: String,
    totalAmount: Long,
    eventCount: Int,
    open: Boolean,
    occurredAt: Option[java.time.Instant]
  )

  /** 列账（原名列）。 */
  val columns: Vector[String] = Vector("snapshotId", "tenantId", "totalAmount", "eventCount", "open", "occurredAt")
}
