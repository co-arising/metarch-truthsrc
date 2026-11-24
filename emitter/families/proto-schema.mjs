// Unified emitter family #29: proto-schema (Wave 1A curated protobuf schemas).
// Emits clean, multi-line proto3 files (domain, execution, host, effect) from
// the typed truthsrc.proto-schema-input/v1 contract. Zero hardcoded business
// identifiers; fail-closed on every contract violation (PS_INPUT).
const SCHEMA = 'truthsrc.proto-schema-input/v1';
const KINDS = new Set(['proto', 'host-proto', 'effect-proto']);
const MODIFIERS = new Set(['', 'optional', 'repeated']);
const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/u;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const PROTO_TYPE_RE = /^\.?[A-Za-z_][A-Za-z0-9_.]*$/u;

const fail = message => { throw new Error('PS_INPUT: ' + message); };

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
  checkNoExtraKeys(input, new Set(['schemaVersion', 'files']), 'input');
  if (input.schemaVersion !== SCHEMA) fail('schemaVersion must be ' + SCHEMA);
  if (!Array.isArray(input.files) || !input.files.length) fail('files must be a non-empty array');

  const seenPaths = new Set();
  for (let i = 0; i < input.files.length; i++) {
    const f = checkObject(input.files[i], 'files[' + i + ']');
    checkNoExtraKeys(f, new Set(['path', 'kind', 'packageName', 'imports', 'messages', 'deps', 'sources']), 'files[' + i + ']');
    if (typeof f.path !== 'string' || !f.path.startsWith('app/protobuf/') || !f.path.endsWith('.proto'))
      fail('files[' + i + '].path must be under app/protobuf/*.proto');
    if (seenPaths.has(f.path)) fail('duplicate proto file path: ' + f.path);
    seenPaths.add(f.path);
    if (typeof f.kind !== 'string' || !KINDS.has(f.kind)) fail('files[' + i + '].kind unsupported: ' + JSON.stringify(f.kind));
    if (typeof f.packageName !== 'string' || !PACKAGE_RE.test(f.packageName))
      fail('files[' + i + '].packageName must match ' + PACKAGE_RE);
    if (!Array.isArray(f.imports) || !f.imports.length || f.imports.some(imp => typeof imp !== 'string' || !imp.endsWith('.proto')))
      fail('files[' + i + '].imports must be a non-empty array of .proto paths');
    if (!Array.isArray(f.deps) || f.deps.some(d => typeof d !== 'string' || !d))
      fail('files[' + i + '].deps must be an array of non-empty strings');
    if (!Array.isArray(f.sources) || !f.sources.length) fail('files[' + i + '].sources must be a non-empty array');
    for (let s = 0; s < f.sources.length; s++) checkSource(f.sources[s], 'files[' + i + '].sources[' + s + ']');

    if (!Array.isArray(f.messages) || !f.messages.length) fail('files[' + i + '].messages must be a non-empty array');
    const seenMsgs = new Set();
    for (let m = 0; m < f.messages.length; m++) {
      const msg = checkObject(f.messages[m], 'files[' + i + '].messages[' + m + ']');
      checkNoExtraKeys(msg, new Set(['name', 'fields']), 'files[' + i + '].messages[' + m + ']');
      if (typeof msg.name !== 'string' || !IDENT_RE.test(msg.name))
        fail('files[' + i + '].messages[' + m + '].name must match ' + IDENT_RE);
      if (seenMsgs.has(msg.name)) fail('duplicate message name in ' + f.path + ': ' + msg.name);
      seenMsgs.add(msg.name);
      if (!Array.isArray(msg.fields)) fail('files[' + i + '].messages[' + m + '].fields must be an array');
      const seenNums = new Set();
      const seenFieldNames = new Set();
      for (let k = 0; k < msg.fields.length; k++) {
        const fld = checkObject(msg.fields[k], 'files[' + i + '].messages[' + m + '].fields[' + k + ']');
        checkNoExtraKeys(fld, new Set(['modifier', 'type', 'name', 'number']), 'files[' + i + '].messages[' + m + '].fields[' + k + ']');
        if (typeof fld.modifier !== 'string' || !MODIFIERS.has(fld.modifier))
          fail('unsupported field modifier: ' + JSON.stringify(fld.modifier));
        if (typeof fld.type !== 'string' || !PROTO_TYPE_RE.test(fld.type))
          fail('invalid proto field type: ' + JSON.stringify(fld.type));
        if (typeof fld.name !== 'string' || !IDENT_RE.test(fld.name))
          fail('invalid proto field name: ' + JSON.stringify(fld.name));
        if (!Number.isInteger(fld.number) || fld.number < 1)
          fail('proto field number must be a positive integer');
        if (seenNums.has(fld.number)) fail('duplicate field number ' + fld.number + ' in ' + msg.name);
        if (seenFieldNames.has(fld.name)) fail('duplicate field name ' + fld.name + ' in ' + msg.name);
        seenNums.add(fld.number);
        seenFieldNames.add(fld.name);
      }
    }
  }
}

function renderProtoFile(file) {
  const lines = [
    'syntax = "proto3";',
    '',
    ...file.imports.map(imp => `import "${imp}";`),
    '',
    `package ${file.packageName};`,
    '',
    'option (scalapb.options) = { flat_package: true };',
    '',
  ];
  for (const msg of file.messages) {
    lines.push(`message ${msg.name} {`);
    for (const fld of msg.fields) {
      const prefix = fld.modifier ? fld.modifier + ' ' : '';
      lines.push(`  ${prefix}${fld.type} ${fld.name} = ${fld.number};`);
    }
    lines.push('}');
    lines.push('');
  }
  return lines.join('\n');
}

export function renderProtoSchemaFiles(input) {
  checkInput(input);
  return input.files.map(file => ({
    path: file.path,
    content: renderProtoFile(file),
    kind: file.kind,
    deps: [...file.deps],
    sources: file.sources.map(s => ({ document: s.document, pointer: s.pointer })),
    codeMappings: [],
  }));
}

export function renderAll(input) {
  return Object.fromEntries(renderProtoSchemaFiles(input).map(f => [f.path, f.content]));
}

export function runNegatives(baseInput) {
  const clone = () => JSON.parse(JSON.stringify(baseInput));
  const cases = [
    ['non-object input', () => null],
    ['wrong schemaVersion', () => { const x = clone(); x.schemaVersion = 'wrong/v1'; return x; }],
    ['unexpected top-level key', () => { const x = clone(); x.extra = true; return x; }],
    ['empty files', () => { const x = clone(); x.files = []; return x; }],
    ['invalid proto path', () => { const x = clone(); x.files[0].path = 'bad.scala'; return x; }],
    ['duplicate proto path', () => { const x = clone(); x.files.push(clone().files[0]); return x; }],
    ['unsupported kind', () => { const x = clone(); x.files[0].kind = 'unknown'; return x; }],
    ['invalid packageName', () => { const x = clone(); x.files[0].packageName = 'Bad.Pkg'; return x; }],
    ['empty imports', () => { const x = clone(); x.files[0].imports = []; return x; }],
    ['empty sources', () => { const x = clone(); x.files[0].sources = []; return x; }],
    ['empty messages', () => { const x = clone(); x.files[0].messages = []; return x; }],
    ['duplicate message name', () => { const x = clone(); x.files[0].messages.push(clone().files[0].messages[0]); return x; }],
    ['unsupported field modifier', () => { const x = clone(); x.files[0].messages[0].fields[0].modifier = 'required'; return x; }],
    ['invalid field type', () => { const x = clone(); x.files[0].messages[0].fields[0].type = '123bad'; return x; }],
    ['non-positive field number', () => { const x = clone(); x.files[0].messages[0].fields[0].number = 0; return x; }],
    ['duplicate field number', () => {
      const x = clone();
      const fld = clone().files[0].messages[0].fields[0];
      fld.name = 'dup_field';
      x.files[0].messages[0].fields.push(fld);
      return x;
    }],
  ];
  let rejected = 0;
  const failures = [];
  for (const [label, build] of cases) {
    try {
      checkInput(build());
      failures.push(label + ': unexpectedly accepted');
    } catch (err) {
      if (!String(err.message || '').startsWith('PS_INPUT:')) {
        failures.push(label + ': wrong error prefix (' + err.message + ')');
      } else {
        rejected++;
      }
    }
  }
  return { expected: cases.length, rejected, failures };
}

export const family = Object.freeze({
  id: 'proto-schema',
  familyNumber: 29,
  inputSchema: SCHEMA,
  provenance: 'handwritten-golden',
  toolsRef: null,
  goldenRoot: 'test/reference/curated/proto-schema/v1',
  fixtureDir: 'test/fixtures/proto-schema-v1',
  checkInput,
  renderAll,
  runNegatives,
});
