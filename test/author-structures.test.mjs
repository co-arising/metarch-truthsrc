import test from 'node:test';
import assert from 'node:assert/strict';
import { expandAuthorStructures, STRUCTURE_VERSION } from '../lib/author-structures.mjs';
import { parseAuthorDoc } from '../lib/author-parse.mjs';

const root = 'contexts/example/';
const structureFile = root + 'structures/protocol.structure.yaml';
const voFile = root + 'value-objects/message.vo.yaml';
const arg = name => ({ $arg: name });
const value = name => ({ $value: name });
const rows = (template, data) => ({ $rows: { template, rows: data } });
const vo = payload => ({ kind: 'value-object', payload });
const atom = (payload = { name: 'Message' }, file = voFile) => ({ file, doc: vo(payload) });
const structure = (atoms = [atom()], constants = {}, templates = {}) => ({
  kind: 'structure', schemaVersion: STRUCTURE_VERSION, id: 'protocol', payload: { constants, templates, atoms },
});
const tree = doc => new Map([[structureFile, doc]]);
const expand = doc => expandAuthorStructures(tree(doc), { enabled: true });
const templated = (body = atom({ name: arg('name') }), data = [['Message']], parameters = ['name']) =>
  structure([rows('item', data)], {}, { item: { parameters, body } });
function atPointer(object, pointer) {
  if (!pointer) return object;
  assert.ok(pointer.startsWith('/'));
  for (const token of pointer.slice(1).split('/')) {
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
    assert.ok(object !== null && typeof object === 'object', `not an object before ${key} in ${pointer}`);
    assert.ok(Object.hasOwn(object, key), `no physical ${key} in ${pointer}`);
    object = object[key];
  }
  return object;
}
function checkSources(result, input) {
  const docs = new Map(result.documents.map(entry => [entry.file, entry.doc]));
  for (const mapping of result.mappings) {
    assert.ok(input.has(mapping.authorFile));
    const authored = atPointer(input.get(mapping.authorFile), mapping.authorPointer);
    const generated = atPointer(docs.get(mapping.file), mapping.pointer);
    if (mapping.mode === 'subtree') assert.deepEqual(generated, authored);
    else assert.equal(mapping.mode, 'declaration');
    assert.ok(mapping.label.length);
    if (mapping.template) atPointer(input.get(mapping.template.file), mapping.template.pointer);
  }
}

test('ordinary documents stay opaque, detached and sorted with the feature on or off', () => {
  const input = new Map([
    [root + 'value-objects/z.vo.yaml', vo({ text: '$arg:name ${name} $value:test/x',
      opaque: { $rows: { template: 'absent', rows: [] } }, another: { $unknown: true } })],
    [root + 'value-objects/a.vo.yaml', vo({ number: '001', values: [null, false, 0, -0] })],
  ]);
  for (const options of [undefined, { enabled: false }, { enabled: true }]) {
    const result = expandAuthorStructures(input, options);
    assert.deepEqual(result.documents, [...input].sort(([a], [b]) => a.localeCompare(b)).map(([file, doc]) => ({ file, doc })));
    assert.deepEqual(result.mappings, []);
    assert.notEqual(result.documents[0].doc, input.get(result.documents[0].file));
    assert.ok(Object.isFrozen(result.documents[0].doc.payload));
  }
  assert.deepEqual(expandAuthorStructures(new Map()), { documents: [], mappings: [] });
});

test('structures require an explicit opt-in and supported closed header/payload', () => {
  assert.equal(STRUCTURE_VERSION, 'truthsrc.structure/v1');
  for (const options of [undefined, {}, { enabled: false }]) {
    assert.throws(() => expandAuthorStructures(tree(structure()), options), /structures require enabled/);
  }
  const changes = [
    doc => { doc.schemaVersion = 'truthsrc.structure/v2'; },
    doc => { doc.kind = 'value-object'; },
    doc => { doc.extra = true; },
    doc => { delete doc.id; },
    doc => { doc.description = 1; },
    doc => { doc.payload.extra = true; },
    doc => { delete doc.payload.constants; },
    doc => { doc.payload.templates = []; },
    doc => { doc.payload.atoms = {}; },
    doc => { doc.payload.constants = null; },
  ];
  for (const change of changes) {
    const doc = structure(); change(doc);
    assert.throws(() => expand(doc), /AUTHOR_STRUCTURE:/);
  }
  assert.equal(expand({ ...structure(), description: 'Finite protocol declarations' }).documents.length, 1);
});

test('restricted author parser feeds a three-port and three-VO template example', () => {
  const portRows = [
    [root + 'formal-products/technical-port/prepare.formal.yaml', 'Prepare', 'Prepared'],
    [root + 'formal-products/technical-port/commit.formal.yaml', 'Commit', 'Committed'],
    [root + 'formal-products/technical-port/cancel.formal.yaml', 'Cancel', 'Cancelled'],
  ];
  const voRows = [
    [root + 'value-objects/prepared.vo.yaml', 'Prepared'],
    [root + 'value-objects/committed.vo.yaml', 'Committed'],
    [root + 'value-objects/cancelled.vo.yaml', 'Cancelled'],
  ];
  const doc = structure([rows('port', portRows), rows('vo', voRows)], { fields: [{ name: 'token', type: 'String' }] }, {
    port: { parameters: ['file', 'name', 'reply'], body: { file: arg('file'), doc: {
      kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'technical-port',
      id: arg('name'), version: '1', payload: { name: arg('name'), version: '1', reply: arg('reply') },
    } } },
    vo: { parameters: ['file', 'name'], body: { file: arg('file'), doc: vo({ name: arg('name'), fields: value('fields') }) } },
  });
  const parsed = parseAuthorDoc(`kind: structure\nschemaVersion: ${STRUCTURE_VERSION}\nid: protocol\npayload:\n  ${JSON.stringify(doc.payload)}\n`, structureFile);
  const result = expand(parsed);
  const expected = [
    { file: root + 'formal-products/technical-port/cancel.formal.yaml', doc: { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'technical-port', id: 'Cancel', version: '1', payload: { name: 'Cancel', version: '1', reply: 'Cancelled' } } },
    { file: root + 'formal-products/technical-port/commit.formal.yaml', doc: { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'technical-port', id: 'Commit', version: '1', payload: { name: 'Commit', version: '1', reply: 'Committed' } } },
    { file: root + 'formal-products/technical-port/prepare.formal.yaml', doc: { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'technical-port', id: 'Prepare', version: '1', payload: { name: 'Prepare', version: '1', reply: 'Prepared' } } },
    { file: root + 'value-objects/cancelled.vo.yaml', doc: vo({ name: 'Cancelled', fields: [{ name: 'token', type: 'String' }] }) },
    { file: root + 'value-objects/committed.vo.yaml', doc: vo({ name: 'Committed', fields: [{ name: 'token', type: 'String' }] }) },
    { file: root + 'value-objects/prepared.vo.yaml', doc: vo({ name: 'Prepared', fields: [{ name: 'token', type: 'String' }] }) },
  ];
  assert.deepEqual(result.documents, expected);
  for (const entry of result.documents) {
    const declaration = result.mappings.find(mapping => mapping.file === entry.file && mapping.pointer === '' && mapping.mode === 'declaration');
    assert.match(declaration.authorPointer, /^\/payload\/atoms\/[01]\/\$rows\/rows\/[012]$/);
    assert.match(declaration.template.pointer, /^\/payload\/templates\/(port|vo)$/);
  }
  assert.ok(result.mappings.some(mapping => mapping.authorPointer === '/payload/constants/fields'));
  checkSources(result, tree(parsed));
});

test('cross-file forward references resolve bare names in the template definition scope', () => {
  const sharedFile = root + 'structures/z-shared.structure.yaml';
  const caller = structure([rows('shared/row', [[voFile, 'Message']])], { default: 'caller-only' });
  caller.payload.atoms.push(atom({ name: value('default') }, root + 'value-objects/local.vo.yaml'));
  const shared = { ...structure([], { default: { type: 'String' } }, {
    row: { parameters: ['file', 'name'], body: { file: arg('file'), doc: vo({ name: arg('name'), type: value('default'), extra: value('protocol/default') }) } },
  }), id: 'shared' };
  const input = new Map([[sharedFile, shared], [structureFile, caller]]);
  const first = expandAuthorStructures(input, { enabled: true });
  const reverse = expandAuthorStructures(new Map([...input].reverse()), { enabled: true });
  assert.deepEqual(first, reverse);
  assert.deepEqual(first.documents.find(entry => entry.file === voFile).doc.payload,
    { name: 'Message', type: { type: 'String' }, extra: 'caller-only' });
  assert.ok(first.mappings.some(mapping => mapping.authorFile === sharedFile && mapping.authorPointer === '/payload/constants/default'));
  checkSources(first, input);
  const unqualified = structuredClone(caller);
  unqualified.payload.atoms[0].$rows.template = 'row';
  assert.throws(() => expandAuthorStructures(new Map([[structureFile, unqualified], [sharedFile, shared]]), { enabled: true }), /dangling reference protocol\/row/);
});

test('row values, constants, literals and every dollar string are opaque JSON', () => {
  const raw = { $rows: { template: 'not-a-call', rows: [[{ $bad: 'literal' }]] } };
  const constant = { $value: 'not/a-reference', text: '${name} $arg $rows' };
  const doc = templated(atom({ fromArg: arg('name'), fromValue: value('opaque'),
    quoted: { $literal: { $unknown: [true, null] } }, text: '$arg:name' }), [[raw]]);
  doc.payload.constants.opaque = constant;
  const result = expand(doc);
  assert.deepEqual(result.documents[0].doc.payload, { fromArg: raw, fromValue: constant,
    quoted: { $unknown: [true, null] }, text: '$arg:name' });
  checkSources(result, tree(doc));
  assert.equal(expand(templated(atom({ scalar: arg('name') }), [[null]])).documents[0].doc.payload.scalar, null);
});

test('dynamic object keys preserve escaped pointers, ordering and own __proto__ safely', () => {
  const doc = templated(atom({ fields: { $object: [[arg('name'), value('body')], [value('key'), { $literal: { $arg: 'literal' } }]] } }), [['__proto__']]);
  doc.payload.constants = { body: { safe: true }, key: 'slash/~field' };
  const result = expand(doc), fields = result.documents[0].doc.payload.fields;
  assert.equal(Object.getPrototypeOf(fields), Object.prototype);
  assert.ok(Object.hasOwn(fields, '__proto__'));
  assert.deepEqual(fields.__proto__, { safe: true });
  assert.equal({}.safe, undefined);
  assert.deepEqual(Object.keys(fields), ['__proto__', 'slash/~field']);
  const fieldSource = result.mappings.find(mapping => mapping.pointer === '/payload/fields/slash~1~0field');
  assert.equal(fieldSource.mode, 'subtree');
  assert.deepEqual(atPointer(doc, fieldSource.authorPointer), fields['slash/~field']);
  checkSources(result, tree(doc));
  const duplicate = templated(atom({ fields: { $object: [[arg('name'), 1], ['same', 2]] } }), [['same']]);
  assert.throws(() => expand(duplicate), /duplicate dynamic object key/);
  for (const key of [null, false, 123, [], {}]) {
    assert.throws(() => expand(templated(atom({ fields: { $object: [[arg('name'), 1]] } }), [[key]])), /dynamic object key must be a string/);
  }
});

test('multiple nested row sites splice only array elements and retain exact source indices', () => {
  const doc = structure([atom({
    items: ['before', rows('record', [['one'], ['two']]), 'after', rows('record', [['three']])],
    separate: rows('scalar', [[1], [2]]),
    nested: [rows('array', [['first'], ['second']])],
  })], {}, {
    record: { parameters: ['name'], body: { name: arg('name'), type: 'String' } },
    scalar: { parameters: ['v'], body: arg('v') },
    array: { parameters: ['v'], body: [arg('v')] },
  });
  const result = expand(doc);
  assert.deepEqual(result.documents[0].doc.payload, {
    items: ['before', { name: 'one', type: 'String' }, { name: 'two', type: 'String' }, 'after', { name: 'three', type: 'String' }],
    separate: [1, 2], nested: [['first'], ['second']],
  });
  const mapping = pointer => result.mappings.find(entry => entry.pointer === pointer);
  assert.equal(mapping('').authorPointer, '/payload/atoms/0');
  assert.equal(mapping('/payload/items/1').authorPointer, '/payload/atoms/0/doc/payload/items/1/$rows/rows/0');
  assert.equal(mapping('/payload/items/2').authorPointer, '/payload/atoms/0/doc/payload/items/1/$rows/rows/1');
  assert.equal(mapping('/payload/items/3').authorPointer, '/payload/atoms/0/doc/payload/items/2');
  assert.equal(mapping('/payload/items/4').authorPointer, '/payload/atoms/0/doc/payload/items/3/$rows/rows/0');
  assert.equal(mapping('/payload/items/1/name').authorPointer, '/payload/atoms/0/doc/payload/items/1/$rows/rows/0/0');
  assert.equal(mapping('/payload/items/1/name').mode, 'subtree');
  checkSources(result, tree(doc));
});

test('zero rows, empty arrays/objects and non-array row locations have explicit semantics', () => {
  const doc = structure([atom({ empty: rows('zero', []), items: ['a', rows('zero', []), 'b'], object: { $object: [] } })],
    { empty: [] }, { zero: { parameters: [], body: value('empty') } });
  const result = expand(doc);
  assert.deepEqual(result.documents[0].doc.payload, { empty: [], items: ['a', 'b'], object: {} });
  assert.deepEqual(expand(structure()).documents, [atom()]);
  assert.deepEqual(expand(structure([])), { documents: [], mappings: [] });
  checkSources(result, tree(doc));
});

test('every supported standard context atom residence can be emitted without semantic inference', () => {
  const cases = [
    ['aggregates/counter/aggregate.yaml', 'aggregate'], ['aggregates/counter/slices/set.slice.yaml', 'slice'],
    ['aggregates/counter/notes/type-es-set-1.yaml', 'note'], ['value-objects/item.vo.yaml', 'value-object'],
    ['read-models/view.rm.yaml', 'read-model'], ['stories/change.story.yaml', 'story'],
    ['domain-services/invoke.port.yaml', 'domain-service'], ['policies/policy-es-invoke-1.policy.yaml', 'policy'],
    ['pipelines/run.pipeline.yaml', 'pipeline'], ['scenarios/run.scenario.yaml', 'scenario'],
    ['sagas/run.saga.yaml', 'saga'], ['use-cases.yaml', 'use-cases'],
    ['formal-products/effect-host/run.formal.yaml', 'formal-product'],
  ];
  const input = cases.map(([file, kind]) => ({ file: root + file, doc: { kind, payload: {} } }));
  const result = expand(structure(input));
  assert.equal(result.documents.length, cases.length);
  assert.equal(result.mappings.filter(mapping => mapping.pointer === '').length, cases.length);
  checkSources(result, tree(structure(input)));
});

test('unknown/mixed instructions, malformed rows and parameter arity fail closed', () => {
  for (const expression of [{ $unknown: true }, { $arg: 'name', other: true }, { $arg: 'name', $value: 'x' },
    { $arg: 'absent' }, { $arg: '' }, { $value: 'missing' }, { $value: 'x/y/z' },
    { $value: 'x/' }, { $value: {} }, { $object: {} }, { $object: [[1]] }, { $object: [[1, 2, 3]] }]) {
    assert.throws(() => expand(templated(atom({ expression }))), /AUTHOR_STRUCTURE:/);
  }
  assert.throws(() => expand(structure([atom({ name: arg('unbound') })])), /missing\/undeclared parameter/);
  for (const spec of [{}, { template: 'item', rows: [], extra: true }, { template: 'item', rows: {} },
    { template: 'item', rows: [[]] }, { template: 'item', rows: [[1, 2]] }, { template: 'item', rows: [{}] },
    { template: 'absent', rows: [] }, { template: 'other/item', rows: [] }]) {
    const doc = templated(); doc.payload.atoms = [{ $rows: spec }];
    assert.throws(() => expand(doc), /AUTHOR_STRUCTURE:/);
  }
});

test('template calls, self/mutual cycles and hidden invalid unused bodies are rejected', () => {
  for (const body of [rows('item', [['again']]), { nested: [rows('other', [['again']])] }, { $call: 'item' }]) {
    assert.throws(() => expand(templated(body)), /no recursion|unknown or mixed directive/);
  }
  const mutual = structure([rows('one', [[]])], {}, {
    one: { parameters: [], body: rows('two', [[]]) },
    two: { parameters: [], body: rows('one', [[]]) },
  });
  assert.throws(() => expand(mutual), /no recursion/);
  const zero = templated(atom({ invalid: { $bad: true } }), []);
  assert.throws(() => expand(zero), /unknown or mixed directive/);
  const unused = structure([], {}, { unused: { parameters: [], body: { $bad: 1 } } });
  assert.throws(() => expand(unused), /unknown or mixed directive/);
});

test('zero-row templates reject statically invalid dynamic keys', () => {
  for (const pairs of [[[42, 'value']], [['same', 1], ['same', 2]]]) {
    const doc = templated(atom({ fields: { $object: pairs } }), []);
    assert.throws(() => expand(doc), /dynamic object key/);
  }
});

test('whole atom wrappers keep their exact document source without duplicate mappings', () => {
  for (const doc of [structure([atom()]), structure([{ $literal: atom() }]),
    structure([value('wrapper')], { wrapper: atom() }), templated(arg('name'), [[atom()]])]) {
    const result = expand(doc);
    checkSources(result, tree(doc));
    assert.equal(result.mappings.find(m => m.pointer === '').mode, 'subtree');
    assert.equal(new Set(result.mappings.map(m => JSON.stringify([m.file, m.pointer]))).size, result.mappings.length);
  }
});

test('definitions, parameters and references use readable ASCII names and reject unused definitions', () => {
  for (const bad of ['', 'bad/name', 'white space', '../escape', '中文', 'a.b', '$name']) {
    const doc = structure(); doc.id = bad;
    assert.throws(() => expand(doc), /identifier/);
    assert.throws(() => expand(structure([], { [bad]: 1 })), /identifier/);
    assert.throws(() => expand(templated(atom(), [[1]], [bad])), /identifier/);
  }
  assert.equal(expand({ ...structure(), id: 'Protocol_v1-2' }).documents.length, 1);
  assert.throws(() => expand(templated(atom(), [[1, 2]], ['x', 'x'])), /duplicate parameter/);
  assert.throws(() => expand(structure([], { unused: 1 })), /unused constant/);
  assert.throws(() => expand(structure([], {}, { unused: { parameters: [], body: {} } })), /unused template/);
  for (const definition of [{ parameters: [] }, { body: {} }, { parameters: [], body: {}, extra: true }, { parameters: {} }]) {
    assert.throws(() => expand(structure([], {}, { invalid: definition })), /AUTHOR_STRUCTURE:/);
  }
  const duplicate = new Map([[structureFile, structure([])], [root + 'structures/other.structure.yaml', structure([])]]);
  assert.throws(() => expandAuthorStructures(duplicate, { enabled: true }), /duplicate structure id/);
  assert.throws(() => parseAuthorDoc(`kind: structure\npayload:\n  {"constants":{"x":1,"x":2}}\n`, structureFile), /duplicate JSON key/);
});

test('unsafe, misplaced, cross-context, duplicate and case-alias output files reject', () => {
  const unsafe = ['/tmp/a.vo.yaml', '../a.vo.yaml', root + '../a.vo.yaml', root + 'value-objects//a.vo.yaml',
    root + 'value-objects/./a.vo.yaml', root + 'value-objects/a\\b.vo.yaml', 'C:/tmp/a.vo.yaml',
    root + 'value-objects/evil\0.vo.yaml', root + 'value-objects/evil\n.vo.yaml',
    'contexts/other/value-objects/a.vo.yaml', 'value-objects/a.vo.yaml', root + 'context.yaml',
    root + 'structures/other.structure.yaml', root + 'inbox/a.yaml', 'system.yaml',
    root + 'formal-products/unknown/a.formal.yaml', root + 'value-objects/a.yaml'];
  for (const file of unsafe) assert.throws(() => expand(structure([atom({}, file)])), /AUTHOR_STRUCTURE:/, file);
  for (const file of ['structures/protocol.structure.yaml', root + 'structures/Upper.structure.yaml',
    root + 'structures/double--dash.structure.yaml', root + 'structures/nested/a.structure.yaml',
    root + 'value-objects/a.structure.yaml']) {
    assert.throws(() => expandAuthorStructures(new Map([[file, structure()]]), { enabled: true }), /structure file must/);
  }
  assert.throws(() => expand(structure([atom(), atom()])), /duplicate\/alias output/);
  assert.throws(() => expand(structure([atom(), atom({}, root + 'value-objects/Message.vo.yaml')])), /duplicate\/alias output/);
  const collision = new Map([[structureFile, structure()], [voFile, vo({ real: true })]]);
  assert.throws(() => expandAuthorStructures(collision, { enabled: true }), /real author file collision/);
  collision.delete(voFile); collision.set(root + 'value-objects/Message.vo.yaml', vo({ real: true }));
  assert.throws(() => expandAuthorStructures(collision, { enabled: true }), /real author file collision/);
  assert.throws(() => expandAuthorStructures(new Map([[voFile, vo({})], [root + 'value-objects/Message.vo.yaml', vo({})]])), /duplicate\/alias author file/);
  for (const bad of [null, [], {}, { file: voFile }, { file: voFile, doc: vo({}), extra: true }, { file: voFile, doc: [] }, atom({}, root + 'sagas/wrong.saga.yaml')]) {
    assert.throws(() => expand(structure([bad])), /AUTHOR_STRUCTURE:/);
  }
});

test('tree-wide row and atom budgets include all call sites and ordinary documents', () => {
  const doc = structure([atom({ a: rows('number', Array.from({ length: 6000 }, () => [1])),
    b: rows('number', Array.from({ length: 4001 }, () => [2])) })], {}, { number: { parameters: ['v'], body: arg('v') } });
  assert.throws(() => expand(doc), /rows exceed 10000 budget/);
  doc.payload.atoms[0].doc.payload.b.$rows.rows.pop();
  const result = expand(doc);
  assert.equal(result.documents[0].doc.payload.a.length + result.documents[0].doc.payload.b.length, 10000);
  const ordinary = new Map(Array.from({ length: 10001 }, (_, i) => [`${root}value-objects/v-${i}.vo.yaml`, vo({})]));
  assert.throws(() => expandAuthorStructures(ordinary), /atoms exceed 10000 budget/);
  const generated = structure(Array.from({ length: 10001 }, (_, i) => atom({}, `${root}value-objects/v-${i}.vo.yaml`)));
  assert.throws(() => expand(generated), /atoms exceed 10000 budget/);
});

test('input and expanded byte budgets stop literal amplification and count UTF-8 bytes', () => {
  const tooBig = '界'.repeat(3 * 1024 * 1024);
  assert.throws(() => expand(structure([atom({ text: tooBig })])), /input tree exceeds 8 MiB budget/);
  const chunk = 'x'.repeat(1024 * 1024);
  const doc = structure([atom({ entries: rows('chunk', Array.from({ length: 9 }, () => [])) })],
    { chunk }, { chunk: { parameters: [], body: value('chunk') } });
  assert.throws(() => expand(doc), /expanded tree exceeds 8 MiB budget/);
  const acrossFiles = new Map(Array.from({ length: 9 }, (_, i) => [`${root}value-objects/v-${i}.vo.yaml`, vo({ chunk })]));
  assert.throws(() => expandAuthorStructures(acrossFiles), /input tree exceeds 8 MiB budget/);
  let shared = 'x';
  for (let i = 0; i < 25; i++) shared = [shared, shared];
  assert.throws(() => expandAuthorStructures(new Map([[voFile, vo({ shared })]])), /input tree exceeds 8 MiB budget/);
});

test('depth is capped at 64 both before copy and after template insertion', () => {
  const nest = (count, value) => { while (count--) value = { child: value }; return value; };
  assert.throws(() => expand(structure([atom({ deep: nest(65, true) })])), /depth 64/);
  const doc = structure([atom({ deep: nest(35, rows('deep', [[]])) })], {}, {
    deep: { parameters: [], body: nest(35, true) },
  });
  assert.throws(() => expand(doc), /depth 64/);
  assert.equal(expandAuthorStructures(new Map([[voFile, vo({ deep: nest(60, true) })]])).documents.length, 1);
});

test('copyImmutableData protection rejects cycles, non-JSON values, getters and proxy traps', () => {
  const cycle = {}; cycle.self = cycle;
  for (const invalid of [cycle, undefined, NaN, Infinity, 1n, () => true, new Date(), new Map(), new Set(),
    Object.create({ inherited: true }), { value: undefined }, new Array(2), { [Symbol('hidden')]: true },
    Object.defineProperty({}, 'hidden', { value: true })]) {
    assert.throws(() => expand(structure([atom({ invalid })])), /AUTHOR_STRUCTURE:/);
  }
  let touched = 0;
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { touched++; return 1; } });
  const proxy = new Proxy({}, { get() { touched++; }, ownKeys() { touched++; return []; }, getPrototypeOf() { touched++; return Object.prototype; } });
  for (const invalid of [accessor, proxy]) assert.throws(() => expand(structure([atom({ invalid })])), /AUTHOR_STRUCTURE:/);
  const mapProxy = new Proxy(new Map(), { getPrototypeOf() { touched++; return Map.prototype; } });
  assert.throws(() => expandAuthorStructures(mapProxy), /must be a Map/);
  const indirectProxy = new Map();
  Object.setPrototypeOf(indirectProxy, new Proxy(Map.prototype, { getPrototypeOf() { touched++; return Map.prototype; } }));
  assert.throws(() => expandAuthorStructures(indirectProxy), /must be a Map/);
  assert.throws(() => expandAuthorStructures({}), /must be a Map/);
  assert.equal(touched, 0);
});

test('all input objects remain mutable, outputs are detached/frozen and null prototypes survive', () => {
  const special = JSON.parse('{"__proto__":{"kept":true},"constructor":"text"}');
  const nullRecord = Object.assign(Object.create(null), { nested: special });
  const doc = templated(atom({ original: arg('name'), constant: value('shared') }), [[nullRecord]]);
  doc.payload.constants.shared = special;
  const before = JSON.stringify(doc), result = expand(doc);
  assert.equal(JSON.stringify(doc), before);
  assert.equal(Object.isFrozen(doc), false);
  assert.equal(Object.isFrozen(doc.payload.atoms[0].$rows.rows[0][0]), false);
  assert.equal(Object.isFrozen(special), false);
  const output = result.documents[0].doc.payload;
  assert.equal(Object.getPrototypeOf(output.original), null);
  assert.equal(Object.hasOwn(output.original.nested, '__proto__'), true);
  assert.equal(Object.getPrototypeOf(output.original.nested), Object.prototype);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.mappings));
  assert.ok(Object.isFrozen(result.mappings[0]));
  assert.ok(Object.isFrozen(output.original.nested.__proto__));
  assert.notEqual(output.constant, special);
  special.__proto__.kept = false;
  nullRecord.changed = true;
  assert.equal(output.constant.__proto__.kept, true);
  assert.equal(Object.hasOwn(output.original, 'changed'), false);
  assert.throws(() => { output.constant.constructor = 'changed'; }, TypeError);
});
