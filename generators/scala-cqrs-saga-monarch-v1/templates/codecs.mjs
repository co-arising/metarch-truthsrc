import { n, q, types, resultPayload } from './syntax.mjs';
import { runCodecsTemplate } from './run-codecs.mjs';

/** Explicit length-prefixed-v1 protocol. No runtime or reference-source dependency. */
export function codecsTemplate(m, out) {
  const t = types(m), req = n(m.request), resource = n(m.field.resourceA.type), tx = n(m.transaction);
  const codec = role => { const c = m.serialization.codecs.find(c => c.role === role); return q(c.id) + ', ' + c.version; };
  out.append(`package ${m.packages.kernel}

import java.io.{ByteArrayInputStream, ByteArrayOutputStream, DataInputStream, DataOutputStream}
import java.nio.ByteBuffer
import java.nio.charset.{CodingErrorAction, StandardCharsets}
import java.security.MessageDigest
import scala.util.Try

object ${n(m.symbols.codecs)} {
  private val MaxBytes = ${m.serialization.maxBytes}
  private final class Out {
    val buffer = new ByteArrayOutputStream
    val data = new DataOutputStream(buffer)
    def int(value: Int): Unit = { require(buffer.size <= MaxBytes - 4, "frame too large"); data.writeInt(value) }
    def long(value: Long): Unit = { require(buffer.size <= MaxBytes - 8, "frame too large"); data.writeLong(value) }
    def text(value: String): Unit = {
      require(value != null && value.length <= MaxBytes, "text too large")
      val bytes = StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(value))
      require(bytes.remaining <= MaxBytes - buffer.size - 4, "text/frame too large")
      int(bytes.remaining)
      while (bytes.hasRemaining) data.writeByte(bytes.get)
    }
    def bytes: Vector[Byte] = { data.flush(); buffer.toByteArray.toVector }
  }
  private final class In(bytes: Vector[Byte]) {
    require(bytes.size <= MaxBytes, "frame too large")
    val data = new DataInputStream(new ByteArrayInputStream(bytes.toArray))
    def int(): Int = data.readInt()
    def long(): Long = data.readLong()
    def text(): String = {
      val length = int()
      require(length >= 0 && length <= data.available(), "invalid length")
      val bytes = new Array[Byte](length); data.readFully(bytes)
      StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString
    }
    def done(): Unit = require(data.available() == 0, "trailing bytes")
  }
  private def codec[A](id: String, version: Int)(write: (Out, A) => Unit)(read: In => A): ${t.binaryCodec}[A] =
    new ${t.binaryCodec}[A] {
      val pin = ${t.codecIdentity}(id, version)
      def encode(value: A): Vector[Byte] = {
        val out = new Out; out.text(id); out.int(version); write(out, value)
        val bytes = out.bytes; require(bytes.size <= MaxBytes, "frame too large"); bytes
      }
      def decode(bytes: Vector[Byte]): Try[A] = Try {
        val in = new In(bytes)
        require(in.text() == id && in.int() == version, "codec pin mismatch")
        val value = read(in); in.done()
        require(encode(value) == bytes, "noncanonical encoding"); value
      }
    }
  private def requestOut(o: Out, v: ${req}): Unit = {
${m.request.fields.map(f => `    o.${f.role === 'quantity' ? 'int' : 'text'}(v.${f.identifier}.value)`).join('\n')}
  }
  private def requestIn(i: In): ${req} =
    ${req}(${m.request.fields.map(f => `${n(f.type)}(i.${f.role === 'quantity' ? 'int' : 'text'}())`).join(', ')})
  private def sagaOut(o: Out, v: ${t.identity}): Unit = {
    o.text(v.transactionId.value); o.text(v.definitionName); o.int(v.definitionVersion)
    o.text(v.argsDigest); o.text(v.definitionDigest); o.text(v.argsCodec.id)
    o.int(v.argsCodec.version); o.text(v.planDigest)
  }
  private def sagaIn(i: In): ${t.identity} = ${t.identity}(${tx}(i.text()), i.text(), i.int(),
    i.text(), i.text(), ${t.codecIdentity}(i.text(), i.int()), i.text())
  private def phaseOut(o: Out, v: ${t.phaseIdentity}): Unit = {
    sagaOut(o, v.saga); o.text(v.participantId); o.text(v.resource.value); o.text(v.stepId)
    o.int(v.phase match {
${m.serialization.phaseTags.map(p => `      case ${t.phase}.${p.phase[0].toUpperCase() + p.phase.slice(1)} => ${p.tag}`).join('\n')}
    })
  }
  private def phaseIn(i: In): ${t.phaseIdentity} = {
    val saga = sagaIn(i); val participant = i.text(); val resource = ${resource}(i.text()); val step = i.text()
    val phase = i.int() match {
${m.serialization.phaseTags.map(p => `      case ${p.tag} => ${t.phase}.${p.phase[0].toUpperCase() + p.phase.slice(1)}`).join('\n')}
      case _ => throw new IllegalArgumentException("unknown phase tag")
    }
    ${t.phaseIdentity}(saga, participant, resource, step, phase)
  }
  private def itemOut(o: Out, v: ${t.item}): Unit = { o.text(v.jobId); o.long(v.sequence); o.text(v.itemId) }
  private def itemIn(i: In): ${t.item} = ${t.item}(i.text(), i.long(), i.text())
  val request: ${t.binaryCodec}[${req}] = codec(${codec('request')})(requestOut)(requestIn)
  val identity: ${t.binaryCodec}[${t.identity}] = codec(${codec('identity')})(sagaOut)(sagaIn)
  val phaseIdentity: ${t.binaryCodec}[${t.phaseIdentity}] = codec(${codec('phaseIdentity')})(phaseOut)(phaseIn)
  val item: ${t.binaryCodec}[${t.item}] = codec(${codec('item')})(itemOut)(itemIn)
  val association: ${t.binaryCodec}[${t.association}] = codec[${t.association}](${codec('association')})((o, v) => {
    itemOut(o, v.item); requestOut(o, v.request); sagaOut(o, v.saga); o.text(v.resultKey)
  })(i => ${t.association}(itemIn(i), requestIn(i), sagaIn(i), i.text()))
  private def handleLength(value: String, minLength: Int, maxLength: Int): Either[String, Unit] =
    if (value != null && value.codePointCount(0, value.length) >= minLength && value.codePointCount(0, value.length) <= maxLength) Right(())
    else Left("receipt handle outside declared length bounds")
`, m.sources);
  for (const phase of ['prepare', 'commit', 'compensate']) {
    const title = phase[0].toUpperCase() + phase.slice(1);
    out.append(`  def validate${title}Handle(id: ${t.phaseIdentity}, value: String): Either[String, Unit] =
    if (id == null) Left("unknown receipt phase identity")
    else (id.stepId, id.participantId, id.phase) match {
${m.saga.participants.map(p => `      case (${q(p.stepId)}, ${q(p.participantId)}, ${t.phase}.${title}) => handleLength(value, ${p.phases[phase].receiptHandle.minLength}, ${p.phases[phase].receiptHandle.maxLength})`).join('\n')}
      case _ => Left("unknown receipt phase identity")
    }
  val ${phase}: ${t.binaryCodec}[${t[phase + 'Receipt']}] = codec[${t[phase + 'Receipt']}](${codec(phase)})((o, v) => {
    validate${title}Handle(v.identity, v.reservationId).fold(e => throw new IllegalArgumentException(e), _ => ())
    phaseOut(o, v.identity); o.text(v.reservationId); o.text(v.proof)
  })(i => {
    val value = ${t[phase + 'Receipt']}(phaseIn(i), i.text(), i.text())
    validate${title}Handle(value.identity, value.reservationId).fold(e => throw new IllegalArgumentException(e), _ => ())
    value
  })
`, m.sources);
  }
  out.append(`  val result: ${t.binaryCodec}[${t.sagaResult}] = codec[${t.sagaResult}](${codec('result')})((o, v) => {
    o.int(v match {
${m.serialization.results.map(r => `      case _: ${t.sagaResult}.${r.name} => ${r.tag}`).join('\n')}
    })
    o.text(v.payload.${m.result.transactionField}.value); requestOut(o, v.payload.${m.result.requestField})
  })(i => {
    val tag = i.int(); val payload = ${resultPayload(m, tx + '(i.text())', 'requestIn(i)')}
    tag match {
${m.serialization.results.map(r => `      case ${r.tag} => ${t.sagaResult}.${r.name}(payload)`).join('\n')}
      case _ => throw new IllegalArgumentException("unknown result tag")
    }
  })
  val manifestResult: ${t.binaryCodec}[${t.manifestResult}] = codec[${t.manifestResult}](${codec('manifestResult')})((o, v) => {
    require(v.items.nonEmpty && v.items.size <= ${m.serialization.maxManifestItems}, "bounded manifest results")
    o.int(v.items.size)
    v.items.foreach { entry =>
      itemOut(o, entry.item)
      o.text(java.util.Base64.getEncoder.encodeToString(result.encode(entry.result).toArray))
      o.int(if (entry.delivery.isDefined) 1 else 0)
      entry.delivery.foreach { receipt =>
        o.text(receipt.key); sagaOut(o, receipt.identity)
        o.text(java.util.Base64.getEncoder.encodeToString(receipt.bytes.toArray)); o.text(receipt.proof)
      }
    }
  })(i => {
    val count = i.int(); require(count > 0 && count <= ${m.serialization.maxManifestItems}, "bounded manifest results")
    ${t.manifestResult}(Vector.fill(count) {
      val item = itemIn(i); val value = result.decode(java.util.Base64.getDecoder.decode(i.text()).toVector).get
      val receipt = i.int() match {
        case 0 => None
        case 1 => Some(${t.resultReceipt}(i.text(), sagaIn(i), java.util.Base64.getDecoder.decode(i.text()).toVector, i.text()))
        case _ => throw new IllegalArgumentException("invalid delivery option")
      }
      ${t.itemResult}(item, value, receipt)
    })
  })
  def digest(bytes: Vector[Byte]): String = MessageDigest.getInstance("SHA-256").digest(bytes.toArray)
    .map(b => f"\${b & 255}%02x").mkString
`, m.sources);
  if (m.runs.length) out.append(`  def identityDigest(fields: Vector[Vector[Byte]]): String = {
    require(fields != null && fields.size <= 16 && fields.forall(_ != null), "bounded identity fields required")
    require(fields.map(_.size.toLong + 4L).sum <= MaxBytes, "identity frame too large")
    val buffer = new ByteArrayOutputStream
    val frame = new DataOutputStream(buffer)
    val tag = "truthsrc-run-identity-v1".getBytes(StandardCharsets.UTF_8)
    frame.writeInt(tag.length); frame.write(tag)
    fields.foreach { bytes => frame.writeInt(bytes.size); frame.write(bytes.toArray) }
    frame.flush(); digest(buffer.toByteArray.toVector)
  }
`, m.sources);
  for (const run of m.runs) runCodecsTemplate(m, run, out);
  out.append('}\n', m.sources);
}
