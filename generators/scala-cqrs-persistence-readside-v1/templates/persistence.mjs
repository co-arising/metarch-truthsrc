const q = JSON.stringify;

export function frameTemplate(m, out) {
  out.append(`syntax = "proto3";
package ${m.names.frame.package};
import "scalapb/scalapb.proto";
option (scalapb.options) = { flat_package: true single_file: true };
message ${m.names.frame.name} {
  uint32 envelope_version = 1;
  string role = 2;
  string type_id = 3;
  uint32 wire_version = 4;
  string layout_sha256 = 5;
  bytes payload = 6;
}
`, [m.product.wire.source]);
}

export function persistenceTemplate(m, out) {
  const n = m.names, p = m.product, event = m.aggregate.base.protocol.fqn + '.Event', state = m.aggregate.base.state.fqn;
  out.append(`package ${n.persistence.package}

import com.google.protobuf.ByteString
import scala.util.control.NonFatal

final case class ${n.registration.identifier}(role: String, typeId: String, version: Int, layoutSha256: String) {
  require(role != null && typeId != null && layoutSha256 != null, "wire registration values required")
}

object ${n.persistence.identifier} {
  val serializerId: Int = ${p.wire.serializerId}
  val envelopeVersion: Int = ${p.wire.envelopeVersion}
  val maxPayloadBytes: Int = ${p.store.maxPayloadBytes}
  val registrations: Vector[${n.registration.identifier}] = Vector(
`, [p.wire.source]);
  m.registrations.forEach((r, i) => out.append(`    ${n.registration.identifier}(${q(r.role)}, ${q(r.typeId)}, ${r.version}, ${q(r.layoutSha256)})${i + 1 < m.registrations.length ? ',' : ''}
`, r.sources));
  out.append(`  )
  private def registration(frame: ${n.frame.fqn}): ${n.registration.identifier} = {
    require(frame != null, "frame required")
    registrations.find(r => r.role == frame.role && r.typeId == frame.typeId && r.version == frame.wireVersion)
      .getOrElse(throw new IllegalArgumentException("unknown persistence role/type/version"))
  }
  def validate(frame: ${n.frame.fqn}): Unit = {
    require(frame != null && frame.envelopeVersion == envelopeVersion, "unknown envelope version")
    require(frame.unknownFields == scalapb.UnknownFieldSet.empty, "unknown technical frame fields")
    require(frame.payload != null && !frame.payload.isEmpty && frame.payload.size() <= maxPayloadBytes,
      "empty or oversized frame payload")
    require(frame.serializedSize <= maxPayloadBytes, "oversized serialized frame")
    val row = registration(frame)
    require(frame.layoutSha256 == row.layoutSha256, "incompatible wire layout")
  }
  def manifest(frame: ${n.frame.fqn}): String = {
    validate(frame)
    ${q(m.manifestPrefix + '/')} + frame.role + "/" + frame.typeId + "/" + frame.wireVersion + "/" + frame.layoutSha256
  }
  private def decoded[A](body: => A): A = try body catch {
    case error: IllegalArgumentException => throw error
    case NonFatal(error) => throw new IllegalArgumentException("invalid persistence payload", error)
  }
  def parse(bytes: Array[Byte], expectedManifest: String): ${n.frame.fqn} = decoded {
    require(bytes != null && bytes.nonEmpty && bytes.length <= maxPayloadBytes && expectedManifest != null, "bounded frame bytes and manifest required")
    val frame = ${n.frame.fqn}.parseFrom(bytes)
    require(manifest(frame) == expectedManifest, "persistence manifest mismatch")
    frame
  }
  private def frame(row: ${n.registration.identifier}, bytes: Array[Byte]): ${n.frame.fqn} = {
    val value = ${n.frame.fqn}(envelopeVersion = envelopeVersion, role = row.role, typeId = row.typeId,
      wireVersion = row.version, layoutSha256 = row.layoutSha256, payload = ByteString.copyFrom(bytes))
    validate(value)
    value
  }
  def encodeEvent(event: ${event}): ${n.frame.fqn} = {
    require(event != null, "event required")
    event match {
`, m.registrations.flatMap(r => r.sources));
  m.registrations.forEach((r, i) => { if (r.role === 'event') out.append(`      case value: ${r.domainType} => frame(registrations(${i}), ${m.converter.fqn}.${r.encode}(value).toByteArray)
`, r.sources); });
  out.append(`    }
  }
  def decodeEvent(frame: ${n.frame.fqn}): ${event} = decoded {
    validate(frame)
    require(frame.role == "event", "event frame required")
    frame.typeId match {
`, [p.wire.source]);
  for (const r of m.registrations.filter(r => r.role === 'event')) out.append(`      case ${q(r.typeId)} => ${m.converter.fqn}.${r.decode}(${r.protobufType}.parseFrom(frame.payload.toByteArray))
`, r.sources);
  const stateIndex = m.registrations.findIndex(r => r.role === 'state'), sr = m.registrations[stateIndex];
  out.append(`      case _ => throw new IllegalArgumentException("unregistered event")
    }
  }
  def encodeState(state: ${state}): ${n.frame.fqn} = {
    require(state != null, "state required")
    frame(registrations(${stateIndex}), ${m.converter.fqn}.${sr.encode}(state).toByteArray)
  }
  def decodeState(frame: ${n.frame.fqn}): ${state} = decoded {
    validate(frame)
    require(frame.role == "state", "state frame required")
    ${m.converter.fqn}.${sr.decode}(${sr.protobufType}.parseFrom(frame.payload.toByteArray))
  }
}
`, sr.sources);
}

export function adapterTemplate(m, key, out) {
  const n = m.names, a = m.aggregate, event = a.base.protocol.fqn + '.Event', state = a.base.state.fqn;
  out.append(`package ${n[key].package}

`, m.registrations.flatMap(r => r.sources));
  if (key === 'eventAdapter') out.append(`final class ${n.eventAdapter.identifier} extends akka.persistence.typed.EventAdapter[${event}, ${n.frame.fqn}] {
  override def toJournal(event: ${event}): ${n.frame.fqn} = ${n.persistence.identifier}.encodeEvent(event)
  override def manifest(event: ${event}): String = ${n.persistence.identifier}.manifest(toJournal(event))
  override def fromJournal(frame: ${n.frame.fqn}, manifest: String): akka.persistence.typed.EventSeq[${event}] = {
    require(manifest != null && ${n.persistence.identifier}.manifest(frame) == manifest, "event manifest mismatch")
    akka.persistence.typed.EventSeq.single(${n.persistence.identifier}.decodeEvent(frame))
  }
}
`, m.registrations.filter(r => r.role === 'event').flatMap(r => r.sources));
  if (key === 'snapshotAdapter') out.append(`final class ${n.snapshotAdapter.identifier} extends akka.persistence.typed.SnapshotAdapter[${state}] {
  override def toJournal(state: ${state}): Any = ${n.persistence.identifier}.encodeState(state)
  override def fromJournal(value: Any): ${state} = value match {
    case frame: ${n.frame.fqn} => ${n.persistence.identifier}.decodeState(frame)
    case _ => throw new IllegalArgumentException("registered snapshot frame required")
  }
}
`, m.registrations.filter(r => r.role === 'state').flatMap(r => r.sources));
  if (key === 'serializer') out.append(`final class ${n.serializer.identifier}(system: akka.actor.ExtendedActorSystem)
    extends akka.serialization.SerializerWithStringManifest {
  require(system != null, "actor system required")
  override def identifier: Int = ${n.persistence.identifier}.serializerId
  override def manifest(value: AnyRef): String = value match {
    case frame: ${n.frame.fqn} => ${n.persistence.identifier}.manifest(frame)
    case _ => throw new IllegalArgumentException("registered persistence frame required")
  }
  override def toBinary(value: AnyRef): Array[Byte] = value match {
    case frame: ${n.frame.fqn} =>
      ${n.persistence.identifier}.validate(frame)
      if (frame.role == "event") ${n.persistence.identifier}.decodeEvent(frame) else ${n.persistence.identifier}.decodeState(frame)
      frame.toByteArray
    case _ => throw new IllegalArgumentException("registered persistence frame required")
  }
  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {
    val frame = ${n.persistence.identifier}.parse(bytes, manifest)
    if (frame.role == "event") ${n.persistence.identifier}.decodeEvent(frame) else ${n.persistence.identifier}.decodeState(frame)
    frame
  }
}
`, m.registrations.flatMap(r => r.sources));
  if (key === 'factory') out.append(`object ${n.factory.identifier} {
  def create(persistenceId: akka.persistence.typed.PersistenceId, initial: ${state}, hosts: ${a.base.computations.fqn}):
      akka.actor.typed.Behavior[${a.actorProtocol.fqn}.Command] = {
    require(persistenceId != null && initial != null && hosts != null, "persistence factory arguments required")
    ${a.bootstrap.fqn}.create[${n.frame.fqn}](persistenceId, initial, hosts,
      new ${n.eventAdapter.identifier}, new ${n.snapshotAdapter.identifier})
  }
}
`, [m.product.source, a.source]);
}

export function configTemplate(m, out) {
  out.append(`akka.actor.serializers {
  ${q(m.product.id)} = ${q(m.names.serializer.fqn)}
}
akka.actor.serialization-bindings {
  ${q(m.names.frame.fqn)} = ${q(m.product.id)}
}
`, [m.product.wire.source, ...m.registrations.map(r => r.source)]);
}
