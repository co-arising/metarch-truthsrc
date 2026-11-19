package example.stockreservation.infrastructure.toolgates

import javax.inject.{Inject, Singleton}
import example.stockreservation.application.toolgates.{AvailabilityOutcome, LocationDirectory, StockCatalogToolGate}
import example.stockreservation.domain.values.SkuId
import example.stockreservation.infrastructure.process.{LocalProcessRunner, ProcessRequest}
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** StockCatalogToolGateImpl: Tool Gate Implementation
  * 机械委托给注入的手写基建——进程机械坐在 infrastructure.process 手写外域，本文件不承载进程机制。
  * 每个方法体是一个 MANUAL 块：块内的密封绑定委托体可由手写演化，重生成字节级保留；
  * BEGIN/END 标记必须成对（四空格，BEGIN 紧随 def 开括号，END 后即方法闭括号）。 */
@Singleton
class StockCatalogToolGateImpl @Inject()(runner: LocalProcessRunner, ec: ExecutionContext)
    extends StockCatalogToolGate {

  private val probeScript = "stockreservation/availability-probe.v1"
  private val probeTimeoutMs = 10000L
  private val directoryScript = "stockreservation/location-directory.v1"
  private val directoryTimeoutMs = 10000L

  override def probeAvailability(sku: SkuId): Future[AvailabilityOutcome] = {
    // ==== BEGIN MANUAL ====
    lift(runner.run(ProcessRequest(probeScript, sku.value, probeTimeoutMs)))(AvailabilityOutcome.decode)
    // ==== END MANUAL ====
  }

  override def locationDirectory(): Future[LocationDirectory] = {
    // ==== BEGIN MANUAL ====
    lift(runner.run(ProcessRequest(directoryScript, "", directoryTimeoutMs)))(LocationDirectory.decode)
    // ==== END MANUAL ====
  }

  private def lift[T](pending: Future[String])(decode: String => Try[T]): Future[T] =
    pending.flatMap(raw => Future.fromTry(decode(raw)))(ec)
}
