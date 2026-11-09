package reference.inventory.kernel

import java.io.{ByteArrayInputStream, ByteArrayOutputStream, DataInputStream, DataOutputStream}
import java.nio.ByteBuffer
import java.nio.charset.{CodingErrorAction, StandardCharsets}
import java.security.MessageDigest
import scala.util.Try

trait BinaryCodec[A] {
  def pin: CodecIdentity
  def encode(value: A): Vector[Byte]
  def decode(bytes: Vector[Byte]): Try[A]
}
/** Explicit v1 length framing. No ordinal/name-derived tags, Java serialization or unsafe wrap. */
object BinaryCodecs {
  private val MaxBytes = 65536
  private final class Out {
    val buffer = new ByteArrayOutputStream
    val data = new DataOutputStream(buffer)
    def int(v: Int): Unit = data.writeInt(v)
    def long(v: Long): Unit = data.writeLong(v)
    def text(v: String): Unit = {
      val b = StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(v))
      require(b.remaining <= MaxBytes); int(b.remaining)
      while (b.hasRemaining) data.writeByte(b.get)
    }
    def bytes: Vector[Byte] = { data.flush(); buffer.toByteArray.toVector }
  }
  private final class In(bytes: Vector[Byte]) {
    require(bytes.size <= MaxBytes, "frame too large")
    val data = new DataInputStream(new ByteArrayInputStream(bytes.toArray))
    def int(): Int = data.readInt()
    def long(): Long = data.readLong()
    def text(): String = {
      val length = int(); require(length >= 0 && length <= data.available(), "invalid length")
      val b = new Array[Byte](length); data.readFully(b)
      StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)).toString
    }
    def done(): Unit = require(data.available() == 0, "trailing bytes")
  }
  private def codec[A](name: String)(write: (Out, A) => Unit)(read: In => A): BinaryCodec[A] =
    new BinaryCodec[A] {
      val pin = CodecIdentity(name, 1)
      def encode(v: A): Vector[Byte] = {
        val out = new Out; out.text(name); out.int(1); write(out, v)
        val b = out.bytes; require(b.size <= MaxBytes); b
      }
      def decode(b: Vector[Byte]): Try[A] = Try {
        val in = new In(b); require(in.text() == name && in.int() == 1, "codec pin mismatch")
        val value = read(in); in.done(); require(encode(value) == b, "noncanonical encoding"); value
      }
    }
  private def requestOut(o: Out, v: ReservationRequest): Unit = {
    o.text(v.requestId.value); o.text(v.warehouseA.value); o.text(v.warehouseB.value)
    o.text(v.sku.value); o.int(v.quantity.value)
  }
  private def requestIn(i: In): ReservationRequest =
    ReservationRequest(RequestId(i.text()), Warehouse(i.text()), Warehouse(i.text()), Sku(i.text()), Quantity(i.int()))
  private def sagaOut(o: Out, v: SagaIdentity): Unit = {
    o.text(v.transactionId.value); o.text(v.definitionName); o.int(v.definitionVersion); o.text(v.argsDigest)
    o.text(v.definitionDigest); o.text(v.argsCodec.id); o.int(v.argsCodec.version); o.text(v.planDigest)
  }
  private def sagaIn(i: In): SagaIdentity = SagaIdentity(TransactionId(i.text()), i.text(), i.int(),
    i.text(), i.text(), CodecIdentity(i.text(), i.int()), i.text())
  private def phaseOut(o: Out, v: PhaseIdentity): Unit = {
    sagaOut(o, v.saga); o.text(v.participantId); o.text(v.resource.value); o.text(v.stepId)
    o.int(v.phase match { case ReservationPhase.Prepare => 1; case ReservationPhase.Commit => 2; case ReservationPhase.Compensate => 3 })
  }
  private def phaseIn(i: In): PhaseIdentity = {
    val s = sagaIn(i); val p = i.text(); val r = Warehouse(i.text()); val step = i.text()
    val phase = i.int() match {
      case 1 => ReservationPhase.Prepare; case 2 => ReservationPhase.Commit; case 3 => ReservationPhase.Compensate
      case _ => throw new IllegalArgumentException("unknown phase tag")
    }
    PhaseIdentity(s, p, r, step, phase)
  }
  private def itemOut(o: Out, v: ItemIdentity): Unit = { o.text(v.jobId); o.long(v.sequence); o.text(v.itemId) }
  private def itemIn(i: In): ItemIdentity = ItemIdentity(i.text(), i.long(), i.text())
  val request: BinaryCodec[ReservationRequest] = codec("inventory.request")(requestOut)(requestIn)
  val identity: BinaryCodec[SagaIdentity] = codec("inventory.saga-identity")(sagaOut)(sagaIn)
  val phaseIdentity: BinaryCodec[PhaseIdentity] = codec("inventory.phase-identity")(phaseOut)(phaseIn)
  val item: BinaryCodec[ItemIdentity] = codec("inventory.item-identity")(itemOut)(itemIn)
  val association: BinaryCodec[Association] = codec[Association]("inventory.association")((o, v) => {
    itemOut(o, v.item); requestOut(o, v.request); sagaOut(o, v.saga); o.text(v.resultKey)
  })(i => Association(itemIn(i), requestIn(i), sagaIn(i), i.text()))
  val prepare: BinaryCodec[PrepareReceipt] = codec[PrepareReceipt]("inventory.prepare-receipt")((o, v) => {
    phaseOut(o, v.identity); o.text(v.reservationId); o.text(v.proof)
  })(i => PrepareReceipt(phaseIn(i), i.text(), i.text()))
  val commit: BinaryCodec[CommitReceipt] = codec[CommitReceipt]("inventory.commit-receipt")((o, v) => {
    phaseOut(o, v.identity); o.text(v.reservationId); o.text(v.proof)
  })(i => CommitReceipt(phaseIn(i), i.text(), i.text()))
  val compensate: BinaryCodec[CompensateReceipt] = codec[CompensateReceipt]("inventory.compensate-receipt")((o, v) => {
    phaseOut(o, v.identity); o.text(v.reservationId); o.text(v.proof)
  })(i => CompensateReceipt(phaseIn(i), i.text(), i.text()))
  val result: BinaryCodec[SagaResult] = codec[SagaResult]("inventory.result")((o, v) => {
    o.int(v match {
      case _: SagaResult.Succeeded => 1; case _: SagaResult.RejectedBeforeEffects => 2
      case _: SagaResult.Compensated => 3; case _: SagaResult.RecoveryRequired => 4; case _: SagaResult.OutcomeUnknown => 5
    })
    o.text(v.payload.transactionId.value); requestOut(o, v.payload.originalRequest)
  })(i => {
    val tag = i.int(); val p = ReservationResult(TransactionId(i.text()), requestIn(i))
    tag match {
      case 1 => SagaResult.Succeeded(p); case 2 => SagaResult.RejectedBeforeEffects(p)
      case 3 => SagaResult.Compensated(p); case 4 => SagaResult.RecoveryRequired(p); case 5 => SagaResult.OutcomeUnknown(p)
      case _ => throw new IllegalArgumentException("unknown result tag")
    }
  })
  val manifestResult: BinaryCodec[ManifestResult] = codec[ManifestResult]("inventory.manifest-result")((o, v) => {
    o.int(v.items.size)
    v.items.foreach { entry =>
      itemOut(o, entry.item)
      o.text(java.util.Base64.getEncoder.encodeToString(result.encode(entry.result).toArray))
      o.int(if (entry.delivery.isDefined) 1 else 0)
      entry.delivery.foreach { r =>
        o.text(r.key); sagaOut(o, r.identity); o.text(java.util.Base64.getEncoder.encodeToString(r.bytes.toArray)); o.text(r.proof)
      }
    }
  })(i => {
    val count = i.int(); require(count > 0 && count <= 2, "bounded manifest results")
    ManifestResult(Vector.fill(count) {
      val item = itemIn(i); val value = result.decode(java.util.Base64.getDecoder.decode(i.text()).toVector).get
      val delivery = i.int() match {
        case 0 => None
        case 1 => Some(ResultReceipt(i.text(), sagaIn(i), java.util.Base64.getDecoder.decode(i.text()).toVector, i.text()))
        case _ => throw new IllegalArgumentException("invalid delivery option")
      }
      ItemResult(item, value, delivery)
    })
  })
  def digest(bytes: Vector[Byte]): String = MessageDigest.getInstance("SHA-256").digest(bytes.toArray)
    .map(b => f"${b & 255}%02x").mkString
}
