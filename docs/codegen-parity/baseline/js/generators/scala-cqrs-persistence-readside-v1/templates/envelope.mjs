export function carrierType(carrier) { return carrier.chain[0]?.fqn ?? 'String'; }
export function carrierRead(carrier, value) { return carrier.chain.reduceRight((s, c) => c.fqn + '(' + s + ')', value); }
export function carrierWrite(carrier, value) { return value + carrier.chain.map(c => '.' + c.accessor).join(''); }

export function envelopeTemplate(m, out) {
  const n = m.names, state = m.aggregate.base.state.fqn;
  out.append(`package ${n.envelope.package}

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import ${n.persistence.fqn}

final class ${n.envelope.identifier} private (val pid: String, val resource: String, val sequenceNr: Long,
    val manifest: String, private val captured: Array[Byte]) {
  def bytes: Array[Byte] = captured.clone()
}
object ${n.envelope.identifier} {
  private def bounded(value: String, maxBytes: Int): Unit = {
    require(value != null && value.nonEmpty, "opaque identity required")
    var i = 0
    while (i < value.length) {
      val c = value.charAt(i)
      require(!Character.isISOControl(c), "identity contains controls")
      if (Character.isHighSurrogate(c)) {
        require(i + 1 < value.length && Character.isLowSurrogate(value.charAt(i + 1)), "ill-formed identity")
        i += 1
      } else require(!Character.isLowSurrogate(c), "ill-formed identity")
      i += 1
    }
    require(value.getBytes(StandardCharsets.UTF_8).length <= maxBytes, "identity exceeds UTF-8 bound")
  }
  def identity(value: String): Unit = bounded(value, 256)
  def hash(pid: String): String = {
    identity(pid)
    MessageDigest.getInstance("SHA-256").digest(pid.getBytes(StandardCharsets.UTF_8)).map(b => f"\${b & 0xff}%02x").mkString
  }
  def capture(pid: String, resource: String, sequenceNr: Long, manifest: String, bytes: Array[Byte]): ${n.envelope.identifier} = {
    identity(pid); identity(resource)
    require(sequenceNr > 0L && bytes != null && bytes.nonEmpty && bytes.length <= ${m.product.store.maxPayloadBytes}, "positive sequence and bounded bytes required")
    bounded(manifest, 1024)
    val fixed = bytes.clone()
    new ${n.envelope.identifier}(pid, resource, sequenceNr, manifest, fixed)
  }
}
final case class ${n.cursor.identifier}(mapKey: String, pidKey: String) {
  require(mapKey != null && mapKey.length <= ${m.index.keySize} && pidKey != null && pidKey.matches("[a-f0-9]{64}"), "bounded full index cursor required")
}
final case class ${n.row.identifier}(pidKey: String, pid: String, resource: String,
    ${m.index.keyMember}: ${carrierType(m.index.keyCarrier)}, ${m.index.valueMember}: ${carrierType(m.index.valueCarrier)}) {
  require(pidKey != null && ${m.index.keyMember} != null && ${m.index.valueMember} != null, "row values required")
  ${n.envelope.identifier}.identity(pid); ${n.envelope.identifier}.identity(resource)
  require(pidKey == ${n.envelope.identifier}.hash(pid), "row PID digest mismatch")
}
final case class ${n.page.identifier}(rows: Vector[${n.row.identifier}], next: Option[${n.cursor.identifier}]) {
  require(rows != null && next != null && rows.forall(_ != null) && next.forall(_ != null), "page values required")
}
final case class ${n.storedState.identifier}(resource: String, sequenceNr: Long, state: ${state}) {
  ${n.envelope.identifier}.identity(resource)
  require(sequenceNr > 0L && state != null, "stored state required")
}
final case class ${n.projectResult.identifier}(sequenceNr: Long, duplicate: Boolean)
final case class ${n.catchUpResult.identifier}(pid: String, lastSequenceNr: Long, observedFrontier: Long) {
  ${n.envelope.identifier}.identity(pid)
}
final case class ${n.shutdownResult.identifier}(drained: Boolean, accepted: Long, completed: Long,
    failure: Option[Throwable], timedOut: Boolean) {
  require(failure != null && failure.forall(_ != null), "failure option required")
}
`, [m.product.store.bindingSource, m.index.source, m.index.fieldSource, ...m.registrations.map(r => r.source)]);
}
