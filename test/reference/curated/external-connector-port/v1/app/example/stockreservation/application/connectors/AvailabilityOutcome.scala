package example.stockreservation.application.connectors

import example.stockreservation.domain.values.SkuId
import scala.util.{Failure, Success, Try}

/** Typed outcome of one external availability probe: an answer or an explicit refusal.
  * A refusal is a business result on the success channel; transport or payload problems
  * belong on the failure channel instead, so the two can never be confused. */
sealed trait AvailabilityOutcome extends Product with Serializable

object AvailabilityOutcome {

  /** The external catalog answered with the currently available quantity for the SKU. */
  final case class Answer(sku: SkuId, available: Long) extends AvailabilityOutcome

  /** The external catalog explicitly refused the probe; never converted into an answer. */
  final case class Refused(code: String, message: String) extends AvailabilityOutcome

  private val answerVerb = "ANSWER"
  private val refusedVerb = "REFUSED"
  private val fieldSeparator = "\\|"

  /** Decodes one probe payload line. Legal shapes: `ANSWER|<sku>|<nonnegative count>` and
    * `REFUSED|<code>|<message>`; the message and the SKU carry no separator and no newline. */
  def decode(raw: String): Try[AvailabilityOutcome] = parse(raw) match {
    case Right(outcome) => Success(outcome)
    case Left(violation) => Failure(violation)
  }

  private def parse(raw: String): Either[ProtocolViolation, AvailabilityOutcome] =
    if (raw.contains('\n') || raw.contains('\r')) Left(ProtocolViolation("payload is not a single line"))
    else splitFields(raw).flatMap(decodeFields)

  private def splitFields(raw: String): Either[ProtocolViolation, Vector[String]] = {
    val fields = raw.split(fieldSeparator, -1).toVector
    if (fields.length < 2 || fields.last.isEmpty) Left(ProtocolViolation("payload has an empty final field"))
    else Right(fields)
  }

  private def decodeFields(fields: Vector[String]): Either[ProtocolViolation, AvailabilityOutcome] = fields match {
    case Vector(`answerVerb`, skuText, availableText) => answer(skuText, availableText)
    case Vector(`refusedVerb`, code, message) => refusal(code, message)
    case other => Left(ProtocolViolation("unknown probe payload: " + other.mkString("|")))
  }

  private def answer(skuText: String, availableText: String): Either[ProtocolViolation, AvailabilityOutcome] =
    available(availableText).flatMap { available =>
      nominal(SkuId.apply, skuText, "answer sku").map(sku => Answer(sku, available))
    }

  private def available(text: String): Either[ProtocolViolation, Long] =
    Try(text.toLong).fold(
      problem => Left(ProtocolViolation("answer count is not a Long: " + text)),
      count => if (count < 0L) Left(ProtocolViolation("answer count is negative: " + text)) else Right(count))

  private def refusal(code: String, message: String): Either[ProtocolViolation, AvailabilityOutcome] =
    if (code.isEmpty || message.isEmpty) Left(ProtocolViolation("refusal needs a code and a message"))
    else Right(Refused(code, message))

  private def nominal[T](construct: String => T, value: String, what: String): Either[ProtocolViolation, T] =
    Try(construct(value)).fold(
      problem => Left(ProtocolViolation(what + " rejected: " + problem.getMessage)),
      typed => Right(typed))
}
