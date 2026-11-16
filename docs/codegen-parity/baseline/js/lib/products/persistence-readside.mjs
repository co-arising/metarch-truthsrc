import { array, at, detach, equal, fail, object, text, unique } from './request.mjs';
import { declaration } from '../domain-products/values.mjs';
import { owner, reference, refKey } from '../domain-products/references.mjs';
import { journalScalaName, journalSqlName, validateJournalIndexes } from './journal-readside.mjs';
import { PROFILES } from './registry.mjs';

export const PERSISTENCE_BINDING_SCHEMA = 'truthsrc.persistence-readside-binding/v1';
export const PERSISTENCE_SCHEMA = 'truthsrc.persistence-readside-contract/v1';
export const PERSISTENCE_DEPENDENCIES = PROFILES['persistence-readside-contract'].requires;
const reject = (code, message, source) => fail('PERSISTENCE_READSIDE_' + code, message, source);
const token = (value, source, max = 128) => {
  text(value, source);
  if (value.length > max || !/^[A-Za-z][A-Za-z0-9._-]*$(?![\s\S])/u.test(value))
    reject('IDENTITY', 'bounded explicit ASCII identity required', source);
  return value;
};
const integer = (value, min, max, source) => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max)
    reject('BOUND', `integer in ${min}..${max} required`, source);
  return value;
};
const version = (value, source) => {
  text(value, source);
  if (value.length > 64 || value !== value.trim() || /[\p{Cc}\p{Cf}]/u.test(value))
    reject('VERSION', 'bounded explicit storage/source version required', source);
  return value;
};
const same = (actual, expected, code, message, source) => {
  if (!equal(actual, expected)) reject(code, message, source);
};

/** Rebuild finite storage obligations from the actual domain products, never Scala text. */
export function compilePersistenceReadside(rawBinding, rawCanonical, rawProducts) {
  const { binding, canonical, products } = detach({ binding: rawBinding, canonical: rawCanonical, products: rawProducts });
  object(binding, ['id', 'schemaVersion', 'value'], at('persistence-binding'));
  text(binding.id, at('persistence-binding'));
  const source = pointer => at(binding.id, pointer), b = binding.value;
  object(b, ['schemaVersion', 'id', 'version', 'context', 'aggregate', 'wire', 'store'], source(''));
  if (binding.schemaVersion !== PERSISTENCE_BINDING_SCHEMA || b.schemaVersion !== PERSISTENCE_BINDING_SCHEMA || b.version !== '1')
    reject('VERSION', 'explicit persistence-readside binding/v1 version 1 required', source(''));
  token(b.id, source('/id')); text(b.context, source('/context'));
  object(products, PERSISTENCE_DEPENDENCIES.map(p => p.id), source(''));
  const layout = products['reference-layout'];
  same(layout.contexts, [b.context], 'CONTEXT', 'exactly one declared context required', source('/context'));
  if (canonical.schemaVersion !== 'truthsrc/v1' || canonical.value?.schemaVersion !== 'truthsrc/v1')
    reject('CANONICAL', 'actual canonical document required', source(''));
  text(canonical.id, source(''));
  if (canonical.value.context !== undefined && canonical.value.context !== b.context)
    reject('CONTEXT', 'binding and canonical context differ', source('/context'));
  if (canonical.value.contexts !== undefined)
    same(canonical.value.contexts, [b.context], 'CONTEXT', 'canonical must have the sole binding context', source('/context'));
  function find(ref, location) {
    reference(ref, location);
    const row = declaration(ref, layout, location);
    if (row.ref.context !== b.context || row.source?.document !== canonical.id)
      reject('REFERENCE', 'reference must belong to this canonical and context', location);
    return row;
  }
  const aggregate = find(b.aggregate, source('/aggregate'));
  if (aggregate.ref.kind !== 'aggregate') reject('AGGREGATE', 'aggregate reference required', source('/aggregate'));
  same(layout.declarations.filter(d => d.ref.kind === 'aggregate').map(d => d.ref), [aggregate.ref],
    'AGGREGATE', 'finite candidate must cover the sole aggregate, not omit another aggregate', source('/aggregate'));
  same(products['domain-external-events'].producers, [], 'EXTERNAL', 'external producers are not admitted', source('/aggregate'));
  same(products['domain-dependencies'].externalProducers, [], 'EXTERNAL', 'external dependency producers are not admitted', source('/aggregate'));
  const events = layout.declarations.filter(d => d.ref.kind === 'event' && equal(owner(d.ref), aggregate.ref));
  if (!events.length || events.length > 64) reject('EVENTS', 'one to 64 declared events required', source('/aggregate'));
  const emitted = new Set(products['domain-dependencies'].commands.flatMap(c => c.events.map(e => refKey(e.event))));
  for (const event of events) {
    if (!emitted.has(refKey(event.ref))) reject('EVENTS', 'every event needs an explicit local command producer', source('/aggregate'));
  }
  const folds = products['domain-folds'].events;
  same([...folds.map(e => refKey(e.event))].sort(), events.map(e => refKey(e.ref)).sort(),
    'FOLDS', 'fold product must cover the exact declared events', source('/aggregate'));

  object(b.wire, ['serializerId', 'envelopeVersion', 'registrations'], source('/wire'));
  integer(b.wire.serializerId, 1001, 2147483647, source('/wire/serializerId'));
  if (b.wire.envelopeVersion !== 1) reject('VERSION', 'only envelope format 1 is admitted', source('/wire/envelopeVersion'));
  const registrations = array(b.wire.registrations, source('/wire/registrations')).map((r, i) => {
    const p = '/wire/registrations/' + i, s = source(p);
    object(r, ['ref', 'role', 'typeId', 'version', 'layoutSha256'], s);
    const d = find(r.ref, source(p + '/ref'));
    if (!(r.role === 'state' && equal(d.ref, aggregate.ref) || r.role === 'event' && events.some(e => equal(e.ref, d.ref))))
      reject('WIRE_ROLE', 'wire role/ref must name this aggregate state or one of its events', s);
    token(r.typeId, source(p + '/typeId'));
    integer(r.version, 1, 2147483647, source(p + '/version'));
    if (typeof r.layoutSha256 !== 'string' || !/^[a-f0-9]{64}$(?![\s\S])/u.test(r.layoutSha256))
      reject('LAYOUT_PIN', 'explicit lowercase SHA256 expected-layout pin required', source(p + '/layoutSha256'));
    return { ...r, source: s, domainSource: d.source };
  });
  unique(registrations.map(r => refKey(r.ref)), 'PERSISTENCE_READSIDE_DUPLICATE', source('/wire/registrations'));
  unique(registrations.map(r => r.typeId), 'PERSISTENCE_READSIDE_DUPLICATE', source('/wire/registrations'));
  same(registrations.map(r => refKey(r.ref)).sort(), [aggregate, ...events].map(d => refKey(d.ref)).sort(),
    'WIRE_COVERAGE', 'every event and the aggregate state need exactly one registration', source('/wire/registrations'));

  const store = b.store;
  object(store, ['schemaVersion', 'id', 'version', 'dialect', 'tablePrefix', 'source', 'identity', 'streamKind',
    'pollIntervalMillis', 'closeTimeoutMillis', 'pageSize', 'maxPayloadBytes', 'maxPending', 'indexes'], source('/store'));
  if (store.schemaVersion !== 'truthsrc.journal-readside/v2' || store.dialect !== 'h2-2')
    reject('STORE_VERSION', 'explicit journal-readside/v2 with h2-2 dialect required', source('/store'));
  journalScalaName(store.id, source('/store/id')); journalSqlName(store.tablePrefix, source('/store/tablePrefix'));
  version(store.version, source('/store/version'));
  object(store.source, ['id', 'version'], source('/store/source'));
  token(store.source.id, source('/store/source/id')); version(store.source.version, source('/store/source/version'));
  object(store.identity, ['kind'], source('/store/identity'));
  if (store.identity.kind !== 'envelope-resource') reject('IDENTITY', 'only explicit envelope resource identity is supported', source('/store/identity'));
  token(store.streamKind, source('/store/streamKind'), 32);
  integer(store.pollIntervalMillis, 10, 60000, source('/store/pollIntervalMillis'));
  integer(store.closeTimeoutMillis, 1, 60000, source('/store/closeTimeoutMillis'));
  integer(store.pageSize, 1, 1024, source('/store/pageSize'));
  integer(store.maxPayloadBytes, 1, 8 * 1024 * 1024, source('/store/maxPayloadBytes'));
  integer(store.maxPending, 1, 1024, source('/store/maxPending'));
  const exact = new Set(products['exact-value-types'].map(t => refKey(t.domain)));
  function textCarrier(type, location) {
    const visited = new Set(), carriers = [];
    while (type?.form === 'nominal') {
      object(type, ['form', 'ref'], location);
      const d = find(type.ref, location), key = refKey(d.ref);
      if (d.ref.kind !== 'type' || visited.has(key) || visited.size >= 64 || exact.has(key))
        reject('INDEX_TYPE', 'acyclic non-exact nominal string carrier required', location);
      visited.add(key); carriers.push({ ref: d.ref, source: d.source }); type = d.valueType;
    }
    same(type, { form: 'primitive', name: 'string' }, 'INDEX_TYPE', 'state-map key and value must resolve to string', location);
    return carriers;
  }
  const rawIndexes = array(store.indexes, source('/store/indexes'));
  if (rawIndexes.length !== 1) reject('INDEX_COUNT', 'this finite candidate requires exactly one state-map index', source('/store/indexes'));
  const indexes = rawIndexes.map((index, i) => {
    const p = '/store/indexes/' + i, s = source(p);
    object(index, ['id', 'table', 'stateField', 'keySize', 'valueSize', 'query'], s);
    const field = find(index.stateField, source(p + '/stateField'));
    if (field.ref.kind !== 'state-field' || !equal(owner(field.ref), aggregate.ref) || field.valueType?.form !== 'map')
      reject('INDEX_FIELD', 'index must select an actual map state field of the aggregate', source(p + '/stateField'));
    object(field.valueType, ['form', 'key', 'value'], source(p + '/stateField'));
    integer(index.keySize, 1, 2048, source(p + '/keySize')); integer(index.valueSize, 1, 2048, source(p + '/valueSize'));
    object(index.query, ['id'], source(p + '/query'));
    const keyCarriers = textCarrier(field.valueType.key, source(p + '/stateField'));
    const valueCarriers = textCarrier(field.valueType.value, source(p + '/stateField'));
    const column = (name, type, size = null) => ({ name, type, size, nullable: false });
    const sql = { id: index.id, table: index.table, columns: [column('pid_key', 'digest'), column('persistence_id', 'text', 2048),
      column('resource_id', 'text', 2048), column('map_key', 'text', index.keySize), column('map_value', 'text', index.valueSize)],
      key: ['pid_key', 'map_key'], queries: [{ id: index.query.id, where: ['resource_id'], orderBy: ['map_key', 'pid_key'] }] };
    return { ...index, source: s, fieldSource: field.source, valueType: field.valueType, keyCarriers, valueCarriers, sql };
  });
  // Reuse the actual finite SQL/Scala namespace checks without fabricating a v1 state identity.
  validateJournalIndexes({ tablePrefix: store.tablePrefix, indexes: indexes.map(i => i.sql) }, source('/store'));
  return detach({ schemaVersion: PERSISTENCE_SCHEMA, id: b.id, version: b.version, context: b.context,
    aggregate: aggregate.ref, aggregateSource: aggregate.source, source: source(''),
    wire: { ...b.wire, source: source('/wire'), registrations },
    store: { ...store, bindingSource: source('/store'), indexes } });
}
