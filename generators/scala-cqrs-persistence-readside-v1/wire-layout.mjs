import { createHash } from 'node:crypto';
import { refKey } from '../../lib/domain-products/references.mjs';
import { targetData } from '../../lib/scala-target/naming.mjs';
import { fail } from '../../lib/products/request.mjs';

export const WIRE_LAYOUT_SCHEMA = 'truthsrc.persistence-wire-layout/v1';
const rejected = message => fail('PERSISTENCE_WIRE_LAYOUT', message, { document: 'target', pointer: '/protobuf' });
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Stable object-key encoding; array order remains meaningful (notably PB fields). */
export function wireCanonical(value) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(wireCanonical).join(',') + ']';
  if (!value || typeof value !== 'object') rejected('non-data value in wire descriptor');
  return '{' + Object.keys(value).sort(compare).map(k => JSON.stringify(k) + ':' + wireCanonical(value[k])).join(',') + '}';
}

function semanticType(type) {
  switch (type.form) {
    case 'primitive': return { form: type.form, name: type.name };
    case 'nominal': return { form: type.form, role: type.role, ref: type.ref };
    case 'optional': case 'sequence': return { form: type.form, element: semanticType(type.element) };
    case 'map': return { form: type.form, key: semanticType(type.key), value: semanticType(type.value) };
    default: rejected('unsupported resolved wire type');
  }
}

// Exact descriptors may carry declaration locations. Those are navigation only;
// their types, precision/scale, units, representation and codec version remain.
function semantics(value) {
  if (Array.isArray(value)) return value.map(semantics);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['source', 'sources', 'path', 'pointer', 'document'].includes(key))
    .map(([key, item]) => [key, semantics(item)]));
}

/** Descriptor for one persisted root and its complete transitive PB/codec graph.
 * No renderer text, filesystem, source location or global tool digest participates.
 */
export function persistenceWireLayout(rawSerialization, ref, role) {
  const serialization = targetData(rawSerialization);
  if (!['state', 'event'].includes(role)) rejected('only event/state persistence roots are admitted');
  const roots = serialization.roots.filter(root => root.role === role && refKey(root.ref) === refKey(ref));
  if (roots.length !== 1) rejected('one exact persisted root is required');
  const nodes = new Map(serialization.nodes.map(node => [node.id, node]));
  if (nodes.size !== serialization.nodes.length) rejected('duplicate serialization node identity');
  const closure = new Map(), active = new Set();
  function visit(id) {
    if (closure.has(id)) return;
    if (active.has(id)) rejected('recursive serialization graph');
    const node = nodes.get(id);
    if (!node) rejected('missing serialization node');
    active.add(id);
    const fields = node.fields.map(field => {
      if (field.nodeId) visit(field.nodeId);
      return { name: field.name, number: field.number, repeated: field.repeated, required: field.required,
        wireType: field.wireType, nodeId: field.nodeId, ref: field.ref, type: semanticType(field.type) };
    });
    closure.set(id, { id: node.id, kind: node.kind, ref: node.ref, type: semanticType(node.type), fields,
      exact: node.exact ? semantics(node.exact) : null, codec: node.codec ? semantics(node.codec) : null });
    active.delete(id);
  }
  visit(roots[0].nodeId);
  const descriptor = targetData({ schemaVersion: WIRE_LAYOUT_SCHEMA, protobufSyntax: 'proto3',
    codecSemantics: 'scala-cqrs-domain-kernel@1', role, ref, root: roots[0].nodeId,
    nodes: [...closure.values()].sort((a, b) => compare(a.id, b.id)) });
  const canonical = wireCanonical(descriptor) + '\n';
  return Object.freeze({ descriptor, canonical, sha256: createHash('sha256').update(canonical).digest('hex') });
}
