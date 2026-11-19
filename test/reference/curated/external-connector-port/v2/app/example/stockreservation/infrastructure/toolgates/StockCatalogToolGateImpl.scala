package example.stockreservation.infrastructure.toolgates

import javax.inject.{Inject, Singleton}
import example.stockreservation.application.toolgates.{AvailabilityOutcome, LocationDirectory, StockCatalogToolGate}
import example.stockreservation.domain.values.SkuId
import example.stockreservation.infrastructure.process.{LocalProcessRunner, ProcessRequest}
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** Sample-support reference implementation (the production implementation contract
  * belongs to the tool-gate-implementation family): seals one tool binding per gate
  * method — pinned script, timeout budget, typed lifting. Exactly one runner call
  * per gate call, the sealed binding and the business argument passed through
  * verbatim — no retry, no swallowing, no synthesized verdict. */
@Singleton
class StockCatalogToolGateImpl @Inject()(runner: LocalProcessRunner, ec: ExecutionContext)
    extends StockCatalogToolGate {

  private val probeScript = "stockreservation/availability-probe.v1"
  private val probeTimeoutMs = 10000L
  private val directoryScript = "stockreservation/location-directory.v1"
  private val directoryTimeoutMs = 10000L

  override def probeAvailability(sku: SkuId): Future[AvailabilityOutcome] =
    lift(runner.run(ProcessRequest(probeScript, sku.value, probeTimeoutMs)))(AvailabilityOutcome.decode)

  override def locationDirectory(): Future[LocationDirectory] =
    lift(runner.run(ProcessRequest(directoryScript, "", directoryTimeoutMs)))(LocationDirectory.decode)

  private def lift[T](pending: Future[String])(decode: String => Try[T]): Future[T] =
    pending.flatMap(raw => Future.fromTry(decode(raw)))(ec)
}
