import { createHash } from 'node:crypto';
import { array, at, equal, fail, object } from '../../lib/products/request.mjs';
import { refKey } from '../../lib/domain-products/references.mjs';
import { targetData, resolveNameSet, resolveArtifactPath, resolveName } from '../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../lib/scala-target/profiles.mjs';
import { compilePersistenceReadside, PERSISTENCE_BINDING_SCHEMA } from '../../lib/products/persistence-readside.mjs';
import { buildModels as aggregateModels } from '../scala-cqrs-aggregate-core-v1/build-models.mjs';
import { converterAbi } from '../scala-cqrs-domain-kernel-v1/converter-abi.mjs';
import { persistenceWireLayout, wireCanonical } from './wire-layout.mjs';
import { readsideSchemaModel } from './schema-model.mjs';

export const baseProductIds = ['reference-layout', 'exact-value-types', 'domain-decision', 'domain-dependencies', 'domain-folds', 'domain-external-events', 'exact-value-codecs'];
export const productIds = [...baseProductIds, 'persistence-readside-contract'];
export const productVersions = ['1', '1', '4', '6', '6', '2', '1', '1'];
const loc = at('target');
const reject = (message, source = loc) => fail('PERSISTENCE_MODEL', message, source);
const unique = rows => [...new Map(rows.map(row => [JSON.stringify(row), row])).values()];
const roles = [
  ['persistence', 'persistence', 'Persistence', 'infrastructure.persistence'],
  ['registration', 'wire-registration', 'WireRegistration', 'infrastructure.persistence'],
  ['eventAdapter', 'event-adapter', 'EventAdapter', 'infrastructure.persistence'],
  ['snapshotAdapter', 'snapshot-adapter', 'SnapshotAdapter', 'infrastructure.persistence'],
  ['serializer', 'persistence-serializer', 'Serializer', 'infrastructure.persistence'],
  ['factory', 'persistence-factory', 'PersistenceFactory', 'infrastructure.persistence'],
  ['envelope', 'readside-envelope', 'Envelope', 'infrastructure.readside'],
  ['storedState', 'stored-state', 'StoredState', 'infrastructure.readside'],
  ['source', 'event-source', 'EventSource', 'infrastructure.readside'],
  ['jdbcSource', 'jdbc-event-source', 'JdbcEventSource', 'infrastructure.readside'],
  ['schema', 'readside-schema', 'Schema', 'infrastructure.readside', 'store'],
  ['repository', 'readside-repository', 'Repository', 'infrastructure.readside', 'store'],
  ['handler', 'readside-handler', 'Handler', 'infrastructure.readside', 'store'],
  ['runner', 'readside-runner', 'Runner', 'infrastructure.readside', 'store'],
  ['cursor', 'index-cursor', 'Cursor', 'infrastructure.readside', 'index'],
  ['row', 'index-row', 'Row', 'infrastructure.readside', 'index'],
  ['page', 'index-page', 'Page', 'infrastructure.readside', 'index'],
  ['projectResult', 'project-result', '', 'infrastructure.readside', 'ProjectResult'],
  ['catchUpResult', 'catch-up-result', '', 'infrastructure.readside', 'CatchUpResult'],
  ['shutdownResult', 'shutdown-result', '', 'infrastructure.readside', 'ShutdownResult'],
  ['frame', 'persistence-frame', '', 'persistence.protobuf', 'Frame'],
];
const newRoles = new Set(roles.map(r => r[1]));

function inputs(raw) {
  const input = targetData(raw);
  object(input, ['products', 'options'], loc); object(input.products, productIds, loc);
  object(input.options, ['packages', 'names', 'protobuf'], loc);
  const products = Object.fromEntries(baseProductIds.map(id => [id, input.products[id]]));
  const baseNames = [], overrides = [];
  for (const n of array(input.options.names, loc)) (newRoles.has(n.role) ? overrides : baseNames).push(n);
  return { ...input, baseProducts: products, overrides, baseOptions: { ...input.options, names: baseNames } };
}

/** Verify every enriched row by re-lowering the actual declaration inputs. The
 * public planProductSet route additionally replays the COMPLETE live compilation
 * from its original binding/canonical documents before invoking this producer.
 */
function checkedProduct(products, baseProducts) {
  const p = products['persistence-readside-contract'];
  object(p, ['schemaVersion', 'id', 'version', 'context', 'aggregate', 'aggregateSource', 'source', 'wire', 'store'], loc);
  object(p.source, ['document', 'pointer'], loc);
  object(p.wire, ['serializerId', 'envelopeVersion', 'registrations', 'source'], loc);
  const registrations = array(p.wire.registrations, loc).map(r => {
    object(r, ['ref', 'role', 'typeId', 'version', 'layoutSha256', 'source', 'domainSource'], loc);
    const { source, domainSource, ...raw } = r; return raw;
  });
  object(p.store, ['schemaVersion', 'id', 'version', 'dialect', 'tablePrefix', 'source', 'identity', 'streamKind', 'pollIntervalMillis', 'closeTimeoutMillis', 'pageSize', 'maxPayloadBytes', 'maxPending', 'indexes', 'bindingSource'], loc);
  const indexes = array(p.store.indexes, loc).map(i => {
    object(i, ['id', 'table', 'stateField', 'keySize', 'valueSize', 'query', 'source', 'fieldSource', 'valueType', 'keyCarriers', 'valueCarriers', 'sql'], loc);
    return { id: i.id, table: i.table, stateField: i.stateField, keySize: i.keySize, valueSize: i.valueSize, query: i.query };
  });
  const { bindingSource, ...store } = p.store;
  const binding = { id: p.source.document, schemaVersion: PERSISTENCE_BINDING_SCHEMA, value: {
    schemaVersion: PERSISTENCE_BINDING_SCHEMA, id: p.id, version: p.version, context: p.context, aggregate: p.aggregate,
    wire: { serializerId: p.wire.serializerId, envelopeVersion: p.wire.envelopeVersion, registrations }, store: { ...store, indexes } } };
  const declaration = baseProducts['reference-layout'].declarations.find(d => equal(d.ref, p.aggregate));
  if (!declaration) reject('persistence aggregate is not a domain declaration');
  // Only canonical identity/context are used by this lowering. The public route
  // owns the actual complete document replay, not an enriched model supplied here.
  const canonical = { id: declaration.source.document, schemaVersion: 'truthsrc/v1', value: { schemaVersion: 'truthsrc/v1', context: p.context } };
  const rebuilt = compilePersistenceReadside(binding, canonical, baseProducts);
  if (!equal(rebuilt, p)) reject('supplied persistence product differs from its complete binding/declaration lowering', p.source);
  return rebuilt;
}

function prepare(raw) {
  const input = inputs(raw), product = checkedProduct(input.products, input.baseProducts);
  const family = aggregateModels({ products: input.baseProducts, options: input.baseOptions });
  return { ...input, product, family };
}

/** Read-only pin diagnostic: never accepts, installs or refreshes a pin. */
export function diagnoseWireLayouts(raw) {
  const { product, family } = prepare(raw);
  return targetData(product.wire.registrations.map(r => ({ ref: r.ref, role: r.role, source: r.source,
    expected: r.layoutSha256, ...persistenceWireLayout(family.serialization, r.ref, r.role) })));
}

export function buildModels(raw) {
  const { product: p, family, overrides } = prepare(raw);
  const context = family.kernel.contexts[0], aggregate = family.aggregates[0];
  const pbContext = family.serialization.contexts.find(c => c.context === p.context);
  const abi = converterAbi(pbContext, family.serialization, family.kernel);
  const registrations = p.wire.registrations.map(r => {
    const layout = persistenceWireLayout(family.serialization, r.ref, r.role);
    if (layout.sha256 !== r.layoutSha256)
      fail('PERSISTENCE_WIRE_PIN', `wire layout mismatch for ${refKey(r.ref)} role=${r.role}: expected=${r.layoutSha256} actual=${layout.sha256}; use diagnoseWireLayouts and explicitly review/update the technical binding`, r.source);
    const converter = abi.registrations.find(a => a.role === r.role && equal(a.ref, r.ref));
    if (!converter) reject('missing exact converter ABI registration', r.source);
    return { ...r, ...converter, layout: layout.descriptor, sources: unique([r.source, r.domainSource,
      ...layout.descriptor.nodes.flatMap(n => family.serialization.nodes.find(s => s.id === n.id).sources)]) };
  });
  const index = p.store.indexes[0], indexField = aggregate.base.state.fields.find(f => equal(f.ref, index.stateField));
  if (!indexField) reject('index state field not present in family2 state');
  const specs = [], bindings = new Map();
  for (const n of overrides) {
    object(n, ['ref', 'role', 'name'], loc);
    const spec = roles.find(r => r[1] === n.role), expected = spec[4] === 'index' ? index.stateField : p.aggregate;
    if (!equal(n.ref, expected) || bindings.has(n.role)) reject('wrong reference or duplicate persistence naming role');
    bindings.set(n.role, n.name);
  }
  for (const [key, role, suffix, pkg, stem] of roles) {
    const spelling = stem === 'store' ? p.store.id : stem === 'index' ? index.id : stem || p.aggregate.id;
    specs.push({ knowledgeId: refKey(stem === 'index' ? index.stateField : p.aggregate) + ':' + role, scope: context.package + '.' + pkg,
      space: 'scala-type', spelling, binding: bindings.get(role) ?? null, prefix: [], suffix: bindings.has(role) || !suffix ? [] : [suffix] });
  }
  const reserved = unique([...family.artifacts, ...family.serialization.nodes].filter(a => a.name && a.fqn).map(a => ({ scope: a.fqn.slice(0, a.fqn.lastIndexOf('.')), space: 'scala-type', name: a.name, reason: 'existing family2 declaration' })));
  for (const scope of new Set(specs.map(s => s.scope))) for (const name of ['String', 'Long', 'Int', 'Boolean', 'Array', 'Option', 'Vector', 'Map', 'Future', 'Promise', 'Session', 'Frame'])
    if (!(name === 'Frame' && scope.endsWith('.persistence.protobuf'))) reserved.push({ scope, space: 'scala-type', name, reason: 'runtime or session type' });
  const resolved = resolveNameSet({ profile: MODULAR_CANDIDATE, names: specs, reserved });
  const names = Object.fromEntries(roles.map(([key, role], i) => [key, { name: resolved[i].name, identifier: resolved[i].identifier,
    package: specs[i].scope, fqn: specs[i].scope + '.' + resolved[i].identifier, role,
    path: resolveArtifactPath({ profile: MODULAR_CANDIDATE, module: 'glue', packageName: specs[i].scope, typeName: resolved[i].name }) }]));
  function carrier(type) {
    const chain = [], seen = new Set(); let current = type;
    while (current.form === 'nominal') {
      if (seen.has(refKey(current.ref))) reject('recursive carrier'); seen.add(refKey(current.ref));
      const v = family.kernel.values.find(v => equal(v.ref, current.ref));
      if (!v || v.fields.length !== 1 || v.type.form === 'record') reject('invalid string carrier');
      chain.push({ fqn: v.fqn, accessor: v.fields[0].accessor, path: v.path }); current = v.fields[0].type;
    }
    if (!equal(current, { form: 'primitive', name: 'string' })) reject('index carrier is not string');
    return { type, chain };
  }
  const member = (role, spelling, prefix = []) => resolveName({ profile: MODULAR_CANDIDATE, knowledgeId: refKey(index.stateField) + ':' + role,
    scope: names.row.fqn, space: 'scala-member', spelling, binding: null, prefix, suffix: [] }).identifier;
  const keyCarrier = carrier(indexField.type.key), valueCarrier = carrier(indexField.type.value);
  const mappedIndex = { ...index, field: indexField, keyCarrier, valueCarrier,
    keyMember: member('key', indexField.type.key.form === 'nominal' ? indexField.type.key.ref.id.toLowerCase() : 'mapKey'),
    valueMember: member('value', index.id), replaceMethod: member('replace', indexField.name, ['replace']) };
  if (['pidKey', 'pid', 'resource'].includes(mappedIndex.keyMember) || ['pidKey', 'pid', 'resource', mappedIndex.keyMember].includes(mappedIndex.valueMember)) reject('index row member collision');
  const schema = readsideSchemaModel(p, mappedIndex);
  const compatibility = { schemaVersion: 'truthsrc.persistence-store-layout/v1', binding: { id: p.id, version: p.version },
    aggregate: p.aggregate, store: { id: p.store.id, version: p.store.version, dialect: p.store.dialect, tablePrefix: p.store.tablePrefix,
      schemaVersion: p.store.schemaVersion, identity: p.store.identity, streamKind: p.store.streamKind, source: p.store.source },
    frame: { envelopeVersion: p.wire.envelopeVersion, serializerId: p.wire.serializerId, fields: ['1:uint32:envelope_version', '2:string:role', '3:string:type_id', '4:uint32:wire_version', '5:string:layout_sha256', '6:bytes:payload'],
      registrations: registrations.map(({ ref, role, typeId, version, layoutSha256 }) => ({ ref, role, typeId, version, layoutSha256 })) },
    index: { id: index.id, table: index.table, stateField: index.stateField, valueType: index.valueType,
      keyCarriers: index.keyCarriers.map(c => c.ref), valueCarriers: index.valueCarriers.map(c => c.ref), keySize: index.keySize, valueSize: index.valueSize,
      query: index.query, key: index.sql.key, orderBy: index.sql.queries[0].orderBy }, tables: schema.tables };
  const compatibilityKey = createHash('sha256').update(wireCanonical(compatibility) + '\n').digest('hex');
  const sources = unique([p.source, p.aggregateSource, p.wire.source, p.store.bindingSource, ...registrations.flatMap(r => r.sources), index.source, index.fieldSource]);
  const stem = names.persistence.name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  return targetData({ profile: 'scala-cqrs-persistence-readside@1', family, product: p, aggregate, context, names, registrations,
    converter: context.converter, index: mappedIndex, schema, compatibility, compatibilityKey, sources,
    manifestPrefix: p.store.streamKind + '-frame/' + p.wire.envelopeVersion,
    frameProtoPath: 'modules/glue/src/main/protobuf/' + stem + '_frame.proto',
    sqlPath: 'modules/glue/src/main/resources/' + p.store.tablePrefix + '.sql' });
}
