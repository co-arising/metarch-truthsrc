package example.stockreservation.application.toolgates

/** A transport that answered but delivered a payload outside the declared protocol:
  * a protocol conflict, never a business refusal, never a synthesized success.
  * Constructed as a value and placed on the Future failure channel; never thrown. */
final case class ProtocolViolation(evidence: String) extends RuntimeException(evidence)
