package goldens.readmodeldsl

import scala.math.BigDecimal

/** Read model: Chain Statistics — served by GET /api/bank-batch/state */
final case class ChainStatistics(chain: String, total: Int)

object ChainStatisticsView {
  def empty: ChainStatistics = ChainStatistics("", 0)
  // TODO(intent): projection logic from Customer Order, Batch Chain Run
}
