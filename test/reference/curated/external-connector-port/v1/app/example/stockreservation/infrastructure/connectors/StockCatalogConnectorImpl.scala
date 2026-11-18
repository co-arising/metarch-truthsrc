package example.stockreservation.infrastructure.connectors

import javax.inject.{Inject, Singleton}
import example.stockreservation.application.connectors.{AvailabilityOutcome, LocationDirectory, StockCatalogConnector}
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** Reference delegation implementation for the port sample: exactly one runner call per
  * port call, the script argument passed through verbatim, typed lifting only — no retry,
  * no swallowing, no synthesized success. The production implementation contract belongs
  * to the connector-implementation family. */
@Singleton
class StockCatalogConnectorImpl @Inject()(runner: NodeSubprocessRunner, ec: ExecutionContext)
    extends StockCatalogConnector {

  private val locationDirectoryScript = "stockreservation/location-directory.v1"

  override def probeAvailability(script: String): Future[AvailabilityOutcome] =
    lift(runner.run(script))(AvailabilityOutcome.decode)

  override def locationDirectory(): Future[LocationDirectory] =
    lift(runner.run(locationDirectoryScript))(LocationDirectory.decode)

  private def lift[T](pending: Future[String])(decode: String => Try[T]): Future[T] =
    pending.flatMap(raw => Future.fromTry(decode(raw)))(ec)
}
