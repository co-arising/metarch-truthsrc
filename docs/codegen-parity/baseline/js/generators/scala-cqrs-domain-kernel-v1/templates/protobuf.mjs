const containers = new Set(['optional', 'sequence', 'map']);

/** Definitive proto spellings remain separate from the domain accessor/ref. */
export function wireFields(node) {
  if (containers.has(node.kind) && (node.fields.length !== 2 || node.fields[0].name !== 'present' || node.fields[0].number !== 1 ||
      node.fields[1].name !== 'f0' || node.fields[1].number !== 2)) throw new TypeError('resolved serialization container fields are inconsistent');
  return node.fields;
}

/** Explicit root order, followed by its structural children (not duplicated nominal roots). */
export function protoNodes(context, serialization) {
  const nodes = new Map(serialization.nodes.map(node => [node.id, node]));
  const result = [], seen = new Set();
  function add(node) {
    if (!node) throw new TypeError('serialization node closure is missing');
    if (seen.has(node.id)) return;
    seen.add(node.id); result.push(node);
    for (const field of wireFields(node)) {
      if (!field.nodeId) continue;
      const child = nodes.get(field.nodeId);
      if (!child) throw new TypeError('serialization child is missing');
      if (['optional', 'sequence', 'map', 'map-entry'].includes(child.kind)) add(child);
    }
  }
  for (const id of context.rootIds) add(nodes.get(id));
  if (context.nodeIds.some(id => !seen.has(id))) throw new TypeError('unreachable serialization node');
  return result;
}

export function protobufTemplate(context, serialization, out) {
  out.append('syntax = "proto3";\n\npackage ' + context.package + ';\n\nimport "scalapb/scalapb.proto";\n\n' +
    'option (scalapb.options) = {\n  flat_package: true\n  single_file: true\n};\n');
  const nodes = new Map(serialization.nodes.map(node => [node.id, node]));
  for (const node of protoNodes(context, serialization)) {
    out.append('\nmessage ' + node.name + ' {\n', node.sources);
    for (const field of wireFields(node)) {
      const type = field.nodeId ? nodes.get(field.nodeId)?.name : field.wireType ?? { string: 'string', boolean: 'bool', integer: 'int64', decimal: 'string' }[field.type.name];
      if (!type) throw new TypeError('unsupported protobuf field type');
      out.append('  ' + (field.repeated ? 'repeated ' : '') + type + ' ' + field.name + ' = ' + field.number + ';\n', field.sources);
    }
    out.append('}\n');
  }
}
