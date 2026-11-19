package example.stockreservation.application.projection.handlers

import example.stockreservation.application.projection.repository.StockLedgerSnapshotTable.StockLedgerSnapshotView

/** 快照视图业务语义面：默认行 / 时间戳两个业务语义钩子（本视图无文本钩子——诚实最小面）。
  * 面由生成器发射；实现由手写隔离区所有，生成器永不创建或覆写。 */
trait StockLedgerSnapshotApplyEventSemantics {
  def emptyRow(entityId: String, tenantId: String): StockLedgerSnapshotView
  def stamped(raw: java.time.Instant): Option[java.time.Instant]
}
