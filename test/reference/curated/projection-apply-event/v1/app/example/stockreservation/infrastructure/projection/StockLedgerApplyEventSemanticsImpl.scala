package example.stockreservation.infrastructure.projection

import javax.inject.{Inject, Singleton}

import example.stockreservation.application.projection.handlers.StockLedgerApplyEventSemantics
import example.stockreservation.application.projection.repository.StockLedgerTable.StockLedgerView

/** 手写业务语义实现（隔离区所有·生成器永不创建或覆写）：
  * 本台账的三大业务默认——白纸行 / 「无时间戳」＝记入当前时刻 / 缺省文本＝空串。 */
@Singleton
final class StockLedgerApplyEventSemanticsImpl @Inject()() extends StockLedgerApplyEventSemantics {

  /** 业务白纸行：十列默认集中在这一处，由业务所有（Id 列＝零 UUID 占位·copy 覆写即时补真实键）。 */
  override def emptyRow: StockLedgerView = StockLedgerView(
    skuId = net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000"),
    label = "",
    quantity = 0,
    reserved = false,
    totalAmount = 0,
    tags = Nil,
    lastEventAt = None,
    settledAt = None,
    `type` = "",
    tenantId = ""
  )

  /** 命名语义默认值：「无时间戳」＝记入当前时刻。本实现唯一的时钟读取点。 */
  private def untimestamped: Option[java.time.Instant] = Some(java.time.Instant.now())

  /** epoch0/null（PO 0L 缺省经 fromProto）→ untimestamped·正常时间原样入账。 */
  override def stamped(raw: java.time.Instant): Option[java.time.Instant] =
    if (raw == null || raw.toEpochMilli == 0L) untimestamped else Some(raw)

  /** 缺省文本＝空串（PO String 缺省 null 守卫）。 */
  override def text(raw: String): String = Option(raw).getOrElse("")
}
