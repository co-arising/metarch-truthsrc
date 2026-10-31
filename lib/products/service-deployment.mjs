import { equal, fail } from './request.mjs';
import { declaration } from '../domain-products/values.mjs';
import { refKey } from '../domain-products/references.mjs';

const closed = (value, keys, source) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k)))
    fail('SERVICE_SHAPE', 'exact service declaration fields required', source);
};
const list = (value, source) => {
  if (!Array.isArray(value) || value.length > 1024) fail('SERVICE_SHAPE', 'bounded service array required', source);
  return value;
};
const symbol = (value, source) => {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u.test(value))
    fail('SERVICE_IDENTITY', 'bounded service identifier required', source);
};
const distinct = (values, source) => {
  if (new Set(values).size !== values.length) fail('SERVICE_DUPLICATE', 'duplicate service identity', source);
};
const resolve = (ref, layout, source) => {
  closed(ref, ['context', 'kind', 'owner', 'id'], source);
  return declaration(ref, layout, source);
};

export function validateServiceDeployment(service, artifact, layout, source) {
  closed(service, ['schemaVersion', 'profile', 'bootstrap', 'namespaceConfig', 'journal', 'readSide', 'endpoints', 'projections'], source);
  if (service.schemaVersion !== 'truthsrc.play-service/v1' || service.profile !== 'scala-cqrs-play-service@1')
    fail('SERVICE_VERSION', 'explicit Play service profile and schema required', source);
  if (artifact.status !== 'selected') fail('SERVICE_OWNER', 'service implementation requires a selected artifact', source);
  symbol(service.namespaceConfig, source);
  const port = pin => {
    closed(pin, ['ref', 'version'], source);
    const found = artifact.ports.filter(p => equal(p.ref, pin.ref) && p.version === pin.version);
    if (found.length !== 1) fail('SERVICE_PORT', 'service port must match a required owned artifact port', source);
    return found[0];
  };
  port(service.bootstrap);
  const connection = ref => {
    if (!artifact.deployment.secretRefs.some(s => s.id === ref))
      fail('SERVICE_CONFIGURATION', 'connection requires a declared symbolic reference', source);
  };
  closed(service.journal, ['provider', 'version', 'connectionRef'], source);
  if (service.journal.provider !== 'mongodb-rxmongo' || service.journal.version !== '3.0.8')
    fail('SERVICE_JOURNAL', 'pinned Mongo journal required; no implicit fallback', source);
  connection(service.journal.connectionRef);
  closed(service.readSide, ['provider', 'driverVersion', 'projectionVersion', 'connectionRef'], source);
  if (service.readSide.provider !== 'mysql-jdbc' || service.readSide.driverVersion !== '8.0.33' || service.readSide.projectionVersion !== '1.2.5')
    fail('SERVICE_READSIDE', 'pinned JDBC read side required', source);
  connection(service.readSide.connectionRef);
  if (service.journal.connectionRef === service.readSide.connectionRef)
    fail('SERVICE_CONFIGURATION', 'journal and read side require distinct connection references', source);
  const routes = [];
  for (const endpoint of list(service.endpoints, source)) {
    closed(endpoint, ['id', 'method', 'path', 'audience', 'operation', 'port', 'inputType', 'outputType', 'csrf'], source);
    symbol(endpoint.id, source);
    if (!['GET', 'POST'].includes(endpoint.method) || !['customer', 'operator'].includes(endpoint.audience) ||
        !['query', 'command', 'reconcile', 'tick'].includes(endpoint.operation))
      fail('SERVICE_HTTP_AUTHORITY', 'only explicit customer/operator actions may be exposed', source);
    if ((endpoint.operation === 'query') !== (endpoint.method === 'GET') ||
        (['reconcile', 'tick'].includes(endpoint.operation) && endpoint.audience !== 'operator') ||
        endpoint.csrf !== (endpoint.method === 'POST'))
      fail('SERVICE_HTTP_AUTHORITY', 'read/write method, audience and CSRF policy mismatch', source);
    if (typeof endpoint.path !== 'string' || endpoint.path.length > 1024 ||
        !/^\/api\/v1(?:\/(?:[A-Za-z][A-Za-z0-9_-]*|:[A-Za-z][A-Za-z0-9_]*))+$/u.test(endpoint.path))
      fail('SERVICE_ROUTE', 'absolute normalized API route without wildcards or traversal required', source);
    const segments = endpoint.path.split('/');
    const parameters = segments.filter(p => p.startsWith(':'));
    distinct(parameters, source);
    if (routes.some(r => r.method === endpoint.method && r.segments.length === segments.length &&
        r.segments.every((p, i) => p === segments[i] || p.startsWith(':') || segments[i].startsWith(':'))))
      fail('SERVICE_ROUTE', 'overlapping routes are not deterministic', source);
    routes.push({ method: endpoint.method, segments });
    const bound = port(endpoint.port);
    if (equal(endpoint.port, service.bootstrap) || !equal(bound.inputType, endpoint.inputType) || !equal(bound.outputType, endpoint.outputType))
      fail('SERVICE_PORT', 'HTTP DTO pins must match the non-bootstrap port', source);
    for (const type of [endpoint.inputType, endpoint.outputType]) {
      if (type?.form !== 'nominal' || type.ref?.kind !== 'type') fail('SERVICE_DTO', 'explicit nominal HTTP DTO required', source);
      resolve(type.ref, layout, source);
    }
  }
  if (!routes.length) fail('SERVICE_ROUTE', 'service needs at least one explicit HTTP action', source);
  distinct(service.endpoints.map(e => e.id), source);
  for (const projection of list(service.projections, source)) {
    closed(projection, ['id', 'version', 'aggregate', 'viewType', 'keyFields', 'events'], source);
    symbol(projection.id, source); symbol(projection.version, source);
    const aggregate = resolve(projection.aggregate, layout, source);
    const view = resolve(projection.viewType, layout, source);
    if (aggregate.ref.kind !== 'aggregate' || view.ref.kind !== 'type' || view.valueType?.form !== 'record')
      fail('SERVICE_PROJECTION', 'projection requires an explicit aggregate and record view type', source);
    const members = new Map(view.valueType.members.map(r => [refKey(r), resolve(r, layout, source)]));
    const keys = list(projection.keyFields, source);
    keys.forEach(r => resolve(r, layout, source));
    if (!keys.length || keys.some(r => !members.has(refKey(r)))) fail('SERVICE_PROJECTION', 'view key must name declared view fields', source);
    distinct(keys.map(refKey), source);
    const events = list(projection.events, source);
    if (!events.length) fail('SERVICE_PROJECTION', 'projection requires explicit event mappings', source);
    for (const mapping of events) {
      closed(mapping, ['event', 'fields'], source);
      resolve(mapping.event, layout, source);
    }
    distinct(events.map(e => refKey(e.event)), source);
    for (const mapping of events) {
      const event = resolve(mapping.event, layout, source);
      if (event.ref.kind !== 'event' || event.ref.context !== aggregate.ref.context ||
          event.ref.owner[0] !== aggregate.ref.id) fail('SERVICE_PROJECTION', 'event belongs to a different aggregate', source);
      const fields = list(mapping.fields, source);
      if (!fields.length) fail('SERVICE_PROJECTION', 'event mapping cannot be empty', source);
      for (const field of fields) {
        closed(field, ['target', 'source'], source);
        resolve(field.target, layout, source);
        resolve(field.source, layout, source);
      }
      distinct(fields.map(f => refKey(f.target)), source);
      for (const field of fields) {
        const from = resolve(field.source, layout, source), to = members.get(refKey(field.target));
        if (!to || from.ref.kind !== 'event-slot' || from.ref.context !== event.ref.context || from.ref.owner.join('/') !== [...event.ref.owner, event.ref.id].join('/') ||
            !equal(from.valueType, to.valueType)) fail('SERVICE_PROJECTION', 'typed event-to-view field mapping required', source);
      }
      if (keys.some(k => !fields.some(f => equal(f.target, k)))) fail('SERVICE_PROJECTION', 'every event mapping must supply the complete view key', source);
    }
  }
  distinct(service.projections.map(p => p.id), source);
  return service;
}
