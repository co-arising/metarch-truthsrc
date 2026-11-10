import { array, at, detach, equal, fail, object, text, unique } from './request.mjs';
import { declaration } from '../domain-products/values.mjs';
import { reference, refKey } from '../domain-products/references.mjs';

export const API_BINDING_SCHEMA = 'truthsrc.api-binding/v1';
export const API_SCHEMA = 'truthsrc.api-contract/v1';
export const API_DEPENDENCIES = Object.freeze([
  { id: 'reference-layout', version: '1' }, { id: 'exact-value-types', version: '1' }, { id: 'exact-value-codecs', version: '1' },
  { id: 'domain-decision', version: '4' }, { id: 'domain-dependencies', version: '6' }, { id: 'domain-folds', version: '6' },
  { id: 'domain-external-events', version: '2' }, { id: 'persistence-readside-contract', version: '1' },
]);
const reject = (code, message, source) => fail('API_' + code, message, source);
const token = (value, source) => {
  text(value, source);
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$(?![\s\S])/u.test(value)) reject('IDENTITY', 'bounded explicit identifier required', source);
  return value;
};
const bound = (value, maximum, source) => {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) reject('BOUND', 'positive bounded integer required', source);
  return value;
};
function list(value, maximum, source) {
  array(value, source);
  if (!value.length || value.length > maximum) reject('BOUND', 'nonempty bounded array required', source);
  return value;
}
function route(value, source) {
  if (typeof value !== 'string' || value.length > 512 ||
      !/^\/(?:[A-Za-z][A-Za-z0-9_-]*|:[A-Za-z][A-Za-z0-9_]*)(?:\/(?:[A-Za-z][A-Za-z0-9_-]*|:[A-Za-z][A-Za-z0-9_]*))*$(?![\s\S])/u.test(value))
    reject('ROUTE', 'normalized route without encoding, wildcard or traversal required', source);
  const segments = value.split('/').slice(1), parameters = segments.filter(p => p.startsWith(':')).map(p => p.slice(1));
  unique(parameters, 'API_ROUTE', source);
  return { segments, parameters };
}
export function deriveApiContract(rawCanonical) {
  const canonical = detach(rawCanonical), rows = list(canonical.value.apiContracts, 1, at(canonical.id, '/apiContracts'));
  const row = rows[0];
  if (Object.hasOwn(row, 'source')) reject('SOURCE', 'source is derived', at(canonical.id, '/apiContracts/0/source'));
  return { ...row, source: at(canonical.id, '/apiContracts/0') };
}

/** HTTP lowering only references existing command parameters, event slots and readside indexes. */
export function compileApiContract(rawBinding, rawCanonical, rawProducts) {
  const { binding, canonical, products } = detach({ binding: rawBinding, canonical: rawCanonical, products: rawProducts });
  object(binding, ['id', 'schemaVersion', 'value'], at('api-binding'));
  object(binding.value, ['schemaVersion', 'contract'], at(binding.id));
  if (binding.schemaVersion !== API_BINDING_SCHEMA || binding.value.schemaVersion !== API_BINDING_SCHEMA)
    reject('VERSION', 'explicit api-binding/v1 required', at(binding.id));
  object(products, API_DEPENDENCIES.map(p => p.id), at(binding.id));
  const authored = deriveApiContract(canonical);
  if (!equal(authored, binding.value.contract)) reject('SOURCE', 'API binding must equal the complete authored contract', at(binding.id, '/contract'));
  const { source, ...raw } = authored, where = p => at(source.document, source.pointer + p);
  object(raw, ['schemaVersion', 'id', 'version', 'context', 'aggregate', 'resourceType', 'commands', 'query', 'page', 'readinessPath'], source);
  if (raw.schemaVersion !== API_SCHEMA || raw.version !== '1') reject('VERSION', 'explicit api-contract/v1 version 1 required', source);
  token(raw.id, where('/id'));
  const layout = products['reference-layout'], persistence = products['persistence-readside-contract'];
  if (!equal(layout.contexts, [raw.context]) || raw.context !== persistence.context || !equal(raw.aggregate, persistence.aggregate))
    reject('CONTEXT', 'API must bind the sole persistence aggregate/context', source);
  function find(ref, location) {
    reference(ref, location);
    const found = declaration(ref, layout, location);
    if (found.ref.context !== raw.context || found.source.document !== canonical.id) reject('REFERENCE', 'foreign API reference', location);
    return found;
  }
  find(raw.aggregate, where('/aggregate'));
  const exact = new Set(products['exact-value-types'].map(t => refKey(t.domain)));
  function carrier(valueType, location) {
    let current = valueType;
    const chain = [], seen = new Set();
    while (current.form === 'nominal') {
      const row = find(current.ref, location), key = refKey(row.ref);
      if (row.ref.kind !== 'type' || seen.has(key) || chain.length >= 16 || exact.has(key))
        reject('TYPE', 'acyclic non-exact nominal scalar required', location);
      seen.add(key); chain.push({ ref: row.ref, source: row.source }); current = row.valueType;
    }
    if (current.form !== 'primitive' || !['string', 'integer', 'boolean'].includes(current.name)) reject('TYPE', 'supported scalar DTO required', location);
    return { valueType, primitive: current.name, carriers: chain };
  }
  const resourceDeclaration = find(raw.resourceType, where('/resourceType'));
  if (resourceDeclaration.ref.kind !== 'type') reject('RESOURCE', 'nominal resource type required', where('/resourceType'));
  const resource = carrier({ form: 'nominal', ref: raw.resourceType }, where('/resourceType'));
  if (resource.primitive !== 'string') reject('RESOURCE', 'string resource carrier required', where('/resourceType'));
  const routes = [];
  function addRoute(method, value, location) {
    const parsed = route(value, location);
    if (routes.some(r => r.method === method && r.segments.length === parsed.segments.length &&
      r.segments.every((part, i) => part === parsed.segments[i] || part.startsWith(':') || parsed.segments[i].startsWith(':'))))
      reject('ROUTE', 'overlapping routes forbidden', location);
    routes.push({ method, ...parsed }); return parsed;
  }
  function field(rawField, target, location) {
    object(rawField, ['field', target, 'codec', 'maxLength', ...(target === 'parameter' ? ['location'] : [])], location);
    token(rawField.field, location);
    const d = find(rawField[target], location), type = carrier(d.valueType, location);
    const codec = { string: 'string', integer: 'long-string', boolean: 'boolean' }[type.primitive];
    if (rawField.codec !== codec) reject('CODEC', 'explicit scalar wire codec must match the domain carrier', location);
    if (type.primitive === 'string') bound(rawField.maxLength, 256, location);
    else if (rawField.maxLength !== null) reject('CODEC', 'non-string scalar has no maxLength', location);
    if (target === 'parameter' && !['path', 'body'].includes(rawField.location)) reject('FIELD', 'path/body mapping required', location);
    return { ...rawField, ...type, source: location, domainSource: d.source };
  }
  const dependencies = products['domain-dependencies'];
  const commands = list(raw.commands, 16, where('/commands')).map((command, i) => {
    const location = where('/commands/' + i);
    object(command, ['id', 'command', 'method', 'path', 'roles', 'csrf', 'request', 'result'], location);
    token(command.id, location);
    const d = find(command.command, location), actual = dependencies.commands.find(c => equal(c.command, command.command));
    if (d.ref.kind !== 'command' || !equal(d.ref.owner, [raw.aggregate.id]) || !actual || actual.events.length !== 1)
      reject('COMMAND', 'one declared local event per command required', location);
    if (command.method !== 'POST' || command.csrf !== true || !equal(command.roles, ['operator'])) reject('AUTHORITY', 'command requires operator, POST and CSRF', location);
    const parsed = addRoute('POST', command.path, location);
    const fields = list(command.request, 32, location).map((f, j) => field(f, 'parameter', where('/commands/' + i + '/request/' + j)));
    unique(fields.map(f => f.field), 'API_FIELD', location);
    unique(fields.map(f => refKey(f.parameter)), 'API_FIELD', location);
    if (!equal(fields.map(f => refKey(f.parameter)).sort(), actual.declaredSignature.map(p => refKey(p.ref)).sort()))
      reject('SIGNATURE', 'map every declared parameter exactly once', location);
    const paths = fields.filter(f => f.location === 'path');
    if (paths.length !== 1 || !equal(parsed.parameters, paths.map(f => f.field)) || !equal(paths[0].valueType, resource.valueType))
      reject('RESOURCE', 'one path field with the explicit resource type required', location);
    object(command.result, ['event', 'fields', 'empty'], location);
    if (command.result.empty !== 'no-change' || !equal(command.result.event, actual.events[0].event)) reject('RESULT', 'exact emitted event and no-change mapping required', location);
    const event = dependencies.events.find(e => equal(e.event, command.result.event));
    const results = list(command.result.fields, 32, location).map((f, j) => field(f, 'slot', where('/commands/' + i + '/result/fields/' + j)));
    unique(results.map(f => f.field), 'API_FIELD', location);
    if (results.some(f => f.field === 'status') || !equal(results.map(f => refKey(f.slot)).sort(), event.declaredSlots.map(s => refKey(s.ref)).sort()))
      reject('RESULT', 'map every event slot exactly once without reserved status', location);
    return { ...command, request: fields, result: { ...command.result, fields: results }, resourceField: paths[0].field,
      source: location, commandSource: d.source, eventSource: event.source };
  });
  unique(commands.map(c => c.id), 'API_DUPLICATE', where('/commands'));
  unique(commands.map(c => refKey(c.command)), 'API_DUPLICATE', where('/commands'));
  if (!equal(commands.map(c => refKey(c.command)).sort(), dependencies.commands.map(c => refKey(c.command)).sort()))
    reject('COVERAGE', 'finite application must expose every declared command explicitly', where('/commands'));
  const query = raw.query, q = where('/query');
  object(query, ['id', 'persistence', 'index', 'query', 'path', 'resourceParameter', 'roles', 'pageSize', 'maxPageSize', 'output'], q);
  token(query.id, q); token(query.resourceParameter, q);
  object(query.persistence, ['id', 'version'], q); object(query.output, ['key', 'value'], q);
  token(query.output.key, q); token(query.output.value, q);
  if (query.output.key === query.output.value) reject('QUERY', 'distinct output field names required', q);
  const index = persistence.store.indexes.find(i => i.id === query.index && i.query.id === query.query);
  if (!index || !equal(query.persistence, { id: persistence.id, version: persistence.version }) || !equal(query.roles, ['reader', 'operator']))
    reject('QUERY', 'explicit owned readside query and reader/operator authorization required', q);
  bound(query.maxPageSize, Math.min(64, persistence.store.pageSize), q); bound(query.pageSize, query.maxPageSize, q);
  if (!equal(addRoute('GET', query.path, q).parameters, [query.resourceParameter])) reject('QUERY', 'one resource path parameter required', q);
  const page = raw.page, p = where('/page');
  object(page, ['id', 'path', 'title', 'query'], p); token(page.id, p); text(page.title, p);
  if (page.title.length > 128 || /[\p{Cc}\p{Cf}]/u.test(page.title) || page.query !== query.id ||
      !equal(addRoute('GET', page.path, p).parameters, [query.resourceParameter])) reject('PAGE', 'page must reference the same authorized query', p);
  if (addRoute('GET', raw.readinessPath, where('/readinessPath')).parameters.length) reject('ROUTE', 'static readiness path required', source);
  return detach({ ...raw, declaration: authored, source, resource, commands,
    query: { ...query, source: q, indexSource: index.source, keyType: index.valueType.key, valueType: index.valueType.value },
    page: { ...page, source: p } });
}
