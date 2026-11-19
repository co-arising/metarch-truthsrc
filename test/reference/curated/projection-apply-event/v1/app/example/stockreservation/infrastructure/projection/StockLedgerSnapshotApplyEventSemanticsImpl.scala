package example.stockreservation.infrastructure.projection

import javax.inject.{Inject, Singleton}

import example.stockreservation.application.projection.handlers.StockLedgerSnapshotApplyEventSemantics
import example.stockreservation.application.projection.repository.StockLedgerSnapshotTable.StockLedgerSnapshotView

/** 手写业务语义实现（隔离区所有·生成器永不创建或覆写）：
  * 本快照视图的两大业务默认——参数化白纸行 / 「无时间戳」＝记入当前时刻。 */
@Singleton
final class StockLedgerSnapshotApplyEventSemanticsImpl @Inject()()
    extends StockLedgerSnapshotApplyEventSemantics {

  /** 业务白纸行（persistenceId 族）：identity 列＝entityId 约定＋tenantId 参数，其余字面默认。 */
  override def emptyRow(entityId: String, tenantId: String): StockLedgerSnapshotView =
    StockLedgerSnapshotView(
      snapshotId = net.imadz.common.Id.of(entityId),
      tenantId = tenantId,
      totalAmount = 0,
      eventCount = 0,
      open = false,
      occurredAt = None
    )

  /** 命名语义默认值：「无时间戳」＝记入当前时刻。本实现唯一的时钟读取点。 */
  private def untimestamped: Option[java.time.Instant] = Some(java.time.Instant.now())

  /** epoch0/null（PO 0L 缺省经 fromProto）→ untimestamped·正常时间原样入账。 */
  override def stamped(raw: java.time.Instant): Option[java.time.Instant] =
    if (raw == null || raw.toEpochMilli == 0L) untimestamped else Some(raw)
}
