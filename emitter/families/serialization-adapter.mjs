// Unified emitter family #31: serialization-adapter (Wave 1A curated adapters).
// Emits headerless, data-driven DomainProtoSerializer (CC=1 via ClassTag
// registry, eliminating DomainProtoSerializerPart0..N chains) and per-aggregate
// EventAdapter/SnapshotAdapter objects (CC=1 via ClassTag registry).
// Zero hardcoded business identifiers; fail-closed (SA_INPUT).
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
  if (typeof source.document !== 'string' || !source.document) fail(what + '.document must be a non-empty string');
  if (typeof source.pointer !== 'string' || !source.pointer.startsWith('/')) fail(what + '.pointer must be a JSON pointer starting with /');
}

export function checkInput(input) {
  checkObject(input, 'input');
  checkNoExtraKeys(input, new Set(['schemaVersion', 'packages', 'serializers', 'adapters']), 'input');
  if (input.schemaVersion !== SCHEMA) fail('schemaVersion must be ' + SCHEMA);

  if (!Array.isArray(input.packages) || !input.packages.length) fail('packages must be a non-empty array');
  const packageByContext = new Map();
  for (let i = 0; i < input.packages.length; i++) {
    const p = checkObject(input.packages[i], 'packages[' + i + ']');
    checkNoExtraKeys(p, new Set(['context', 'package']), 'packages[' + i + ']');
    if (typeof p.context !== 'string' || !CONTEXT_RE.test(p.context)) fail('packages[' + i + '].context invalid');
    if (typeof p.package !== 'string' || !PACKAGE_RE.test(p.package)) fail('packages[' + i + '].package invalid');
    if (packageByContext.has(p.context)) fail('duplicate package context: ' + p.context);
    packageByContext.set(p.context, p.package);
  }

  if (!Array.isArray(input.serializers) || !input.serializers.length) fail('serializers must be a non-empty array');
  const seenContexts = new Set();
  for (let i = 0; i < input.serializers.length; i++) {
    const s = checkObject(input.serializers[i], 'serializers[' + i + ']');
    checkNoExtraKeys(s, new Set(['context', 'identifier', 'protoPath', 'entries']), 'serializers[' + i + ']');
    if (typeof s.context !== 'string' || !packageByContext.has(s.context)) fail('serializers[' + i + '].context unbound');
    if (seenContexts.has(s.context)) fail('duplicate serializer context: ' + s.context);
    seenContexts.add(s.context);
    if (!Number.isInteger(s.identifier) || s.identifier < 1) fail('serializers[' + i + '].identifier must be a positive integer');
    if (typeof s.protoPath !== 'string' || !s.protoPath.startsWith('app/protobuf/') || !s.protoPath.endsWith('.proto'))
      fail('serializers[' + i + '].protoPath invalid');
    if (!Array.isArray(s.entries) || !s.entries.length) fail('serializers[' + i + '].entries must be non-empty');
    const seenPb = new Set();
    for (let j = 0; j < s.entries.length; j++) {
      const e = checkObject(s.entries[j], 'serializers[' + i + '].entries[' + j + ']');
      checkNoExtraKeys(e, new Set(['pbName', 'sources']), 'serializers[' + i + '].entries[' + j + ']');
      if (typeof e.pbName !== 'string' || !TYPE_NAME_RE.test(e.pbName)) fail('invalid pbName: ' + JSON.stringify(e.pbName));
      if (seenPb.has(e.pbName)) fail('duplicate pbName: ' + e.pbName);
      seenPb.add(e.pbName);
      if (!Array.isArray(e.sources) || !e.sources.length) fail('entry sources must be non-empty');
      for (let k = 0; k < e.sources.length; k++) checkSource(e.sources[k], 'serializers[' + i + '].entries[' + j + '].sources[' + k + ']');
    }
  }

  if (!Array.isArray(input.adapters) || !input.adapters.length) fail('adapters must be a non-empty array');
  const seenAdapters = new Set();
  for (let i = 0; i < input.adapters.length; i++) {
    const a = checkObject(input.adapters[i], 'adapters[' + i + ']');
    checkNoExtraKeys(a, new Set(['context', 'aggregate', 'aggregateSource', 'events']), 'adapters[' + i + ']');
    if (typeof a.context !== 'string' || !packageByContext.has(a.context)) fail('adapters[' + i + '].context unbound');
    if (typeof a.aggregate !== 'string' || !TYPE_NAME_RE.test(a.aggregate)) fail('adapters[' + i + '].aggregate invalid');
    const aKey = a.context + '/' + a.aggregate;
    if (seenAdapters.has(aKey)) fail('duplicate adapter: ' + aKey);
    seenAdapters.add(aKey);
    checkSource(a.aggregateSource, 'adapters[' + i + '].aggregateSource');
    if (!Array.isArray(a.events) || !a.events.length) fail('adapters[' + i + '].events must be non-empty');
    const seenEv = new Set();
    for (let j = 0; j < a.events.length; j++) {
      const ev = checkObject(a.events[j], 'adapters[' + i + '].events[' + j + ']');
      checkNoExtraKeys(ev, new Set(['eventName', 'pbName', 'source']), 'adapters[' + i + '].events[' + j + ']');
      if (typeof ev.eventName !== 'string' || !TYPE_NAME_RE.test(ev.eventName)) fail('invalid eventName');
      if (typeof ev.pbName !== 'string' || !TYPE_NAME_RE.test(ev.pbName)) fail('invalid pbName');
      if (seenEv.has(ev.eventName)) fail('duplicate event in adapter ' + aKey + ': ' + ev.eventName);
      seenEv.add(ev.eventName);
      checkSource(ev.source, 'adapters[' + i + '].events[' + j + '].source');
    }
  }
}

function renderSerializerScala(pkg, serializer) {
  const rows = serializer.entries.map(e =>
    `    entry[${e.pbName}](${JSON.stringify(e.pbName)}, ${e.pbName}.parseFrom)`
  );
  return [
    `package ${pkg}.infrastructure.serialization`,
    '',
    'import akka.serialization.SerializerWithStringManifest',
    `import ${pkg}.infrastructure.proto._`,
    'import scala.reflect.ClassTag',
    'import scalapb.GeneratedMessage',
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
    '  override def manifest(value: AnyRef): String =',
    '    manifestByClass.getOrElse(',
    '      value.getClass,',
    '      throw new IllegalArgumentException("unregistered protobuf value")',
    '    )',
    '',
    '  override def toBinary(value: AnyRef): Array[Byte] = {',
    '    manifest(value)',
    '    value.asInstanceOf[GeneratedMessage].toByteArray',
    '  }',
    '',
    '  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef =',
    '    parserByManifest.getOrElse(',
    '      manifest,',
    '      throw new IllegalArgumentException("unknown protobuf manifest")',
    '    )(bytes)',
    '}',
    '',
  ].join('\n');
}

function renderAggregateAdaptersScala(pkg, adapter) {
  const agg = adapter.aggregate;
  const rows = adapter.events.map(ev =>
    `    entry[${ev.eventName}, ${ev.pbName}](${JSON.stringify(ev.pbName)}, DomainConverters.encode${ev.pbName}, DomainConverters.decode${ev.pbName})`
  );
  return [
    `package ${pkg}.infrastructure.serialization`,
    '',
    'import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}',
    `import ${pkg}.domain._`,
    `import ${pkg}.domain.${agg}Protocol._`,
    `import ${pkg}.infrastructure.proto._`,
    'import scala.reflect.ClassTag',
    'import scalapb.GeneratedMessage',
    '',
    `object ${agg}EventAdapter extends EventAdapter[Event, GeneratedMessage] {`,
    '  private final case class CodecEntry(',
    '    eventClass: Class[_],',
    '    manifest: String,',
    '    encode: Event => GeneratedMessage,',
    '    decode: GeneratedMessage => Event',
    '  )',
    '',
    '  private def entry[E <: Event, P <: GeneratedMessage](',
    '    name: String,',
    '    encode: E => P,',
    '    decode: P => E',
    '  )(implicit ec: ClassTag[E], pc: ClassTag[P]): CodecEntry =',
    '    CodecEntry(',
    '      ec.runtimeClass,',
    '      name,',
    '      e => encode(e.asInstanceOf[E]),',
    '      p => {',
    '        require(pc.runtimeClass.isInstance(p), "event manifest and payload mismatch")',
    '        decode(p.asInstanceOf[P])',
    '      }',
    '    )',
    '',
    '  private val registry: Vector[CodecEntry] = Vector(',
    rows.join(',\n'),
    '  )',
    '',
    '  private val byClass: Map[Class[_], CodecEntry] =',
    '    registry.iterator.map(e => e.eventClass -> e).toMap',
    '',
    '  private val byManifest: Map[String, CodecEntry] =',
    '    registry.iterator.map(e => e.manifest -> e).toMap',
    '',
    '  override def manifest(event: Event): String =',
    '    byClass.getOrElse(event.getClass, throw new IllegalArgumentException("unregistered event")).manifest',
    '',
    '  override def toJournal(event: Event): GeneratedMessage =',
    '    byClass.getOrElse(event.getClass, throw new IllegalArgumentException("unregistered event")).encode(event)',
    '',
    '  override def fromJournal(event: GeneratedMessage, manifest: String): EventSeq[Event] =',
    '    byManifest.get(manifest) match {',
    '      case Some(codec) => EventSeq.single(codec.decode(event))',
    '      case None => throw new IllegalArgumentException("event manifest and payload mismatch")',
    '    }',
    '}',
    '',
    `object ${agg}SnapshotAdapter extends SnapshotAdapter[${agg}State] {`,
    `  override def toJournal(state: ${agg}State): Any = DomainConverters.encode${agg}StatePB(state)`,
    `  override def fromJournal(value: Any): ${agg}State = value match {`,
    `    case state: ${agg}StatePB => DomainConverters.decode${agg}StatePB(state)`,
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
    const pkgRoot = pkg.replaceAll('.', '/');
    files.push({
      path: 'app/' + pkgRoot + '/infrastructure/serialization/DomainProtoSerializer.scala',
      content: renderSerializerScala(pkg, ser),
      kind: 'serialization-adapter',
      deps: [ser.protoPath],
      sources: ser.entries.flatMap(e => e.sources.map(s => ({ document: s.document, pointer: s.pointer }))),
      codeMappings: [],
    });
  }
  for (const adapter of input.adapters) {
    const pkg = packageByContext.get(adapter.context);
    const pkgRoot = pkg.replaceAll('.', '/');
    files.push({
      path: 'app/' + pkgRoot + '/infrastructure/serialization/' + adapter.aggregate + 'Adapters.scala',
      content: renderAggregateAdaptersScala(pkg, adapter),
      kind: 'serialization-adapter',
      deps: [],
      sources: [
        { document: adapter.aggregateSource.document, pointer: adapter.aggregateSource.pointer },
        ...adapter.events.map(ev => ({ document: ev.source.document, pointer: ev.source.pointer })),
      ],
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
    ['invalid protoPath', () => { const x = clone(); x.serializers[0].protoPath = 'bad.scala'; return x; }],
    ['empty serializer entries', () => { const x = clone(); x.serializers[0].entries = []; return x; }],
    ['duplicate pbName', () => { const x = clone(); x.serializers[0].entries.push(clone().serializers[0].entries[0]); return x; }],
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
