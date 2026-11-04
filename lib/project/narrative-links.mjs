const decode = pointer => pointer.split('/').slice(1).map(s => s.replaceAll('~1', '/').replaceAll('~0', '~'));
const get = (value, pointer) => decode(pointer).reduce((v, key) => v && typeof v === 'object' && Object.hasOwn(v, key) ? v[key] : undefined, value);
const baseRecords = index => index.records.filter(r => r.surface === '' && r.relation !== 'unresolved');
const kindMap = { type: 'value-object', port: 'technical-port', 'read-model': 'read-model', 'use-case': 'use-case' };
const target = (reference, records, context, canonical) => {
  if (!reference || typeof reference !== 'object' || Array.isArray(reference) || reference.context !== context
    || typeof reference.kind !== 'string' || typeof reference.id !== 'string' || !Array.isArray(reference.owner)) return [];
  const kind = kindMap[reference.kind] || reference.kind;
  return records.filter(r => (r.kind === kind || reference.kind === 'role' && r.kind === 'note' && r.meaning.type === 'role')
    && (r.name === reference.id || kind === 'use-case' && get(canonical, r.pointer)?.useCase === reference.id)
    && (reference.kind === 'role' || JSON.stringify(r.owner) === JSON.stringify(reference.owner)));
};

/** Follow only declared narrative reference carriers. These are trace links, not
 * evidence that the narrative itself generated a source file or an execution rule. */
export function relatedNarrativeSources(canonical, index, selected, diagnostics = []) {
  const records = baseRecords(index), links = [], visited = new Set();
  const walk = (record, route) => {
    const key = record.pointer;
    if (visited.has(key) || !['story', 'use-case', 'use-cases', 'read-model', 'note'].includes(record.kind)) return;
    visited.add(key);
    const value = get(canonical, record.pointer);
    if (!value || typeof value !== 'object') return;
    const refs = [], names = [];
    const add = (values, carrier) => { if (Array.isArray(values)) for (const ref of values) refs.push({ ref, carrier }); };
    add(value.references, 'references'); add(value.readEvidence, 'readEvidence'); add(value.queries, 'queries'); add(value.entrypoints, 'entrypoints');
    if (record.kind === 'use-case') {
      for (const [i, step] of (value.steps || []).entries()) add(step.references, 'steps/' + i + '/references');
      for (const [i, extension] of (value.extensions || []).entries()) add(extension.references, 'extensions/' + i + '/references');
    }
    for (const link of value.links || []) if (link && typeof link === 'object' && link.relation === 'covers' && typeof link.target === 'string' && link.target.startsWith('use-case:'))
      names.push({ kind: 'use-case', name: link.target.slice(9), carrier: 'links/covers' });
    if (record.kind === 'read-model') for (const [i, field] of (value.fields || []).entries()) {
      const match = /^eventField:([^.]+)\.(.+)$/.exec(field.source || '');
      if (match) names.push({ kind: 'event', name: match[1], owner: value.sourceAggregate, carrier: 'fields/' + i + '/source' });
    }
    const matches = refs.flatMap(({ ref, carrier }) => {
      const found = target(ref, records, index.context, canonical);
      if (found.length !== 1) diagnostics.push({ code: found.length ? 'NARRATIVE_REFERENCE_AMBIGUOUS' : 'NARRATIVE_REFERENCE_MISSING',
        file: record.file, pointer: record.pointer, carrier, reference: ref, matches: found.map(r => r.identity) });
      return found.map(r => ({ record: r, carrier }));
    }).concat(names.flatMap(n => {
      const found = records.filter(r => r.kind === n.kind && (r.name === n.name || n.kind === 'use-case' && get(canonical, r.pointer)?.useCase === n.name) && (!n.owner || r.owner[0] === n.owner));
      if (found.length !== 1) diagnostics.push({ code: found.length ? 'NARRATIVE_REFERENCE_AMBIGUOUS' : 'NARRATIVE_REFERENCE_MISSING', file: record.file, pointer: record.pointer, carrier: n.carrier, reference: n, matches: found.map(r => r.identity) });
      return found.map(r => ({ record: r, carrier: n.carrier }));
    }));
    for (const match of matches) {
      const via = [...route, { from: record.identity, pointer: record.pointer, carrier: match.carrier, to: match.record.identity }];
      links.push({ ...match.record, trace: via, association: 'declared-reference-not-direct-generation' });
      walk(match.record, via);
    }
  };
  for (const record of selected) walk(record, []);
  return links;
}
