package example.stockreservation.application.projection.handlers

import example.stockreservation.application.projection.repository.StockLedgerTable.StockLedgerView

/** 台账视图业务语义面：默认行 / 时间戳 / 文本三个业务语义钩子。
  * 面由生成器发射；实现由手写隔离区所有，生成器永不创建或覆写。 */
trait StockLedgerApplyEventSemantics {
  def emptyRow: StockLedgerView
  def stamped(raw: java.time.Instant): Option[java.time.Instant]
  def text(raw: String): String
}
