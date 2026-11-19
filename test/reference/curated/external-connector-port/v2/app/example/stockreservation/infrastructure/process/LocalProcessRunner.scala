package example.stockreservation.infrastructure.process

import scala.concurrent.Future

/** One bounded local-process execution request: the tool script bound at generation
  * time, one opaque argument element, and the mandatory timeout budget. */
final case class ProcessRequest(script: String, argument: String, timeoutMs: Long)

/** Runner-contract violations are named values on the failure channel; never thrown. */
final case class TimeoutViolation(evidence: String) extends RuntimeException(evidence)
final case class ConcurrencyRejected(evidence: String) extends RuntimeException(evidence)
final case class ScriptRejected(evidence: String) extends RuntimeException(evidence)

/** Handwritten local-process runner lib (手写外域固定 lib，两族共用、生成器永不创建).
  * Hardening tiers bind here and nowhere else. Contract clauses:
  * 1. argv-direct: `argument` is handed to the process verbatim as a single argv
  *    element; the runner never interprets a shell and never concatenates strings
  *    into a command line. The caller decides what to say; the runner guarantees
  *    how it is delivered.
  * 2. bounded lifecycle: the runner exclusively spawns, awaits and destroys the
  *    child process; a timeout or failure kills the process group — no orphans.
  *    Every run either yields one output line on the success channel or ends in a
  *    named violation (TimeoutViolation, ConcurrencyRejected, ScriptRejected) or
  *    the transport failure on the failure channel; never a retry, never a
  *    synthesized success.
  * 3. pinning hook: `ProcessRequest.script` may be validated by the runner against
  *    a pinned script manifest (allowlist plus content hash); an unpinned script
  *    fails with ScriptRejected. The manifest is runner configuration, never
  *    caller knowledge.
  * Deployment may swap this binding for a sandboxed or daemon-client runner of the
  * same trait; the gate face above is unaffected. */
trait LocalProcessRunner {
  def run(request: ProcessRequest): Future[String]
}
