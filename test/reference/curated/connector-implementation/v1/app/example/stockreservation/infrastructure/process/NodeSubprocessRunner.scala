package example.stockreservation.infrastructure.process

import scala.concurrent.Future

/** Handwritten infrastructure-process seam (手写外域): the generated connector
  * implementation injects this helper and delegates every port call to it. The
  * generator never creates this file; process spawning, timeouts and exit codes
  * are handwritten here. Contract: exactly one subprocess execution per run call,
  * the script handed to the external tool verbatim, one output line on success,
  * and any launch or execution failure surfaced as a failed Future — never
  * retried, never swallowed, never synthesized into an output line. */
trait NodeSubprocessRunner {
  def run(script: String): Future[String]
}
