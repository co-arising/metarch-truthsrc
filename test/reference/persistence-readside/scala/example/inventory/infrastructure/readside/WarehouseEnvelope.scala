package example.inventory.infrastructure.readside

import java.nio.CharBuffer
import java.nio.charset.{CodingErrorAction, StandardCharsets}

/** Captured caller metadata, not proof of event origin or resource authorization. */
final class WarehouseEnvelope private (
  val pid: String,
  val resource: String,
  val sequenceNr: Long,
  val manifest: String,
  private val captured: Array[Byte]
) {
  def bytes: Array[Byte] = captured.clone()
}

object WarehouseEnvelope {
  private def bounded(value: String, name: String, max: Int): Unit = {
    require(value != null && value.nonEmpty, name + " is empty")
    require(!value.exists(Character.isISOControl), name + " contains a control character")
    val bytes = try {
      StandardCharsets.UTF_8.newEncoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .encode(CharBuffer.wrap(value)).remaining()
    } catch { case e: java.nio.charset.CharacterCodingException =>
      throw new IllegalArgumentException(name + " is not well-formed Unicode", e)
    }
    require(bytes <= max, name + " exceeds UTF-8 byte bound")
  }
  def capture(pid: String, resource: String, sequenceNr: Long,
    manifest: String, bytes: Array[Byte]): WarehouseEnvelope = {
    bounded(pid, "pid", 256)
    bounded(resource, "resource", 256)
    bounded(manifest, "manifest", 1024)
    require(sequenceNr > 0, "sequenceNr must be positive")
    require(bytes != null && bytes.nonEmpty && bytes.length <= 1048576, "payload outside bound")
    new WarehouseEnvelope(pid, resource, sequenceNr, manifest, bytes.clone())
  }
}
