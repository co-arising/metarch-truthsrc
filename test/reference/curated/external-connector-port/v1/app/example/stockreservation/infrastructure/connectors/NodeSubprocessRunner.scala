package example.stockreservation.infrastructure.connectors

import scala.concurrent.Future

/** Handwritten subprocess mechanic seam: runs one Node script and yields its single
  * output line. Concrete process mechanics, timeouts and exit codes are owned by the
  * connector-implementation family; the port sample fixes only this injection seam. */
trait NodeSubprocessRunner {
  def run(script: String): Future[String]
}
