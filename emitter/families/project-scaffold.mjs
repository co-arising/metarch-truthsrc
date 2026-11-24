// Unified emitter family #39: project-scaffold (Wave 1B curated build,
// serialization.conf with 2-parent-class protobuf bindings, and test suites).
// Eliminates the 277-line per-class PB binding list in conf/serialization.conf
// using "com.google.protobuf.Message" = proto and "scalapb.GeneratedMessage" =
// domainProto0. Zero hardcoded business identifiers; fail-closed (PSC_INPUT).
const SCHEMA = 'truthsrc.project-scaffold-input/v1';
const KINDS = new Set(['build', 'service-test', 'generated-test']);

const fail = message => { throw new Error('PSC_INPUT: ' + message); };

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
  checkNoExtraKeys(input, new Set(['schemaVersion', 'serialization', 'files']), 'input');
  if (input.schemaVersion !== SCHEMA) fail('schemaVersion must be ' + SCHEMA);

  const ser = checkObject(input.serialization, 'serialization');
  checkNoExtraKeys(ser, new Set(['domainSerializers', 'hosts', 'effects', 'sources']), 'serialization');
  if (!Array.isArray(ser.domainSerializers) || !ser.domainSerializers.length) fail('domainSerializers must be non-empty');
  for (let i = 0; i < ser.domainSerializers.length; i++) {
    const d = checkObject(ser.domainSerializers[i], 'domainSerializers[' + i + ']');
    checkNoExtraKeys(d, new Set(['key', 'className']), 'domainSerializers[' + i + ']');
    if (typeof d.key !== 'string' || !d.key) fail('domainSerializers[' + i + '].key invalid');
    if (typeof d.className !== 'string' || !d.className) fail('domainSerializers[' + i + '].className invalid');
  }
  for (const group of ['hosts', 'effects']) {
    if (!Array.isArray(ser[group])) fail('serialization.' + group + ' must be array');
    for (let i = 0; i < ser[group].length; i++) {
      const h = checkObject(ser[group][i], 'serialization.' + group + '[' + i + ']');
      checkNoExtraKeys(h, new Set(['key', 'serializerClass', 'eventClass']), 'serialization.' + group + '[' + i + ']');
      if (typeof h.key !== 'string' || !h.key) fail('invalid serializer key');
      if (typeof h.serializerClass !== 'string' || !h.serializerClass) fail('invalid serializerClass');
      if (typeof h.eventClass !== 'string' || !h.eventClass) fail('invalid eventClass');
    }
  }
  if (!Array.isArray(ser.sources) || !ser.sources.length) fail('serialization.sources must be non-empty');
  for (let i = 0; i < ser.sources.length; i++) checkSource(ser.sources[i], 'serialization.sources[' + i + ']');

  if (!Array.isArray(input.files) || !input.files.length) fail('files must be non-empty');
  const seen = new Set(['conf/serialization.conf']);
  for (let i = 0; i < input.files.length; i++) {
    const f = checkObject(input.files[i], 'files[' + i + ']');
    checkNoExtraKeys(f, new Set(['path', 'kind', 'content', 'deps', 'sources']), 'files[' + i + ']');
    if (typeof f.path !== 'string' || !f.path) fail('files[' + i + '].path invalid');
    if (seen.has(f.path)) fail('duplicate scaffold file path: ' + f.path);
    seen.add(f.path);
    if (!KINDS.has(f.kind)) fail('files[' + i + '].kind invalid: ' + f.kind);
    if (typeof f.content !== 'string' || !f.content) fail('files[' + i + '].content invalid');
    if (!Array.isArray(f.deps)) fail('files[' + i + '].deps must be array');
    if (!Array.isArray(f.sources) || !f.sources.length) fail('files[' + i + '].sources must be non-empty');
    for (let s = 0; s < f.sources.length; s++) checkSource(f.sources[s], 'files[' + i + '].sources[' + s + ']');
  }
}

const q = JSON.stringify;

function renderSerializationConf(ser) {
  const lines = [
    'akka.actor.allow-java-serialization = off',
    'akka.actor.warn-about-java-serializer-usage = on',
    '',
    'akka.actor.serializers {',
    '  proto = "akka.remote.serialization.ProtobufSerializer"',
    ...ser.domainSerializers.map(d => `  ${d.key} = ${q(d.className)}`),
    '  strict-saga = "net.imadz.infra.saga.strict.StrictSagaSerializer"',
    ...ser.hosts.map(h => `  ${h.key} = ${q(h.serializerClass)}`),
    ...ser.effects.map(e => `  ${e.key} = ${q(e.serializerClass)}`),
    '}',
    '',
    'akka.actor.serialization-bindings {',
    '  "com.google.protobuf.Message" = proto',
    `  "scalapb.GeneratedMessage" = ${ser.domainSerializers[0].key}`,
    `  "scalapb.GeneratedOneof" = ${ser.domainSerializers[0].key}`,
    '  "net.imadz.infra.saga.strict.StrictDurable" = strict-saga',
    ...ser.hosts.map(h => `  ${q(h.eventClass)} = ${h.key}`),
    ...ser.effects.map(e => `  ${q(e.eventClass)} = ${e.key}`),
    '}',
    '',
  ];
  return lines.join('\n');
}

export function renderProjectScaffoldFiles(input) {
  checkInput(input);
  return [
    {
      path: 'conf/serialization.conf',
      content: renderSerializationConf(input.serialization),
      kind: 'build',
      deps: [],
      sources: input.serialization.sources.map(s => ({ document: s.document, pointer: s.pointer })),
      codeMappings: [],
    },
    ...input.files.map(f => ({
      path: f.path,
      content: f.content,
      kind: f.kind,
      deps: [...f.deps],
      sources: f.sources.map(s => ({ document: s.document, pointer: s.pointer })),
      codeMappings: [],
    })),
  ];
}

export function renderAll(input) {
  return Object.fromEntries(renderProjectScaffoldFiles(input).map(f => [f.path, f.content]));
}

export function runNegatives(baseInput) {
  const clone = () => JSON.parse(JSON.stringify(baseInput));
  const cases = [
    ['non-object input', () => null],
    ['wrong schemaVersion', () => { const x = clone(); x.schemaVersion = 'wrong/v1'; return x; }],
    ['unexpected top-level key', () => { const x = clone(); x.extra = true; return x; }],
    ['empty domainSerializers', () => { const x = clone(); x.serialization.domainSerializers = []; return x; }],
    ['empty serializer key', () => { const x = clone(); x.serialization.domainSerializers[0].key = ''; return x; }],
    ['empty serializer className', () => { const x = clone(); x.serialization.domainSerializers[0].className = ''; return x; }],
    ['non-array hosts', () => { const x = clone(); x.serialization.hosts = null; return x; }],
    ['non-array effects', () => { const x = clone(); x.serialization.effects = null; return x; }],
    ['empty serialization sources', () => { const x = clone(); x.serialization.sources = []; return x; }],
    ['empty files', () => { const x = clone(); x.files = []; return x; }],
    ['duplicate file path', () => { const x = clone(); x.files.push(clone().files[0]); return x; }],
    ['colliding serialization.conf', () => { const x = clone(); x.files[0].path = 'conf/serialization.conf'; return x; }],
    ['unsupported file kind', () => { const x = clone(); x.files[0].kind = 'proto'; return x; }],
    ['empty file content', () => { const x = clone(); x.files[0].content = ''; return x; }],
    ['empty file sources', () => { const x = clone(); x.files[0].sources = []; return x; }],
    ['malformed file source pointer', () => { const x = clone(); x.files[0].sources[0].pointer = 'bad'; return x; }],
  ];
  let rejected = 0;
  const failures = [];
  for (const [label, build] of cases) {
    try {
      checkInput(build());
      failures.push(label + ': unexpectedly accepted');
    } catch (err) {
      if (!String(err.message || '').startsWith('PSC_INPUT:')) {
        failures.push(label + ': wrong error prefix (' + err.message + ')');
      } else {
        rejected++;
      }
    }
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'project-scaffold',
  familyNumber: 39,
  inputSchema: SCHEMA,
  provenance: 'handwritten-golden',
  toolsRef: null,
  goldenRoot: 'test/reference/curated/project-scaffold/v1',
  fixtureDir: 'test/fixtures/project-scaffold-v1',
  checkInput,
  renderAll,
  runNegatives,
});
