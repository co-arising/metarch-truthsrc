import { relatedNarrativeSources } from './narrative-links.mjs';

export const pointerValue = (value, pointer) => pointer.split('/').slice(1).reduce((row, key) =>
  row && typeof row === 'object' && Object.hasOwn(row, key.replaceAll('~1', '/').replaceAll('~0', '~'))
    ? row[key.replaceAll('~1', '/').replaceAll('~0', '~')] : undefined, value);

export function declaredViewRelations(canonical, index) {
  const records = index.records.filter(row => row.surface === '' && row.relation !== 'unresolved');
  const edges = [], diagnostics = [], seen = new Set();
  const connect = (from, matches, carrier, label, expected) => {
    if (matches.length !== 1) {
      diagnostics.push({ code: matches.length ? 'VIEW_REFERENCE_AMBIGUOUS' : 'VIEW_REFERENCE_MISSING',
        from: from.identity, carrier, expected, matches: matches.map(row => row.identity) });
      return;
    }
    const to = matches[0], key = JSON.stringify([from.identity, to.identity, carrier]);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from: from.identity, to: to.identity, kind: 'declared-reference', label,
      proof: { pointer: from.pointer, carrier, source: from.file }, asserted: false });
  };
  const reference = (from, ref, carrier, label) => {
    if (!ref || typeof ref !== 'object' || ref.context !== index.context || !Array.isArray(ref.owner)) return;
    const kind = ({ port: 'technical-port', type: 'value-object' })[ref.kind] || ref.kind;
    connect(from, records.filter(row => row.kind === kind && row.name === ref.id && JSON.stringify(row.owner) === JSON.stringify(ref.owner)), carrier, label, ref);
  };
  for (const row of records) {
    const value = pointerValue(canonical, row.pointer);
    for (const linked of relatedNarrativeSources(canonical, index, [row], diagnostics)) {
      for (const step of linked.trace) {
        const from = records.find(record => record.identity === step.from);
        if (from) connect(from, records.filter(record => record.identity === step.to), step.carrier, '声明引用', step.to);
      }
    }
    if (row.kind === 'saga-host') reference(row, value.saga?.ref, 'saga/ref', '实现此事务');
    if (row.kind === 'effect-host') reference(row, value.pipeline?.ref, 'pipeline/ref', '实现此流程');
    if (row.kind === 'saga') {
      for (const [i, step] of (value.payload?.steps || []).entries()) {
        for (const [phase, action] of Object.entries(step.phases || {})) {
          const ref = action.commandRef;
          if (action.kind === 'command' && ref) connect(row, records.filter(record => record.kind === 'command' &&
            record.name === ref.name && record.owner[0] === ref.aggregate), `payload/steps/${i}/phases/${phase}/commandRef`,
          `${phase} · ${step.id}`, ref);
        }
      }
    }
    if (row.kind === 'command') {
      for (const event of value.produces || []) connect(row, records.filter(record => record.kind === 'event' &&
        record.name === event && record.owner[0] === row.owner[0]), 'produces', '产生事件', event);
    }
    if (['guard', 'fold', 'state-field'].includes(row.kind)) {
      const parentKind = row.kind === 'guard' ? 'command' : row.kind === 'fold' ? 'event' : 'aggregate';
      const parent = records.filter(record => record.kind === parentKind && record.name === row.owner.at(-1) &&
        JSON.stringify(record.owner) === JSON.stringify(row.owner.slice(0, -1)));
      if (parent.length === 1) connect(parent[0], [row], row.pointer.slice(parent[0].pointer.length),
        row.kind === 'guard' ? '规则' : row.kind === 'fold' ? '更新状态' : '状态字段', row.identity);
    }
  }
  return { edges, diagnostics };
}
