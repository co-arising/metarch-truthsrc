import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { ProductError } from '../lib/products/request.mjs';
import { validateJournalReadside } from '../lib/products/journal-readside.mjs';
import { validateServiceDeployment } from '../lib/products/service-deployment.mjs';
import { transformMicroDocument } from '../lib/author-micro.mjs';
import { serviceArtifactFixture } from './service-artifact-fixture.mjs';

const source = { document: 'domain', pointer: '/artifactContracts/0' };
const ref = (kind, owner, id, context = 'measurement') => ({ context, kind, owner, id });
const artifact = request => request.documents.find(d => d.id === 'domain').value.artifactContracts[0];
const synchronize = request => {
  request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts[0] = {
    ...structuredClone(artifact(request)), source
  };
};
const column = (name, type = 'text', nullable = false) => ({ name, type, size: type === 'text' ? 128 : null, nullable });
function fixture() {
  const request = serviceArtifactFixture();
  const service = artifact(request).deployment.service;
  const store = service.projectionStore = {
    schemaVersion: 'truthsrc.journal-readside/v1', id: 'GaugeJournal', version: '1', tablePrefix: 'gauge_rs',
    pollIntervalMillis: 100, closeTimeoutMillis: 5000,
    streams: [{ kind: 'gauge', aggregate: ref('aggregate', [], 'Gauge'), identity: ref('state-field', ['Gauge'], 'status'),
      allowEmptyIdentity: false, eventIdentities: [{ event: ref('event', ['Gauge'], 'Observed'), field: ref('event-slot', ['Gauge', 'Observed'], 'observationId') }] }],
    technicalKinds: ['workflow'],
    indexes: [{ id: 'Pending', table: 'pending',
      columns: [column('operation_key', 'digest'), column('operation_id'), column('flow'), column('account_id'),
        column('attempts', 'long'), column('confirmed', 'boolean'), column('payload_bytes', 'bytes', true)],
      key: ['operation_key'], queries: [{ id: 'by_owner', where: ['account_id'], orderBy: ['operation_id', 'flow', 'operation_key'] }] }]
  };
  synchronize(request);
  const layout = request.documents.find(d => d.id === 'references').value.layout;
  return { request, service, store, layout };
}
const validate = f => validateJournalReadside(f.store, f.layout, source);
const productError = e => e instanceof ProductError;
const rejected = f => {
  synchronize(f.request);
  const before = structuredClone(f);
  assert.throws(() => validate(f), productError);
  assert.throws(() => validateServiceDeployment(f.service, artifact(f.request), f.layout, source), productError);
  const result = compileProductSet(f.request);
  assert.equal(result.result, null);
  assert.ok(result.diagnostics.length, JSON.stringify(result));
  assert.deepEqual(f, before);
};

test('explicit read-side declaration compiles without mutation, defaults or runtime certification', () => {
  const f = fixture(), before = structuredClone(f);
  assert.equal(validate(f), f.store);
  assert.equal(validateServiceDeployment(f.service, artifact(f.request), f.layout, source), f.service);
  const compiled = compileProductSet(f.request);
  assert.deepEqual(compiled.diagnostics, []);
  assert.deepEqual(compiled, compileProductSet(f.request));
  assert.deepEqual(compiled.result.products.find(p => p.id === 'artifact-contract').payload.artifacts[0].deployment.service.projectionStore, f.store);
  assert.equal(compiled.result.readiness.runnable, false);
  assert.deepEqual(f, before);
});

test('minimal synthetic nominal-text layout supports actual typed identity carriers', () => {
  for (const id of ['AccountId', 'FundOrderId', 'PlanId']) {
    const f = fixture(), stream = f.store.streams[0];
    const nominal = ref('type', [], id);
    const text = { form: 'primitive', name: 'string' };
    const layout = { contexts: ['measurement'], declarations: [
      { ref: stream.aggregate, valueType: null },
      { ref: nominal, valueType: text },
      { ref: stream.identity, valueType: { form: 'nominal', ref: nominal } },
      { ref: stream.eventIdentities[0].event, valueType: null },
      { ref: stream.eventIdentities[0].field, valueType: { form: 'nominal', ref: nominal } }
    ] };
    f.store.indexes = []; f.store.technicalKinds = [];
    const before = structuredClone({ store: f.store, layout });
    assert.equal(validateJournalReadside(f.store, layout, source), f.store);
    assert.deepEqual({ store: f.store, layout }, before);
    // A primitive string event carrier is also admitted, without inventing a cast.
    layout.declarations.at(-1).valueType = text;
    assert.equal(validateJournalReadside(f.store, layout, source), f.store);
  }
});

test('nominal aliases resolve transitively and reject missing, cyclic, record and numeric carriers', () => {
  for (const bad of ['missing', 'cycle', 'record', 'numeric', 'optional', 'wrong-kind']) {
    const f = fixture();
    const identity = f.layout.declarations.find(d => d.ref.kind === 'state-field' && d.ref.id === 'status');
    const nominal = ref('type', [], 'IdentityAlias');
    identity.valueType = { form: 'nominal', ref: nominal };
    const row = { ref: nominal, valueType: { form: 'nominal', ref: ref('type', [], 'WireRatio') } };
    f.layout.declarations.push(row);
    assert.equal(validate(f), f.store);
    if (bad === 'missing') row.valueType.ref.id = 'Missing';
    if (bad === 'cycle') row.valueType.ref = nominal;
    if (bad === 'record') row.valueType = { form: 'record', members: [] };
    if (bad === 'numeric') row.valueType = { form: 'primitive', name: 'integer' };
    if (bad === 'optional') row.valueType = { form: 'optional', element: { form: 'primitive', name: 'string' } };
    if (bad === 'wrong-kind') row.valueType.ref = f.store.streams[0].identity;
    assert.throws(() => validate(f), productError, bad);
  }
});

const nodes = [
  ['store', f => f.store], ['stream', f => f.store.streams[0]],
  ['event identity', f => f.store.streams[0].eventIdentities[0]],
  ['aggregate ref', f => f.store.streams[0].aggregate], ['identity ref', f => f.store.streams[0].identity],
  ['event ref', f => f.store.streams[0].eventIdentities[0].event], ['event slot ref', f => f.store.streams[0].eventIdentities[0].field],
  ['index', f => f.store.indexes[0]], ['column', f => f.store.indexes[0].columns[0]], ['query', f => f.store.indexes[0].queries[0]]
];
for (const [name, select] of nodes) {
  test('closed ' + name + ' rejects unknown and every missing field', () => {
    const extra = fixture(); select(extra).sql = 'injected()'; rejected(extra);
    for (const key of Object.keys(select(fixture()))) {
      const f = fixture(); delete select(f)[key]; rejected(f);
    }
  });
}
for (const [name, mutate] of [
  ['null store', f => { f.store = f.service.projectionStore = null; }],
  ['implicit store version', f => { f.store.schemaVersion = 'truthsrc.journal-readside'; }],
  ['unknown store version', f => { f.store.schemaVersion = 'truthsrc.journal-readside/v2'; }],
  ['numeric schema version', f => { f.store.schemaVersion = 1; }],
  ['nullable stream', f => { f.store.streams = [null]; }],
  ['nonboolean empty identity', f => { f.store.streams[0].allowEmptyIdentity = 'false'; }],
  ['unknown aggregate', f => { f.store.streams[0].aggregate.id = 'Missing'; }],
  ['nonaggregate reference', f => { f.store.streams[0].aggregate = ref('type', [], 'Observation'); }],
  ['unknown state field', f => { f.store.streams[0].identity.id = 'missing'; }],
  ['event slot instead of state field', f => { f.store.streams[0].identity = f.store.streams[0].eventIdentities[0].field; }],
  ['numeric state field', f => { f.store.streams[0].identity.id = 'count'; }],
  ['nominal decimal state field', f => { f.store.streams[0].identity.id = 'level'; }],
  ['map state field', f => { f.store.streams[0].identity.id = 'stock'; }],
  ['malformed reference owner', f => { f.store.streams[0].identity.owner = []; }],
  ['unknown event', f => { f.store.streams[0].eventIdentities[0].event.id = 'Missing'; }],
  ['unknown event slot', f => { f.store.streams[0].eventIdentities[0].field.id = 'missing'; }],
  ['numeric event slot', f => { f.store.streams[0].eventIdentities = [{ event: ref('event', ['Gauge'], 'Adjusted'), field: ref('event-slot', ['Gauge', 'Adjusted'], 'steps') }]; }],
  ['nominal decimal event slot', f => { f.store.streams[0].eventIdentities[0].field.id = 'level'; }],
  ['wrong event for slot', f => { f.store.streams[0].eventIdentities[0].event.id = 'Adjusted'; }],
  ['state field instead of event slot', f => { f.store.streams[0].eventIdentities[0].field = f.store.streams[0].identity; }],
  ['null event identity', f => { f.store.streams[0].eventIdentities = [null]; }],
  ['duplicate event identities', f => { f.store.streams[0].eventIdentities.push(structuredClone(f.store.streams[0].eventIdentities[0])); }],
  ['duplicate stream kinds', f => { f.store.streams.push(structuredClone(f.store.streams[0])); }],
  ['duplicate aggregates under different kinds', f => { f.store.streams.push({ ...structuredClone(f.store.streams[0]), kind: 'other' }); }],
  ['duplicate technical kinds', f => { f.store.technicalKinds.push('workflow'); }],
  ['overlapping technical kind', f => { f.store.technicalKinds.push('gauge'); }],
  ['null index', f => { f.store.indexes = [null]; }],
  ['duplicate index ids', f => { f.store.indexes.push({ ...structuredClone(f.store.indexes[0]), table: 'other' }); }],
  ['case-colliding index ids', f => { f.store.indexes.push({ ...structuredClone(f.store.indexes[0]), id: 'pending', table: 'other' }); }],
  ['duplicate index tables', f => { f.store.indexes.push({ ...structuredClone(f.store.indexes[0]), id: 'Other' }); }],
  ['prefixed index table', f => { f.store.indexes[0].table = 'gauge_rs_pending'; }],
  ['overlong combined table name', f => { f.store.tablePrefix = 'a'.repeat(57); }],
  ['null column', f => { f.store.indexes[0].columns[0] = null; }],
  ['duplicate column', f => { f.store.indexes[0].columns.push({ ...f.store.indexes[0].columns[0], nullable: true }); }],
  ['unknown column type', f => { f.store.indexes[0].columns[0].type = 'varchar'; }],
  ['nonboolean nullable', f => { f.store.indexes[0].columns[0].nullable = 0; }],
  ['unknown key', f => { f.store.indexes[0].key = ['missing']; }],
  ['duplicate key', f => { f.store.indexes[0].key.push('operation_key'); }],
  ['nullable key', f => { f.store.indexes[0].columns[0].nullable = true; }],
  ['bytes key', f => { f.store.indexes[0].columns[0].type = 'bytes'; }],
  ['null query', f => { f.store.indexes[0].queries = [null]; }],
  ['duplicate query', f => { f.store.indexes[0].queries.push(structuredClone(f.store.indexes[0].queries[0])); }],
  ['unknown where column', f => { f.store.indexes[0].queries[0].where = ['missing']; }],
  ['duplicate where column', f => { f.store.indexes[0].queries[0].where = ['account_id', 'account_id']; }],
  ['unknown order column', f => { f.store.indexes[0].queries[0].orderBy.push('missing'); }],
  ['duplicate order column', f => { f.store.indexes[0].queries[0].orderBy.push('operation_key'); }],
  ['missing hash tie breaker', f => { f.store.indexes[0].queries[0].orderBy = ['operation_id', 'flow']; }],
  ['partial composite key', f => { f.store.indexes[0].key.push('account_id'); }],
  ['query equals its index', f => { f.store.indexes[0].queries[0].id = 'pending'; }],
  ['reserved query API', f => { f.store.indexes[0].queries[0].id = 'row'; }],
  ['reserved companion type', f => { f.store.indexes[0].id = 'Payload'; }],
  ['reserved Session API', f => { f.store.indexes[0].id = 'OwnedRows'; }],
  ['generated put member collision', f => { f.store.indexes.push({ ...structuredClone(f.store.indexes[0]), id: 'PutPending', table: 'other' }); }],
  ['concatenated query member collision', f => {
    f.store.indexes[0].id = 'Ab'; f.store.indexes[0].queries[0].id = 'cd';
    f.store.indexes.push({ ...structuredClone(f.store.indexes[0]), id: 'Abc', table: 'other', queries: [{ id: 'd', where: [], orderBy: ['operation_key'] }] });
  }]
]) test('journal read-side rejects ' + name, () => { const f = fixture(); mutate(f); rejected(f); });

for (const [name, get, min, max] of [
  ['streams', f => [f.store, 'streams'], 1, 64], ['technicalKinds', f => [f.store, 'technicalKinds'], 0, 64],
  ['indexes', f => [f.store, 'indexes'], 0, 32], ['eventIdentities', f => [f.store.streams[0], 'eventIdentities'], 0, 1024],
  ['columns', f => [f.store.indexes[0], 'columns'], 1, 64], ['key', f => [f.store.indexes[0], 'key'], 1, 8],
  ['queries', f => [f.store.indexes[0], 'queries'], 0, 64], ['where', f => [f.store.indexes[0].queries[0], 'where'], 0, 64],
  ['orderBy', f => [f.store.indexes[0].queries[0], 'orderBy'], 1, 64]
]) test(name + ' is an explicit bounded array', () => {
  for (const invalid of [null, {}, 'none', ...(min ? [[]] : [])]) {
    const f = fixture(), [row, key] = get(f); row[key] = invalid; rejected(f);
  }
  const f = fixture(), [row, key] = get(f);
  row[key] = Array.from({ length: max + 1 }, () => structuredClone(row[key][0])); rejected(f);
});

for (const [name, select] of [
  ['table prefix', f => [f.store, 'tablePrefix']], ['table suffix', f => [f.store.indexes[0], 'table']],
  ['column', f => [f.store.indexes[0].columns[1], 'name']], ['query', f => [f.store.indexes[0].queries[0], 'id']]
]) test(name + ' rejects SQL injection, uppercase, keywords and trailing line terminators', () => {
  for (const value of ['Bad', 'has-hyphen', 'x.y', 'x y', 'x;drop', 'x--', '"x"', '`x`', 'x/*comment*/', '_x', '1x', 'select', 'class', '', 'a'.repeat(64), 'x\n', 'x\r', 'x ', 'x ', 'x\t', 'x\0']) {
    const f = fixture(), [row, key] = select(f); row[key] = value; rejected(f);
  }
});
for (const [name, select] of [['store', f => f.store], ['index', f => f.store.indexes[0]]]) test(name + ' id is a bounded nonkeyword Scala stem', () => {
  for (const id of [null, 1, '', 'x.y', 'x-y', '_', 'class', 'type', 'forSome', 'x\n', 'x ', 'a'.repeat(65)]) {
    const f = fixture(); select(f).id = id; rejected(f);
  }
});
for (const table of ['namespace', 'stream', 'event']) test('reserved internal table ' + table, () => {
  const f = fixture(); f.store.indexes[0].table = table; rejected(f);
});
for (const name of ['namespace', 'copy', 'equals', 'productiterator']) test('reserved column ' + name, () => {
  const f = fixture(); f.store.indexes[0].columns[1].name = name; rejected(f);
});
for (const slot of ['stream', 'technical']) test(slot + ' PID kind is bounded and cannot inject separators or whitespace', () => {
  for (const value of [null, 1, '', 'x|y', 'x:y', 'x/y', 'x y', 'x\n', 'x ', 'a'.repeat(65)]) {
    const f = fixture();
    if (slot === 'stream') f.store.streams[0].kind = value; else f.store.technicalKinds[0] = value;
    rejected(f);
  }
});

test('exact interval, version and column-size types are enforced independently', () => {
  for (const [key, min] of [['pollIntervalMillis', 10], ['closeTimeoutMillis', 1]]) {
    for (const value of [null, true, '10', min - 1, 60001, 10.5, NaN, Infinity]) {
      const f = fixture(); f.store[key] = value;
      rejected(f);
    }
    for (const value of [min, 60000]) { const f = fixture(); f.store[key] = value; assert.equal(validate(f), f.store); }
  }
  for (const value of [null, 1, true, '', ' \n ', 'v'.repeat(65)]) { const f = fixture(); f.store.version = value; rejected(f); }
  for (const value of ['1', 'v'.repeat(64)]) { const f = fixture(); f.store.version = value; assert.equal(validate(f), f.store); }
  for (const value of [null, true, '128', 0, 2049, 1.5]) {
    const f = fixture(); f.store.indexes[0].columns[1].size = value; rejected(f);
  }
  for (const value of [1, 2048]) { const f = fixture(); f.store.indexes[0].columns[1].size = value; assert.equal(validate(f), f.store); }
  for (const type of ['digest', 'long', 'boolean', 'bytes']) {
    const f = fixture(); f.store.indexes[0].columns[1] = { name: 'operation_id', type, size: 128, nullable: false }; rejected(f);
  }
});

test('current context and aggregate/event ownership are checked even for declared foreign references', () => {
  for (const target of ['aggregate', 'identity', 'event', 'field']) {
    const f = fixture(), stream = f.store.streams[0];
    const r = target === 'aggregate' ? stream.aggregate : target === 'identity' ? stream.identity : stream.eventIdentities[0][target];
    const original = f.layout.declarations.find(d => JSON.stringify(d.ref) === JSON.stringify(r));
    const foreign = { ...structuredClone(original), ref: { ...r, context: 'other' } };
    f.layout.contexts.push('other'); f.layout.declarations.push(foreign);
    Object.assign(r, foreign.ref);
    assert.throws(() => validate(f), productError, target);
  }
  for (const target of ['identity', 'event', 'field']) {
    const f = fixture(), stream = f.store.streams[0];
    const r = target === 'identity' ? stream.identity : stream.eventIdentities[0][target];
    const original = f.layout.declarations.find(d => JSON.stringify(d.ref) === JSON.stringify(r));
    const foreign = { ...structuredClone(original), ref: { ...r, owner: ['Other', ...r.owner.slice(1)] } };
    f.layout.declarations.push({ ref: ref('aggregate', [], 'Other'), valueType: null }, foreign);
    Object.assign(r, foreign.ref);
    assert.throws(() => validate(f), productError, target);
  }
  const ambiguous = fixture(); ambiguous.layout.contexts.push('other');
  assert.throws(() => validateJournalReadside(ambiguous.store, ambiguous.layout, { document: 'unbound', pointer: '' }), productError);
});

test('empty optional lists, composite paging keys and query-local names are admitted', () => {
  const f = fixture(), index = f.store.indexes[0];
  f.store.technicalKinds = []; f.store.streams[0].eventIdentities = []; f.store.streams[0].allowEmptyIdentity = true;
  index.key.push('flow'); index.queries[0].where = [];
  f.store.indexes.push({ ...structuredClone(index), id: 'Completed', table: 'completed' });
  synchronize(f.request);
  assert.equal(validate(f), f.store);
  assert.deepEqual(compileProductSet(f.request).diagnostics, []);
  index.queries = []; assert.equal(validate(f), f.store);
  f.store.indexes = []; assert.equal(validate(f), f.store);
});

for (const side of ['canonical', 'binding']) test('projection store requires synchronized ' + side + ' artifact inputs', () => {
  for (const change of ['version', 'absence']) {
    const f = fixture();
    const a = side === 'canonical' ? artifact(f.request) : f.request.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts[0];
    if (change === 'version') a.deployment.service.projectionStore.version = '2'; else delete a.deployment.service.projectionStore;
    const result = compileProductSet(f.request);
    assert.equal(result.result, null);
    assert.ok(result.diagnostics.some(d => d.code === 'PRODUCT_PAYLOAD_MISMATCH'), JSON.stringify(result.diagnostics));
  }
});

test('absence retains old declaration bytes and compilation semantics', () => {
  const old = serviceArtifactFixture(), restored = fixture();
  delete restored.service.projectionStore; synchronize(restored.request);
  assert.equal(JSON.stringify(restored.request), JSON.stringify(old));
  const compiled = compileProductSet(restored.request);
  assert.deepEqual(compiled.diagnostics, []);
  assert.deepEqual(compiled, compileProductSet(old));
  assert.ok(!Object.hasOwn(compiled.result.products.find(p => p.id === 'artifact-contract').payload.artifacts[0].deployment.service, 'projectionStore'));
});

test('structural schema mirrors exact fields, bounds, types, references and safe identifiers', () => {
  const dir = new URL('../schema/', import.meta.url);
  const schema = JSON.parse(readFileSync(new URL('journal-readside-v1.schema.json', dir), 'utf8'));
  const service = JSON.parse(readFileSync(new URL('play-service-v1.schema.json', dir), 'utf8'));
  assert.equal(schema.$id, 'urn:truthsrc:journal-readside:v1');
  assert.equal(schema.$ref, '#/$defs/store');
  assert.ok(!service.$defs.service.required.includes('projectionStore'));
  assert.deepEqual(service.$defs.service.properties.projectionStore, { $ref: schema.$id + '#/$defs/store' });
  for (const name of ['store', 'stream', 'eventIdentity', 'index', 'column', 'query']) {
    const row = schema.$defs[name];
    assert.equal(row.type, 'object'); assert.equal(row.additionalProperties, false);
    assert.deepEqual([...row.required].sort(), Object.keys(row.properties).sort());
  }
  const p = schema.$defs.store.properties;
  assert.equal(p.schemaVersion.const, 'truthsrc.journal-readside/v1');
  assert.deepEqual(p.pollIntervalMillis, { type: 'integer', minimum: 10, maximum: 60000 });
  assert.deepEqual(p.closeTimeoutMillis, { type: 'integer', minimum: 1, maximum: 60000 });
  assert.deepEqual(p.version, { type: 'string', minLength: 1, maxLength: 64, pattern: '\\S' });
  for (const [row, min, max] of [[p.streams, 1, 64], [p.technicalKinds, 0, 64], [p.indexes, 0, 32],
    [schema.$defs.stream.properties.eventIdentities, 0, 1024], [schema.$defs.index.properties.columns, 1, 64],
    [schema.$defs.index.properties.key, 1, 8], [schema.$defs.index.properties.queries, 0, 64],
    [schema.$defs.query.properties.where, 0, 64], [schema.$defs.query.properties.orderBy, 1, 64]]) {
    assert.equal(row.type, 'array'); assert.equal(row.minItems, min); assert.equal(row.maxItems, max); assert.equal(row.uniqueItems, true);
  }
  assert.deepEqual(schema.$defs.column.properties.type.enum, ['text', 'digest', 'long', 'boolean', 'bytes']);
  assert.deepEqual(schema.$defs.column.then.properties.size, { type: 'integer', minimum: 1, maximum: 2048 });
  assert.deepEqual(schema.$defs.column.else.properties.size, { type: 'null' });
  for (const [name, valid] of [['scalaStem', 'Pending'], ['sqlName', 'operation_key'], ['kind', 'fund-order']]) {
    const pattern = new RegExp(schema.$defs[name].pattern, 'u');
    assert.ok(pattern.test(valid));
    for (const suffix of ['\n', '\r', ' ', ' ', ' ', ';drop', '.', '|']) assert.ok(!pattern.test(valid + suffix));
  }
  assert.ok(!new RegExp(schema.$defs.sqlName.pattern, 'u').test('OperationKey'));
  for (const [name, kind, depth] of [['aggregateReference', 'aggregate', 0], ['identityReference', 'state-field', 1], ['eventReference', 'event', 1], ['eventSlotReference', 'event-slot', 2]]) {
    const r = schema.$defs[name];
    assert.equal(r.$ref, 'urn:truthsrc:product-compilation:v1#/$defs/reference');
    assert.equal(r.properties.kind.const, kind);
    assert.deepEqual(r.properties.owner, { minItems: depth, maxItems: depth });
  }
  // Audit every newly shipped reference, using the same ID discovery as the loader.
  const schemas = new Map(readdirSync(dir).filter(f => f.endsWith('.schema.json')).map(f => {
    const value = JSON.parse(readFileSync(new URL(f, dir), 'utf8')); return [value.$id, value];
  }));
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      const [uri, pointer] = value.$ref.split('#');
      const root = uri ? schemas.get(uri) : schema;
      assert.ok(root, value.$ref);
      const target = (pointer || '').split('/').slice(1).reduce((v, key) => v?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], root);
      assert.ok(target, value.$ref);
    }
    Object.values(value).forEach(visit);
  };
  visit(schema);
});

test('existing author-micro schema loader resolves service/store refs through compact and expand', () => {
  const f = fixture();
  const doc = { kind: 'formal-product', family: 'artifact-contract', payload: structuredClone(artifact(f.request)) };
  const compact = transformMicroDocument(doc, { mode: 'compact' });
  const store = compact.doc.payload.deployment.service.projectionStore;
  assert.equal(typeof store.streams[0].aggregate, 'string');
  assert.equal(typeof store.streams[0].identity, 'string');
  assert.equal(typeof store.streams[0].eventIdentities[0].event, 'string');
  assert.equal(typeof store.streams[0].eventIdentities[0].field, 'string');
  assert.deepEqual(transformMicroDocument(compact.doc, { mode: 'expand' }).doc, doc);
});
