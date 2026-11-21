package example.stockreservation.application.services.transactor

import com.google.protobuf.ByteString

import scala.util.Try

/** Generated fixture host family (strict-fixture-host): length-prefixed text
  * wire (raw no-money StrictWire branch, T05 constructs verbatim). The 64 cap
  * is a technical constant of the bounded-collection framing, not any contract
  * maxItems. UTF8 decoding REPORTs malformed and unmappable input; truncation
  * and negative lengths fail closed. The raw body iterates with mutable state;
  * the frozen structure gate bans Defn.Var at every layer, so the field walk
  * is tail-recursive over ByteString slices with identical checks in identical
  * order (recorded deviation, D5 class). */
object StrictWire {

  implicit final class StrictWireOps(private val value: ByteString) extends AnyVal {
    def ++(other: ByteString): ByteString = value.concat(other)
  }

  def lengthPrefixed(value: String): ByteString = {
    require(value != null, "text field required")
    val utf8 = value.getBytes(java.nio.charset.StandardCharsets.UTF_8)
    ByteString.copyFrom(
      java.nio.ByteBuffer.allocate(4 + utf8.length).putInt(utf8.length).put(utf8).array())
  }

  def readPrefixed(bytes: ByteString, count: Int): Try[(Vector[String], ByteString)] = Try {
    val (fields, rest) = readFields(bytes, count, Vector.empty)
    (fields, rest)
  }

  def lengthPrefixedAll(values: Vector[String]): ByteString = {
    require(values != null && values.size <= 64, "bounded collection required")
    values.foldLeft(headerBytes(values.size))((bytes, value) => bytes.concat(lengthPrefixed(value)))
  }

  def readPrefixedAll(bytes: ByteString): Try[(Vector[String], ByteString)] = {
    require(bytes.size >= 4, "bounded collection header required")
    val count = headerOf(bytes)
    require(count >= 0 && count <= 64, "bounded collection count required")
    readPrefixed(bytes.substring(4), count)
  }

  private def headerBytes(count: Int): ByteString =
    ByteString.copyFrom(java.nio.ByteBuffer.allocate(4).putInt(count).array())

  private def readFields(
      bytes: ByteString,
      remaining: Int,
      acc: Vector[String]
  ): (Vector[String], ByteString) =
    if (remaining <= 0) (acc, bytes)
    else {
      require(bytes.size >= 4, "truncated length header")
      val length = headerOf(bytes)
      require(length >= 0, "negative field length")
      require(bytes.size >= 4 + length, "truncated text field")
      val chunk = decodeUtf8(bytes.substring(4, 4 + length))
      readFields(bytes.substring(4 + length), remaining - 1, acc :+ chunk)
    }

  private def headerOf(bytes: ByteString): Int =
    ((bytes.byteAt(0) & 0xff) << 24) | ((bytes.byteAt(1) & 0xff) << 16) |
      ((bytes.byteAt(2) & 0xff) << 8) | (bytes.byteAt(3) & 0xff)

  private def decodeUtf8(value: ByteString): String = {
    val decoder = java.nio.charset.StandardCharsets.UTF_8.newDecoder()
      .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
      .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
    decoder.decode(java.nio.ByteBuffer.wrap(value.toByteArray)).toString
  }
}
