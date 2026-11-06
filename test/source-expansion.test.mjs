import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot, compileSnapshot } from '../lib/compile-snapshot.mjs';
import { buildSourceIndex, resolveSourcePointer, resolveRecordSource, validateSourceIndex, snapshotDigest, knowledgeIdentity } from '../lib/source-index.mjs';

const aggregateFile = 'aggregates/counter/aggregate.yaml';
const sliceFile = 'aggregates/counter/slices/increment.slice.yaml';
const hostFile = 'formal-products/effect-host/counter-host.formal.yaml';
const pipelineFile = 'pipelines/counter.pipeline.yaml';
const authorFile = 'contexts/example/aggregates/counter/aggregate.yaml';
const hostAuthorFile = 'contexts/example/hosts/counter.yaml';
const mapping = (file, pointer, authorPointer, mode = 'declaration', extra = {}) =>
  ({ file, pointer, authorFile, authorPointer, mode, label: 'compact declaration', ...extra });

function fixture(representationMappings = [], { reverseFields = false } = {}) {
  const stateFields = [{ name: 'total', type: 'Int', default: '0' }, { name: 'limit', type: 'Int', default: '100' }];
  if (reverseFields) stateFields.reverse();
  const snapshot = createSnapshot([
    { file: 'workshop.yaml', doc: { workshop: 'example', sessionOrder: ['es'] } },
    { file: aggregateFile, doc: { kind: 'aggregate', name: 'Counter', context: 'example', seq: 7,
      order: { commands: ['Increment'], events: ['Increased'] }, payload: { name: 'Counter', stateFields } } },
    { file: sliceFile, doc: { kind: 'slice', id: 'increment-alias', command: 'Increment',
      payload: { name: 'Increment', guards: [{ id: 'within-limit', expression: 'total < limit' }], produces: ['Increased'] },
      decision: { emissions: [{ event: 'Increased', bindings: { amount: '1' } }] },
      events: { Increased: { name: 'Increased', foldAssignments: [{ slot: 'total', op: 'add', expr: 'amount' }] } } } },
    { file: 'inbox/es/note.yaml', doc: { kind: 'note', id: 'counter-note', name: 'Counter changes', type: 'event',
      origin: { stage: 'es', seq: 1 }, payload: { noteId: 'legacy-note', name: 'Counter changes' } } },
    { file: hostFile, doc: { kind: 'formal-product', schemaVersion: 'truthsrc.formal-product/v1', family: 'effect-host',
      id: 'CounterHost', version: '1', payload: { id: 'CounterHost', version: '1', implementation: {
        rows: Array.from({ length: 11 }, (_, i) => ({ target: 'total', expr: String(i) })),
        config: { nested: { enabled: true } }, configuration: { enabled: true }, 'a/b~c': { value: 'escaped' },
      } } } },
    { file: pipelineFile, doc: { kind: 'pipeline', id: 'CounterFlow', payload: { steps: [{ command: 'Increment' }] } } },
  ], { inboxDirs: ['es'], aggregateDirs: ['counter'] });
  const { canonical } = compileSnapshot(snapshot);
  const options = { system: 'example', context: 'example', physicalFiles: {
    'workshop.yaml': 'system.yaml', [aggregateFile]: authorFile,
    [sliceFile]: 'contexts/example/aggregates/counter/slices/increment.slice.yaml',
    [hostFile]: hostAuthorFile, [pipelineFile]: 'contexts/example/pipelines/counter.pipeline.yaml',
  } };
  return { snapshot, canonical, options, index: buildSourceIndex(snapshot, canonical, { ...options, representationMappings }) };
}
const source = (index, pointer) => {
  const rows = resolveSourcePointer(index, pointer);
  assert.equal(rows.length, 1, pointer);
  return rows[0];
};
const semanticRecords = index => index.records.map(({ file, atomPointer, virtualFile, virtualAtomPointer, locationMapping, ...record }) => record);

// Full v1 record shape and property order are part of old receipt compatibility.
test('no mappings emits the exact legacy v1 shape, including explicit empty mappings', () => {
  const snapshot = { atoms: [{ file: 'workshop.yaml', doc: { name: 'example' } }], metadata: { inboxDirs: [], aggregateDirs: [] } };
  const canonical = { workshop: 'example', sessions: [], aggregates: [] }, digest = snapshotDigest(canonical);
  const expected = { schemaVersion: 'truthsrc.source-index/v1', snapshot: digest, system: 'example', context: '', records: [
    { pointer: '/sessions', file: 'workshop.yaml', atomPointer: null, kind: 'derived', identity: 'snapshot:' + digest + '#/sessions',
      identityBasis: 'snapshot-ordinal', aliases: [], owner: [], name: null,
      meaning: { reason: 'compiler-derived; no verbatim author pointer' }, relation: 'unresolved', surface: '/sessions' },
    { pointer: '/workshop', file: 'workshop.yaml', atomPointer: '/name', kind: 'system',
      identity: knowledgeIdentity('example', '', 'system', [], 'example'), identityBasis: 'qualified-declaration', aliases: [], owner: [],
      name: 'example', meaning: {}, relation: 'direct', surface: '' },
  ] };
  for (const options of [undefined, { representationMappings: [] }]) {
    const index = buildSourceIndex(snapshot, canonical, options);
    assert.equal(JSON.stringify(index), JSON.stringify(expected));
    assert.equal(validateSourceIndex(index), index);
  }
});

test('v1 longest-prefix, null sources, duplicate records and pre-surface receipts are unchanged', () => {
  const { index } = fixture();
  const legacyResolve = (index, pointer) => {
    const rows = index.records.filter(r => r.pointer === pointer || pointer.startsWith(r.pointer + '/'));
    const longest = Math.max(...rows.map(r => r.pointer.length));
    return rows.filter(r => r.pointer.length === longest).map(r => ({ ...r, projectionPointer: r.pointer, pointer,
      atomPointer: r.atomPointer == null ? null : r.atomPointer + pointer.slice(r.pointer.length) }));
  };
  index.records.push({ ...index.records.find(r => r.kind === 'state-field') });
  for (const omitSurface of [false, true]) {
    if (omitSurface) index.records.forEach(record => { delete record.surface; });
    validateSourceIndex(index);
    for (const pointer of [...index.records.flatMap(r => [r.pointer, r.pointer + '/default']), '/absent', '/aggregates/00', '/aggregates/0/commands/0/emissionBindings/Increased/amount'])
      assert.deepEqual(resolveSourcePointer(index, pointer), legacyResolve(index, pointer), pointer);
  }
  const row = index.records.find(r => r.kind === 'state-field');
  assert.deepEqual(resolveRecordSource(index, row, row.pointer + '/default'), legacyResolve({ records: [row] }, row.pointer + '/default')[0]);
});

test('v2 preserves knowledge records, aliases, surfaces and meaning without adding mapping identities', () => {
  const mappings = [mapping(aggregateFile, '', '/counter'), mapping(sliceFile, '', '/increments/0'),
    mapping(hostFile, '', '/hosts/counter', 'declaration', { authorFile: hostAuthorFile, template: 'counter-host/v1' })];
  const { snapshot, canonical, options, index } = fixture(mappings);
  const legacy = buildSourceIndex(snapshot, canonical, options);
  assert.equal(index.schemaVersion, 'truthsrc.source-index/v2');
  assert.equal(index.snapshot, legacy.snapshot);
  assert.deepEqual(semanticRecords(index), semanticRecords(legacy));
  assert.equal(validateSourceIndex(index), index);
  assert.deepEqual(index.representationMappings, mappings);
  assert.ok(Object.isFrozen(index.representationMappings));
  assert.ok(index.representationMappings.every(Object.isFrozen));
  const command = index.records.find(r => r.kind === 'command' && r.surface === '');
  assert.deepEqual(command.aliases, ['increment-alias']);
  const host = index.records.find(r => r.kind === 'effect-host' && r.surface === '');
  const sameIdentity = index.records.filter(r => r.identity === host.identity);
  assert.ok(sameIdentity.length > 1);
  assert.equal(sameIdentity.filter(r => r.surface === '').length, 1);
  assert.equal(new Set(sameIdentity.map(r => r.surface)).size, sameIdentity.length);
  assert.ok(Object.isFrozen(host.locationMapping));
  assert.throws(() => { host.locationMapping.label = 'changed'; }, TypeError);
  mappings[2].label = 'caller changed';
  mappings.push(mapping(pipelineFile, '', '/flows/0'));
  assert.equal(index.representationMappings.length, 3);
  assert.equal(host.locationMapping.label, 'compact declaration');
});

test('macro-root declarations never append suffixes, even for an entire atom or an empty author pointer', () => {
  const { index } = fixture([
    mapping(sliceFile, '', '/increments/0', 'declaration', { template: 'increment/v1' }),
    mapping(pipelineFile, '', '', 'declaration', { authorFile: 'contexts/example/flow.yaml', label: 'whole-document macro' }),
  ]);
  for (const pointer of ['/aggregates/0/commands/0', '/aggregates/0/commands/0/name', '/aggregates/0/commands/0/guards/0/expression',
    '/aggregates/0/events/0/foldAssignments/0/expr', '/aggregates/0/commands/0/emissionBindings/Increased/amount']) {
    const row = source(index, pointer);
    assert.equal(row.file, authorFile);
    assert.equal(row.atomPointer, '/increments/0');
    assert.equal(row.locationMapping.mappingPointer, '');
    assert.equal(row.locationMapping.mode, 'declaration');
    assert.equal(row.locationMapping.template, 'increment/v1');
    assert.equal(row.locationMapping.virtualPointer, row.virtualAtomPointer);
    assert.ok(!Object.hasOwn(row.locationMapping, 'span'));
  }
  for (const pointer of ['/pipelines/0', '/pipelines/0/payload/steps/0/command']) {
    const row = source(index, pointer);
    assert.equal(row.atomPointer, '');
    assert.equal(row.locationMapping.label, 'whole-document macro');
  }
});

test('many expanded fields and fold columns can share one authored scalar', () => {
  const { index } = fixture([
    mapping(aggregateFile, '/payload/stateFields/0', '/state/total'),
    mapping(sliceFile, '/events/Increased/foldAssignments/0', '/increments/0/delta'),
    mapping(sliceFile, '/decision/emissions/0/bindings/amount', '/increments/0/delta'),
  ]);
  const destinations = new Set(['name', 'type', 'default'].map(key => source(index, '/aggregates/0/stateFields/0/' + key).atomPointer));
  assert.deepEqual([...destinations], ['/state/total']);
  for (const key of ['slot', 'op', 'expr'])
    assert.equal(source(index, '/aggregates/0/events/0/foldAssignments/0/' + key).atomPointer, '/increments/0/delta');
  assert.equal(source(index, '/aggregates/0/commands/0/emissionBindings/Increased/amount').atomPointer, '/increments/0/delta');
  validateSourceIndex(index); // Author coordinates are deliberately NOT unique.
});

test('formal host parent records discover narrower internal-table leaf mappings', () => {
  const mappings = [
    mapping(hostFile, '', '/hosts/counter', 'declaration', { authorFile: hostAuthorFile, template: 'host/v1' }),
    mapping(hostFile, '/payload/implementation/rows/0', '/tables/increment/0', 'declaration', { authorFile: hostAuthorFile }),
    mapping(hostFile, '/payload/implementation/rows/0/expr', '/tables/increment/0/2', 'declaration', { authorFile: hostAuthorFile, label: 'expression cell' }),
  ];
  const { index } = fixture(mappings);
  assert.equal(index.records.filter(r => r.pointer.startsWith('/effectHosts/0')).length, 1);
  const host = index.records.find(r => r.pointer === '/effectHosts/0');
  assert.equal(host.atomPointer, '/hosts/counter');
  assert.equal(host.virtualAtomPointer, '/payload');
  const row = source(index, '/effectHosts/0/implementation/rows/0/expr');
  assert.equal(row.projectionPointer, '/effectHosts/0');
  assert.equal(row.virtualAtomPointer, '/payload/implementation/rows/0/expr');
  assert.equal(row.atomPointer, '/tables/increment/0/2');
  assert.equal(row.locationMapping.label, 'expression cell');
  assert.equal(source(index, '/effectHosts/0/implementation/rows/0/target').atomPointer, '/tables/increment/0');
  assert.equal(source(index, '/effectHosts/0/id').atomPointer, '/hosts/counter');
  assert.deepEqual(resolveRecordSource(index, host, row.pointer), row);
  assert.equal(host.atomPointer, '/hosts/counter'); // Resolution does not mutate the saved base.
});

test('subtrees append only virtual suffixes and can override a declaration-mapped parent', () => {
  const { index } = fixture([
    mapping(hostFile, '', '/host-scalar', 'declaration', { authorFile: hostAuthorFile }),
    mapping(hostFile, '/payload/implementation/config', '/verbatim/options', 'subtree', { authorFile: 'contexts/example/config.yaml' }),
    mapping(pipelineFile, '', '/flow', 'subtree'),
  ]);
  const pointer = '/effectHosts/0/implementation/config';
  const parent = source(index, pointer);
  assert.equal(parent.atomPointer, '/verbatim/options');
  const child = source(index, pointer + '/nested/enabled');
  assert.equal(child.file, 'contexts/example/config.yaml');
  assert.equal(child.atomPointer, '/verbatim/options/nested/enabled');
  assert.deepEqual(resolveRecordSource(index, parent, child.pointer), child);
  assert.equal(source(index, '/effectHosts/0/implementation/configuration/enabled').atomPointer, '/host-scalar');
  assert.equal(source(index, '/pipelines/0/payload/steps/0/command').atomPointer, '/flow/payload/steps/0/command');
});

test('longest virtual prefix is segment-aware, escape-safe, order-independent and file-local', () => {
  const mappings = [
    mapping(hostFile, '/payload/implementation/rows/1', '/row-one'),
    mapping(hostFile, '/payload/implementation/rows/10/expr', '/tenth-cell'),
    mapping(hostFile, '/payload/implementation/a~1b~0c', '/authored/a~1b~0c', 'subtree'),
    mapping(aggregateFile, '/payload', '/other-file', 'subtree'),
    mapping(hostFile, '/payload', '/host-root'),
  ];
  for (const order of [mappings, mappings.toReversed()]) {
    const { index } = fixture(order);
    assert.equal(source(index, '/effectHosts/0/implementation/rows/1/expr').atomPointer, '/row-one');
    assert.equal(source(index, '/effectHosts/0/implementation/rows/10/expr').atomPointer, '/tenth-cell');
    assert.equal(source(index, '/effectHosts/0/implementation/rows/10/target').atomPointer, '/host-root');
    assert.equal(source(index, '/effectHosts/0/implementation/a~1b~0c/value').atomPointer, '/authored/a~1b~0c/value');
    assert.equal(source(index, '/aggregates/0/stateFields/1/default').atomPointer, '/other-file/stateFields/1/default');
  }
});

test('a leaf mapping works without any parent mapping and keeps unmapped physical files', () => {
  const { index } = fixture([mapping(hostFile, '/payload/implementation/rows/0/expr', '/cells/0', 'declaration', { authorFile: 'contexts/example/tables.yaml' })]);
  const host = index.records.find(r => r.pointer === '/effectHosts/0');
  assert.equal(host.file, hostAuthorFile);
  assert.equal(host.atomPointer, '/payload');
  assert.ok(!Object.hasOwn(host, 'locationMapping'));
  assert.equal(source(index, '/effectHosts/0/implementation/rows/0/expr').file, 'contexts/example/tables.yaml');
  const unmapped = source(index, '/aggregates/0/stateFields/0/default');
  assert.equal(unmapped.file, authorFile);
  assert.equal(unmapped.atomPointer, '/payload/stateFields/0/default');
  assert.ok(!Object.hasOwn(unmapped, 'locationMapping'));
  assert.equal(source(index, '/workshop').file, 'system.yaml');
  validateSourceIndex(index);
});

test('compiler-derived containers remain unresolved even under root expansion mappings', () => {
  const { index } = fixture([mapping(aggregateFile, '', '/counter'), mapping(sliceFile, '', '/increments/0')]);
  for (const pointer of ['/aggregates/0/commands', '/aggregates/0/events', '/aggregates/0/commands/0/emissionBindings', '/sessions/0/session']) {
    const row = source(index, pointer);
    assert.equal(row.relation, 'unresolved');
    assert.equal(row.atomPointer, null);
    assert.equal(row.virtualAtomPointer, null);
    assert.ok(!Object.hasOwn(row, 'locationMapping'));
  }
  assert.deepEqual(resolveSourcePointer(index, '/unknown'), []);
});

test('serialized v2 receipts resolve across snapshot reordering using the current record virtual base', () => {
  const previous = fixture([mapping(aggregateFile, '/payload/stateFields/0', '/state/total')]).index;
  const current = JSON.parse(JSON.stringify(fixture([
    mapping(aggregateFile, '/payload/stateFields/1', '/fields/total', 'declaration', { authorFile: 'contexts/example/counter.compact.yaml' }),
  ], { reverseFields: true }).index));
  validateSourceIndex(current);
  assert.notEqual(previous.snapshot, current.snapshot);
  const old = source(previous, '/aggregates/0/stateFields/0/default');
  const matches = current.records.filter(r => r.identity === old.identity && r.kind === old.kind && r.surface === old.surface);
  assert.equal(matches.length, 1);
  const record = matches[0], suffix = old.pointer.slice(old.projectionPointer.length);
  const row = resolveRecordSource(current, record, record.pointer + suffix);
  assert.equal(row.pointer, '/aggregates/0/stateFields/1/default');
  assert.equal(row.file, 'contexts/example/counter.compact.yaml');
  assert.equal(row.atomPointer, '/fields/total');
  assert.equal(row.virtualAtomPointer, '/payload/stateFields/1/default');
  assert.equal(resolveRecordSource(previous, previous.records.find(r => r.pointer === old.projectionPointer), old.pointer).atomPointer, '/state/total');
  assert.throws(() => resolveRecordSource(current, record, '/aggregates/0/stateFields/10/default'), /SOURCE_INDEX:.*outside/);
});

test('representation metadata never collapses genuinely duplicate knowledge records', () => {
  const { index } = fixture([mapping(aggregateFile, '/payload/stateFields/0', '/state/total')]);
  const record = index.records.find(r => r.pointer === '/aggregates/0/stateFields/0');
  index.records.push({ ...record });
  validateSourceIndex(index);
  const rows = resolveSourcePointer(index, '/aggregates/0/stateFields/0/default');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], rows[1]);
});

test('invalid mapping transport, paths, pointers, modes and virtual duplicates are rejected', async t => {
  const good = mapping(hostFile, '/payload', '/host');
  const invalid = [null, {}, [null], [{ ...good, extra: true }], [{ ...good, span: { line: 1 } }],
    [{ ...good, mode: 'copy' }], [{ ...good, label: '' }], [{ ...good, label: 'a\nb' }],
    [{ ...good, template: {} }], [{ ...good, template: '' }],
    [good, { ...good, authorPointer: '/somewhere-else', mode: 'subtree' }]];
  for (const field of Object.keys(good)) {
    const missing = { ...good }; delete missing[field]; invalid.push([missing]);
  }
  for (const field of ['file', 'authorFile']) for (const value of ['', '/absolute.yaml', '../outside.yaml', './local.yaml', 'a/../b.yaml',
    'a//b.yaml', 'a/', 'C:/outside.yaml', 'a\\b.yaml', 'a\0b.yaml', 'https://host/file.yaml', 12, null]) invalid.push([{ ...good, [field]: value }]);
  for (const field of ['pointer', 'authorPointer']) for (const value of ['#/payload', 'payload', '/bad~', '/bad~2escape', 12, null])
    invalid.push([{ ...good, [field]: value }]);
  const { snapshot, canonical, options, index } = fixture([good]);
  for (const [i, representationMappings] of invalid.entries()) await t.test('invalid mapping ' + i, () => {
    assert.throws(() => buildSourceIndex(snapshot, canonical, { ...options, representationMappings }), /SOURCE_INDEX:/);
    assert.throws(() => validateSourceIndex({ ...index, representationMappings }), /SOURCE_INDEX:/);
  });
  let called = false;
  const accessor = { ...good };
  Object.defineProperty(accessor, 'label', { enumerable: true, get() { called = true; return 'unsafe'; } });
  assert.throws(() => fixture([accessor]), /SOURCE_INDEX:/);
  assert.equal(called, false);
});

test('v2 receipt validation rejects missing mappings and inconsistent saved locations', () => {
  const { index } = fixture([mapping(hostFile, '/payload', '/host')]);
  const rowIndex = index.records.findIndex(r => r.pointer === '/effectHosts/0');
  for (const change of [
    value => { value.schemaVersion = 'truthsrc.source-index/v3'; },
    value => { delete value.representationMappings; },
    value => { value.representationMappings = []; },
    value => { value.schemaVersion = 'truthsrc.source-index/v1'; },
    value => { value.records[rowIndex].file = '../outside.yaml'; },
    value => { value.records[rowIndex].atomPointer = '/host/payload'; },
    value => { value.records[rowIndex].virtualAtomPointer = '/payload/id'; },
    value => { delete value.records[rowIndex].virtualFile; },
    value => { delete value.records[rowIndex].virtualAtomPointer; },
    value => { delete value.records[rowIndex].locationMapping; },
    value => { value.records[rowIndex].locationMapping.span = { line: 3 }; },
    value => { value.records[rowIndex].locationMapping.label = 'fictional'; },
    value => { value.records[0].atomPointer = '/invented'; },
    value => { value.records[0].locationMapping = value.records[rowIndex].locationMapping; },
  ]) {
    const receipt = JSON.parse(JSON.stringify(index));
    change(receipt);
    assert.throws(() => validateSourceIndex(receipt), /SOURCE_INDEX:/);
  }
  validateSourceIndex(JSON.parse(JSON.stringify(index)));
});
