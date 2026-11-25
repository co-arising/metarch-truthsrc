// Unified emitter family #31: serialization-adapter (curated PO adapters with
// oneof event unions + GeneratedMessage/GeneratedOneof DomainProtoSerializer).
// Zero hardcoded business identifiers; fail-closed (SA_INPUT).
import { scalaSubpackagePath } from '../../lib/layout/layout-strategy.mjs';

const SCHEMA = 'truthsrc.serialization-adapter-input/v1';
const CONTEXT_RE = /^[a-z][a-z0-9_-]*$/u;
const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/u;
const TYPE_NAME_RE = /^[A-Z][A-Za-z0-9_]*$/u;

const fail = message => { throw new Error('SA_INPUT: ' + message); };

function checkObject(value, what) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(what + ' must be an object');
  return value;
}

function checkNoExtraKeys(obj, allowed, what) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) fail(what + ' has unexpected key: ' + key);
  }
}

function checkSource(source, what) {
  checkObject(source, what);
  checkNoExtraKeys(source, new Set(['document', 'pointer']), what);
  if (typeof source.document !== 'string' || !source.document) fail(what + '.document invalid');
  if (typeof source.pointer !== 'string' || !source.pointer.startsWith('/')) fail(what + '.pointer invalid');
}

export function checkInput(input) {
  checkObject(input, 'input');
  checkNoExtraKeys(input, new Set(['schemaVersion', 'packages', 'serializers', 'adapters']), 'input');
  if (input.schemaVersion !== SCHEMA) fail('schemaVersion must be ' + SCHEMA);

  if (!Array.isArray(input.packages) || !input.packages.length) fail('packages must be non-empty');
  const packageByContext = new Map();
  for (let i = 0; i < input.packages.length; i++) {
    const p = checkObject(input.packages[i], 'packages[' + i + ']');
    checkNoExtraKeys(p, new Set(['context', 'package']), 'packages[' + i + ']');
    if (typeof p.context !== 'string' || !CONTEXT_RE.test(p.context)) fail('packages[' + i + '].context invalid');
    if (typeof p.package !== 'string' || !PACKAGE_RE.test(p.package)) fail('packages[' + i + '].package invalid');
    if (packageByContext.has(p.context)) fail('duplicate package context');
    packageByContext.set(p.context, p.package);
  }

  if (!Array.isArray(input.serializers) || !input.serializers.length) fail('serializers must be non-empty');
  const seenContexts = new Set();
  for (let i = 0; i < input.serializers.length; i++) {
    const s = checkObject(input.serializers[i], 'serializers[' + i + ']');
    checkNoExtraKeys(s, new Set(['context', 'identifier', 'protoPaths', 'entries']), 'serializers[' + i + ']');
    if (typeof s.context !== 'string' || !packageByContext.has(s.context)) fail('serializers[' + i + '].context unbound');
    if (seenContexts.has(s.context)) fail('duplicate serializer context');
    seenContexts.add(s.context);
    if (!Number.isInteger(s.identifier) || s.identifier < 1) fail('identifier must be positive integer');
    if (!Array.isArray(s.protoPaths) || !s.protoPaths.length || s.protoPaths.some(p => !p.endsWith('.proto')))
      {fail('protoPaths must be non-empty .proto paths');}
    if (!Array.isArray(s.entries) || !s.entries.length) fail('entries must be non-empty');
    const seenPo = new Set();
    for (let j = 0; j < s.entries.length; j++) {
      const e = checkObject(s.entries[j], 'entries[' + j + ']');
      checkNoExtraKeys(e, new Set(['poName', 'sources']), 'entries[' + j + ']');
      if (typeof e.poName !== 'string' || !TYPE_NAME_RE.test(e.poName)) fail('invalid poName');
      if (seenPo.has(e.poName)) fail('duplicate poName: ' + e.poName);
      seenPo.add(e.poName);
      if (!Array.isArray(e.sources) || !e.sources.length) fail('entry sources must be non-empty');
      for (const src of e.sources) checkSource(src, 'entry.source');
    }
  }

  if (!Array.isArray(input.adapters) || !input.adapters.length) fail('adapters must be non-empty');
  const seenAdapters = new Set();
  for (let i = 0; i < input.adapters.length; i++) {
    const a = checkObject(input.adapters[i], 'adapters[' + i + ']');
    checkNoExtraKeys(a, new Set(['context', 'aggregate', 'eventUnionPoName', 'statePoName', 'aggregateSource', 'events']), 'adapters[' + i + ']');
    if (typeof a.context !== 'string' || !packageByContext.has(a.context)) fail('adapter context unbound');
    if (typeof a.aggregate !== 'string' || !TYPE_NAME_RE.test(a.aggregate)) fail('invalid aggregate');
    if (typeof a.eventUnionPoName !== 'string' || !TYPE_NAME_RE.test(a.eventUnionPoName)) fail('invalid eventUnionPoName');
    if (typeof a.statePoName !== 'string' || !TYPE_NAME_RE.test(a.statePoName)) fail('invalid statePoName');
    const aKey = a.context + '/' + a.aggregate;
    if (seenAdapters.has(aKey)) fail('duplicate adapter');
    seenAdapters.add(aKey);
    checkSource(a.aggregateSource, 'adapter.aggregateSource');
    if (!Array.isArray(a.events) || !a.events.length) fail('adapter events must be non-empty');
    const seenEv = new Set();
    for (const ev of a.events) {
      checkObject(ev, 'adapter.event');
      checkNoExtraKeys(ev, new Set(['eventName', 'poName', 'source']), 'adapter.event');
      if (typeof ev.eventName !== 'string' || !TYPE_NAME_RE.test(ev.eventName)) fail('invalid eventName');
      if (typeof ev.poName !== 'string' || !TYPE_NAME_RE.test(ev.poName)) fail('invalid poName');
      if (seenEv.has(ev.eventName)) fail('duplicate adapter event');
      seenEv.add(ev.eventName);
      checkSource(ev.source, 'adapter.event.source');
    }
  }
}

function renderSerializerScala(pkg, serializer) {
  const rows = serializer.entries.map(e =>
    `    entry[pb.${e.poName}](${JSON.stringify(e.poName)}, pb.${e.poName}.parseFrom)`
  );
  return [
    `package ${pkg}.infrastructure.persistence`,
    '',
    'import akka.serialization.SerializerWithStringManifest',
    `import ${pkg}.infrastructure.{proto => pb}`,
    'import scala.reflect.ClassTag',
    'import scalapb.{GeneratedMessage, GeneratedOneof}',
    '',
    'final class DomainProtoSerializer extends SerializerWithStringManifest {',
    `  override def identifier: Int = ${serializer.identifier}`,
    '',
    '  private def entry[A <: GeneratedMessage](name: String, parse: Array[Byte] => AnyRef)(',
    '    implicit ct: ClassTag[A]',
    '  ): (Class[_], String, Array[Byte] => AnyRef) =',
    '    (ct.runtimeClass, name, parse)',
    '',
    '  private val registry: Vector[(Class[_], String, Array[Byte] => AnyRef)] = Vector(',
    rows.join(',\n'),
    '  )',
    '',
    '  private val manifestByClass: Map[Class[_], String] =',
    '    registry.iterator.map { case (cls, name, _) => cls -> name }.toMap',
    '',
    '  private val parserByManifest: Map[String, Array[Byte] => AnyRef] =',
    '    registry.iterator.map { case (_, name, parse) => name -> parse }.toMap',
    '',
    '  override def manifest(value: AnyRef): String = value match {',
    '    case oneof: GeneratedOneof => manifest(oneof.asInstanceOf[AnyRef])',
    '    case _ => manifestByClass.getOrElse(',
    '      value.getClass,',
    '      throw new IllegalArgumentException("unregistered protobuf value: " + value.getClass.getName)',
    '    )',
    '  }',
    '',
    '  override def toBinary(value: AnyRef): Array[Byte] = {',
    '    manifest(value)',
    '    value.asInstanceOf[GeneratedMessage].toByteArray',
    '  }',
    '',
    '  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef =',
    '    parserByManifest.getOrElse(',
    '      manifest,',
    '      throw new IllegalArgumentException("unknown protobuf manifest: " + manifest)',
    '    )(bytes)',
    '}',
    '',
  ].join('\n');
}

function renderEventAdapterScala(pkg, adapter) {
  const agg = adapter.aggregate;
  const unionPo = adapter.eventUnionPoName;
  return [
    `package ${pkg}.infrastructure.persistence`,
    '',
    'import akka.persistence.typed.{EventAdapter, EventSeq}',
    `import ${pkg}.domain.entities.${agg}Entity.Event`,
    `import ${pkg}.infrastructure.persistence.converters.${agg}ProtoConverters`,
    `import ${pkg}.infrastructure.{proto => pb}`,
    '',
    `class ${agg}EventAdapter extends EventAdapter[Event, pb.${unionPo}] with ${agg}ProtoConverters {`,
    `  override def manifest(event: Event): String = ${JSON.stringify(unionPo)}`,
    '',
    `  override def toJournal(event: Event): pb.${unionPo} =`,
    `    encode${unionPo}(event)`,
    '',
    `  override def fromJournal(envelope: pb.${unionPo}, manifest: String): EventSeq[Event] =`,
    `    EventSeq.single(decode${unionPo}(envelope))`,
    '}',
    '',
  ].join('\n');
}

function renderSnapshotAdapterScala(pkg, adapter) {
  const agg = adapter.aggregate;
  const statePo = adapter.statePoName;
  return [
    `package ${pkg}.infrastructure.persistence`,
    '',
    'import akka.persistence.typed.SnapshotAdapter',
    `import ${pkg}.domain.entities.${agg}Entity.State`,
    `import ${pkg}.infrastructure.persistence.converters.${agg}ProtoConverters`,
    `import ${pkg}.infrastructure.{proto => pb}`,
    '',
    `class ${agg}SnapshotAdapter extends SnapshotAdapter[State] with ${agg}ProtoConverters {`,
    `  override def toJournal(state: State): Any = encode${statePo}(state)`,
    '',
    '  override def fromJournal(value: Any): State = value match {',
    `    case state: pb.${statePo} => decode${statePo}(state)`,
    '    case _ => throw new IllegalArgumentException("snapshot type mismatch")',
    '  }',
    '}',
    '',
  ].join('\n');
}

export function renderSerializationAdapterFiles(input) {
  checkInput(input);
  const packageByContext = new Map(input.packages.map(p => [p.context, p.package]));
  const files = [];
  for (const ser of input.serializers) {
    const pkg = packageByContext.get(ser.context);
    files.push({
      path: scalaSubpackagePath(pkg, 'infrastructure.persistence', 'DomainProtoSerializer.scala'),
      content: renderSerializerScala(pkg, ser),
      kind: 'serialization-adapter',
      deps: [...ser.protoPaths],
      sources: ser.entries.flatMap(e => e.sources.map(s => ({ document: s.document, pointer: s.pointer }))),
      codeMappings: [],
    });
  }
  for (const adapter of input.adapters) {
    const pkg = packageByContext.get(adapter.context);
    const convDep = scalaSubpackagePath(pkg, 'infrastructure.persistence.converters', adapter.aggregate + 'ProtoConverters.scala');
    const aggSource = { document: adapter.aggregateSource.document, pointer: adapter.aggregateSource.pointer };
    files.push({
      path: scalaSubpackagePath(pkg, 'infrastructure.persistence', adapter.aggregate + 'EventAdapter.scala'),
      content: renderEventAdapterScala(pkg, adapter),
      kind: 'serialization-adapter',
      deps: [convDep],
      sources: [
        aggSource,
        ...adapter.events.map(ev => ({ document: ev.source.document, pointer: ev.source.pointer })),
      ],
      codeMappings: [],
    });
    files.push({
      path: scalaSubpackagePath(pkg, 'infrastructure.persistence', adapter.aggregate + 'SnapshotAdapter.scala'),
      content: renderSnapshotAdapterScala(pkg, adapter),
      kind: 'serialization-adapter',
      deps: [convDep],
      sources: [aggSource],
      codeMappings: [],
    });
  }
  return files;
}

export function renderAll(input) {
  return Object.fromEntries(renderSerializationAdapterFiles(input).map(f => [f.path, f.content]));
}

export function runNegatives(baseInput) {
  const clone = () => JSON.parse(JSON.stringify(baseInput));
  const cases = [
    ['non-object input', () => null],
    ['wrong schemaVersion', () => { const x = clone(); x.schemaVersion = 'wrong/v1'; return x; }],
    ['unexpected top-level key', () => { const x = clone(); x.extra = true; return x; }],
    ['empty packages', () => { const x = clone(); x.packages = []; return x; }],
    ['duplicate package context', () => { const x = clone(); x.packages.push({ ...x.packages[0] }); return x; }],
    ['empty serializers', () => { const x = clone(); x.serializers = []; return x; }],
    ['unbound serializer context', () => { const x = clone(); x.serializers[0].context = 'unknown'; return x; }],
    ['non-positive identifier', () => { const x = clone(); x.serializers[0].identifier = 0; return x; }],
    ['empty protoPaths', () => { const x = clone(); x.serializers[0].protoPaths = []; return x; }],
    ['empty serializer entries', () => { const x = clone(); x.serializers[0].entries = []; return x; }],
    ['duplicate poName', () => { const x = clone(); x.serializers[0].entries.push(clone().serializers[0].entries[0]); return x; }],
    ['empty adapters', () => { const x = clone(); x.adapters = []; return x; }],
    ['unbound adapter context', () => { const x = clone(); x.adapters[0].context = 'unknown'; return x; }],
    ['invalid aggregate name', () => { const x = clone(); x.adapters[0].aggregate = 'lower'; return x; }],
    ['empty adapter events', () => { const x = clone(); x.adapters[0].events = []; return x; }],
    ['duplicate adapter event', () => { const x = clone(); x.adapters[0].events.push(clone().adapters[0].events[0]); return x; }],
  ];
  let rejected = 0;
  const failures = [];
  for (const [label, build] of cases) {
    try {
      checkInput(build());
      failures.push(label + ': unexpectedly accepted');
    } catch (err) {
      if (!String(err.message || '').startsWith('SA_INPUT:')) {
        failures.push(label + ': wrong error prefix (' + err.message + ')');
      } else {
        rejected++;
      }
    }
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'serialization-adapter',
  familyNumber: 31,
  inputSchema: SCHEMA,
  provenance: 'handwritten-golden',
  toolsRef: null,
  goldenRoot: 'test/reference/curated/serialization-adapter/v1',
  fixtureDir: 'test/fixtures/serialization-adapter-v1',
  checkInput,
  renderAll,
  runNegatives,
});
