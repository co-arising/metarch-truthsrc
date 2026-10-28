import { array, at, equal, fail, object, source, text, unique } from '../products/request.mjs';

export const refKey = ref => JSON.stringify([ref.context, ref.kind, ref.owner, ref.id]);
const depths = { type: 0, aggregate: 0, artifact: 0, port: 0, saga: 0, pipeline: 0, 'state-field': 1, command: 1, event: 1, member: 1, parameter: 2, 'event-slot': 2 };
const typed = new Set(['type', 'state-field', 'member', 'parameter', 'event-slot']);
export function reference(r, location) {
  object(r, ['context', 'kind', 'owner', 'id'], location);
  text(r.context, location); text(r.kind, location); text(r.id, location);
  array(r.owner, location).forEach(x => text(x, location));
  if (!Object.hasOwn(depths, r.kind) || depths[r.kind] !== r.owner.length) fail('REFERENCE_OWNER', 'unsupported reference kind or owner depth', location);
  return r;
}
export function owner(r) {
  let kind, owners = [];
  if (['state-field', 'command', 'event'].includes(r.kind)) kind = 'aggregate';
  if (r.kind === 'member') kind = 'type';
  if (['parameter', 'event-slot'].includes(r.kind)) { kind = r.kind === 'parameter' ? 'command' : 'event'; owners = [r.owner[0]]; }
  return kind ? { context: r.context, kind, owner: owners, id: r.owner.at(-1) } : null;
}
export function typeRefs(t, location, depth = 0) {
  if (depth > 64) fail('REFERENCE_TYPE', 'type exceeds nesting bound', location);
  if (!t || typeof t !== 'object') fail('REFERENCE_TYPE', 'explicit type form required', location);
  switch (t.form) {
    case 'primitive':
      object(t, ['form', 'name'], location);
      if (!['string', 'boolean', 'integer', 'decimal'].includes(t.name)) fail('REFERENCE_TYPE', 'unsupported primitive', location);
      return [];
    case 'record':
      object(t, ['form', 'members'], location);
      array(t.members, location).forEach(r => reference(r, location));
      unique(t.members.map(refKey), 'REFERENCE_TYPE', location);
      if (!t.members.length) fail('REFERENCE_TYPE', 'record requires explicit members', location);
      return t.members;
    case 'nominal': object(t, ['form', 'ref'], location); return [reference(t.ref, location)];
    case 'optional': case 'sequence': object(t, ['form', 'element'], location); return typeRefs(t.element, location, depth + 1);
    case 'map': object(t, ['form', 'key', 'value'], location); return [...typeRefs(t.key, location, depth + 1), ...typeRefs(t.value, location, depth + 1)];
    default: fail('REFERENCE_TYPE', 'unsupported type form', location);
  }
}
export function compileReferences(binding, canonical, documents) {
  const layout = binding.value.layout, location = at(binding.id, '/layout');
  object(layout, ['contexts', 'declarations'], location);
  array(layout.contexts, location).forEach(x => text(x, location));
  array(layout.declarations, location);
  if (!layout.contexts.length || !layout.declarations.length) fail('REFERENCE_EMPTY', 'contexts and declarations are required', location);
  unique(layout.contexts, 'REFERENCE_DUPLICATE', location);
  for (const d of layout.declarations) { object(d, ['ref', 'valueType', 'source', 'dependencies'], location); reference(d.ref, location); }
  unique(layout.declarations.map(d => refKey(d.ref)), 'REFERENCE_DUPLICATE', location);
  const byId = new Map(layout.declarations.map(d => [refKey(d.ref), d]));
  for (const d of layout.declarations) {
    const r = d.ref;
    if (!layout.contexts.includes(r.context)) fail('REFERENCE_CONTEXT', 'undeclared context', d.source);
    if (typed.has(r.kind) !== (d.valueType !== null)) fail('REFERENCE_TYPE', 'typed declaration/type presence mismatch', d.source);
    const origin = source(d.source, documents, location);
    if (d.source.document !== canonical.id || !origin || typeof origin !== 'object' || Array.isArray(origin)) fail('REFERENCE_SOURCE', 'declaration must identify a canonical object', d.source);
    const types = d.valueType === null ? [] : typeRefs(d.valueType, d.source);
    const parent = owner(r);
    for (const t of types) {
      const member = d.valueType?.form === 'record';
      if (!byId.has(refKey(t)) || (member ? r.kind !== 'type' || t.kind !== 'member' || t.context !== r.context || !equal(t.owner, [r.id]) : t.kind !== 'type'))
        fail('REFERENCE_UNRESOLVED', 'type/member reference does not match declared owner', d.source);
    }
    if (parent && !byId.has(refKey(parent))) fail('REFERENCE_OWNER', 'declared owner does not exist', d.source);
    const deps = array(d.dependencies, d.source).map(x => refKey(reference(x, d.source)));
    unique(deps, 'REFERENCE_DEPENDENCIES', d.source);
    const expected = [...new Set([...(parent ? [refKey(parent)] : []), ...types.map(refKey)])].sort();
    if (!equal([...deps].sort(), expected)) fail('REFERENCE_DEPENDENCIES', 'dependencies must equal owner and type references', d.source);
  }
  const remaining = new Map(layout.declarations.filter(d => d.valueType !== null)
    .map(d => [refKey(d.ref), new Set(typeRefs(d.valueType, d.source).map(refKey))]));
  while (remaining.size) {
    const ready = [...remaining].filter(([, deps]) => deps.size === 0).map(([key]) => key);
    if (!ready.length) fail('REFERENCE_TYPE_CYCLE', 'recursive nominal types unsupported', location);
    for (const key of ready) remaining.delete(key);
    for (const deps of remaining.values()) for (const key of ready) deps.delete(key);
  }
  return layout;
}
