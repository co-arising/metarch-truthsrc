package example.stockreservation.application.toolgates

import example.stockreservation.domain.values.SkuId
import scala.concurrent.Future

/**
 * StockCatalogToolGate: Local Tool Gate Interface
 * 问封死的外部工具一个业务问题——工具绑定（脚本、超时、协议翻译）密封在实现侧，
 * 本面只收业务参数、只还类型化裁决。只读纪律：gate 回答问题，不改域状态。
 * 内核隔离：本面不引用任何实现类；装配由 infrastructure.bootstrap 显式绑定完成。
 */
trait StockCatalogToolGate {

  def probeAvailability(sku: SkuId): Future[AvailabilityOutcome]
  // Logic: Consult the sealed availability probe tool for the current stock of the SKU and return the typed verdict.

  def locationDirectory(): Future[LocationDirectory]
  // Logic: Fetch the registered location directory snapshot of the warehouse from the sealed directory tool.

}
