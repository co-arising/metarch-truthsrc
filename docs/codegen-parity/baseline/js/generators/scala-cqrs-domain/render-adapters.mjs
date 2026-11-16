import { entry, packageFor, pathFor, symbol } from './naming.mjs';
import { serializationModel } from './serialization.mjs';

export function renderAdapters({ products, options }, footprint) {
  const nodes = serializationModel(products, options), entries = [];
  for (const context of products['reference-layout'].contexts) {
    const pkg = packageFor(context, options), local = nodes.filter(n => n.pkg === pkg), pb = pkg + '.infrastructure.proto.';
    let serializer = 'package ' + pkg + '.infrastructure.serialization\n\nimport akka.serialization.SerializerWithStringManifest\nimport scalapb.GeneratedMessage\n\nfinal class DomainProtoSerializer extends SerializerWithStringManifest {\n' +
      '  override def identifier: Int = ' + (741000 + products['reference-layout'].contexts.indexOf(context)) + '\n' +
      '  override def manifest(value: AnyRef): String = value match {\n' + local.map(n => '    case _: ' + pb + n.name + ' => ' + JSON.stringify(n.name) + '\n').join('') +
      '    case _ => throw new IllegalArgumentException("unregistered protobuf value")\n  }\n' +
      '  override def toBinary(value: AnyRef): Array[Byte] = { manifest(value); value.asInstanceOf[GeneratedMessage].toByteArray }\n' +
      '  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = manifest match {\n' + local.map(n => '    case ' + JSON.stringify(n.name) + ' => ' + pb + n.name + '.parseFrom(bytes)\n').join('') +
      '    case _ => throw new IllegalArgumentException("unknown protobuf manifest")\n  }\n}\n';
    const serializerPath = pathFor(pkg, 'infrastructure/serialization/DomainProtoSerializer.scala');
    const legacy = entry(serializerPath, serializer, 'serialization-adapter', local.flatMap(n => n.sources), footprint);
    // Keep every already-bounded legacy entry byte-identical, including its generated header.
    if (legacy.content.length <= 65536) entries.push(legacy);
    else {
      const partName = i => symbol('DomainProtoSerializerPart' + i);
      const partPath = i => pathFor(pkg, 'infrastructure/serialization/' + partName(i) + '.scala');
      const protoPath = 'app/protobuf/' + pkg.replaceAll('.', '_') + '_domain.proto';
      const partEntry = (part, i, hasNext) => {
        const next = i + 1;
        const text = 'package ' + pkg + '.infrastructure.serialization\n\ntrait ' + partName(i) +
          (hasNext ? ' extends ' + partName(next) : '') + ' {\n' +
          '  protected def manifestPart' + i + '(value: AnyRef): String = value match {\n' +
          part.map(n => '    case _: ' + pb + n.name + ' => ' + JSON.stringify(n.name) + '\n').join('') +
          '    case _ => ' + (hasNext ? 'manifestPart' + next + '(value)' : 'throw new IllegalArgumentException("unregistered protobuf value")') + '\n  }\n' +
          '  protected def fromBinaryPart' + i + '(bytes: Array[Byte], manifest: String): AnyRef = manifest match {\n' +
          part.map(n => '    case ' + JSON.stringify(n.name) + ' => ' + pb + n.name + '.parseFrom(bytes)\n').join('') +
          '    case _ => ' + (hasNext ? 'fromBinaryPart' + next + '(bytes, manifest)' : 'throw new IllegalArgumentException("unknown protobuf manifest")') + '\n  }\n}\n';
        return entry(partPath(i), text, 'serialization-adapter', part.flatMap(n => n.sources), footprint,
          [protoPath, ...(hasNext ? [partPath(next)] : [])]);
      };
      // Bound both JVM match methods and complete entries; long manifests/package names count too.
      const fits = (part, i) => part.length <= 128 &&
        Math.max(partEntry(part, i, true).content.length, partEntry(part, i, false).content.length) <= 60000;
      const parts = [];
      for (const node of local) {
        const i = Math.max(0, parts.length - 1), candidate = [...(parts[i] ?? []), node];
        if (fits(candidate, i)) {
          if (!parts.length) parts.push(candidate);
          else parts[i] = candidate;
        } else {
          if (!fits([node], parts.length)) throw new TypeError('protobuf serializer case exceeds bounded source entry');
          parts.push([node]);
        }
      }
      const facade = 'package ' + pkg + '.infrastructure.serialization\n\nimport akka.serialization.SerializerWithStringManifest\nimport scalapb.GeneratedMessage\n\nfinal class DomainProtoSerializer extends SerializerWithStringManifest with ' + partName(0) + ' {\n' +
        '  override def identifier: Int = ' + (741000 + products['reference-layout'].contexts.indexOf(context)) + '\n' +
        '  override def manifest(value: AnyRef): String = manifestPart0(value)\n' +
        '  override def toBinary(value: AnyRef): Array[Byte] = { manifest(value); value.asInstanceOf[GeneratedMessage].toByteArray }\n' +
        '  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = fromBinaryPart0(bytes, manifest)\n}\n';
      const facadeEntry = entry(serializerPath, facade, 'serialization-adapter', local.flatMap(n => n.sources), footprint, [partPath(0)]);
      if (facadeEntry.content.length > 60000) throw new TypeError('protobuf serializer facade exceeds bounded source entry');
      entries.push(facadeEntry, ...parts.map((part, i) => partEntry(part, i, i + 1 < parts.length)));
    }
    for (const a of products['reference-layout'].declarations.filter(d => d.ref.kind === 'aggregate' && d.ref.context === context)) {
      const name = symbol(a.ref.id), events = products['domain-dependencies'].events.filter(e => e.event.context === context && e.event.owner[0] === a.ref.id);
      let adapter = 'package ' + pkg + '.infrastructure.serialization\n\nimport akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}\nimport ' + pkg + '.domain._\nimport ' + pkg + '.domain.' + name + 'Protocol._\n\nobject ' + name + 'EventAdapter extends EventAdapter[Event, scalapb.GeneratedMessage] {\n' +
        '  override def manifest(event: Event): String = event match {\n' + events.map(e => '    case _: ' + symbol(e.event.id) + ' => ' + JSON.stringify(a.ref.id + e.event.id + 'PB') + '\n').join('') + '  }\n' +
        '  override def toJournal(event: Event): scalapb.GeneratedMessage = event match {\n' + events.map(e => '    case value: ' + symbol(e.event.id) + ' => DomainConverters.encode' + a.ref.id + e.event.id + 'PB(value)\n').join('') + '  }\n' +
        '  override def fromJournal(event: scalapb.GeneratedMessage, manifest: String): EventSeq[Event] = (event, manifest) match {\n' +
        events.map(e => '    case (value: ' + pb + a.ref.id + e.event.id + 'PB, ' + JSON.stringify(a.ref.id + e.event.id + 'PB') + ') => EventSeq.single(DomainConverters.decode' + a.ref.id + e.event.id + 'PB(value))\n').join('') +
        '    case _ => throw new IllegalArgumentException("event manifest and payload mismatch")\n  }\n}\nobject ' + name + 'SnapshotAdapter extends SnapshotAdapter[' + name + 'State] {\n' +
        '  override def toJournal(state: ' + name + 'State): Any = DomainConverters.encode' + a.ref.id + 'StatePB(state)\n' +
        '  override def fromJournal(value: Any): ' + name + 'State = value match {\n    case state: ' + pb + a.ref.id + 'StatePB => DomainConverters.decode' + a.ref.id + 'StatePB(state)\n' +
        '    case _ => throw new IllegalArgumentException("snapshot type mismatch")\n  }\n}\n';
      entries.push(entry(pathFor(pkg, 'infrastructure/serialization/' + a.ref.id + 'Adapters.scala'), adapter, 'serialization-adapter', [a.source, ...events.map(e => e.source)], footprint));
    }
  }
  return entries;
}
