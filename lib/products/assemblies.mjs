import { copyImmutableData } from '../immutable-data.mjs';

const KINDS = Object.freeze({
  'saga-bindings-union': { schema: 'truthsrc.saga-binding/v1', field: 'sagas', key: 'sagaId' },
  'runtime-bindings-union': { schema: 'truthsrc.saga-runtime-binding/v2', field: 'sagas', key: 'sagaId' },
  'execution-bindings-union': { schema: 'truthsrc.execution-binding/v1', field: 'pipelines', key: 'pipelineId' },
});

/** Explicit complete unions only. Source order is product order, never precedence. */
export function assembleDocuments(documents, specifications, helpers) {
  const { array, at, equal, escape, fail, object, text, unique } = helpers;
  const result = [...documents], receipts = [], ancestors = new Map(documents.map(d => [d.id, new Set([d.id])]));
  const consumed = new Set();
  for (const [ordinal, specification] of array(specifications, at('request', '/assemblies')).entries()) {
    const location = at('request', `/assemblies/${ordinal}`);
    const profile = KINDS[specification?.kind];
    if (!profile) fail('PRODUCT_ASSEMBLY_UNSUPPORTED', 'unknown explicit assembly kind', location);
    const execution = specification.kind === 'execution-bindings-union';
    object(specification, ['id', 'kind', 'sources', ...(execution ? ['sagaBinding'] : [])], location);
    text(specification.id, location);
    if (result.some(d => d.id === specification.id)) fail('PRODUCT_ASSEMBLY_DUPLICATE', 'assembly output document must have a new unique identity', location);
    const ids = array(specification.sources, location);
    if (!ids.length || ids.length > 256) fail('PRODUCT_ASSEMBLY_SHAPE', 'assembly requires 1..256 complete source documents', location);
    ids.forEach(id => text(id, location)); unique(ids, 'PRODUCT_ASSEMBLY_DUPLICATE', location);
    const inputs = ids.map(id => {
      const document = result.find(d => d.id === id);
      if (!document || document.schemaVersion !== profile.schema) fail('PRODUCT_ASSEMBLY_SOURCE', 'source must be an earlier document with the exact binding schema', location);
      consumed.add(id);
      return document;
    });
    const provenance = [], rows = [], seen = new Set(), hints = { canonical: Object.create(null), binding: Object.create(null) };
    let hasHints = false;
    const sagaBinding = execution ? result.find(d => d.id === specification.sagaBinding) : null;
    if (execution && (!sagaBinding || sagaBinding.schemaVersion !== KINDS['saga-bindings-union'].schema))
      fail('PRODUCT_ASSEMBLY_SOURCE', 'execution assembly requires an explicit earlier Saga binding document', location);
    if (execution) consumed.add(sagaBinding.id);
    for (const input of inputs) {
      const value = input.value, source = at(input.id);
      const keys = ['schemaVersion', profile.field, ...(specification.kind === 'runtime-bindings-union' ? ['target'] : [])];
      object(value, [...keys, ...(Object.hasOwn(value, 'sourceMap') ? ['sourceMap'] : []),
        ...(execution && Object.hasOwn(value, 'sagaBindings') ? ['sagaBindings'] : [])], source);
      const inputRows = array(value[profile.field], at(input.id, `/${profile.field}`));
      const offset = rows.length;
      inputRows.forEach((row, index) => {
        const rowSource = at(input.id, `/${profile.field}/${index}`);
        text(row?.[profile.key], rowSource);
        if (seen.has(row[profile.key])) fail('PRODUCT_ASSEMBLY_DUPLICATE', 'union never overwrites a duplicate binding identity', rowSource);
        seen.add(row[profile.key]); rows.push(row);
        provenance.push({ targetPointer: `/${profile.field}/${offset + index}`, source: rowSource });
      });
      if (specification.kind === 'runtime-bindings-union' && !equal(value.target, inputs[0].value.target))
        fail('PRODUCT_ASSEMBLY_TARGET', 'all runtime targets must be entirely equal', at(input.id, '/target'));
      if (execution && Object.hasOwn(value, 'sagaBindings')) {
        const allowed = [sagaBinding, ...result.filter(d => ancestors.get(sagaBinding.id)?.has(d.id))]
          .filter(d => d.schemaVersion === KINDS['saga-bindings-union'].schema);
        if (!allowed.some(d => equal(d.value, value.sagaBindings)))
          fail('PRODUCT_ASSEMBLY_NESTED', 'embedded Saga binding must equal the explicit union or one complete declared source', at(input.id, '/sagaBindings'));
        provenance.push({ targetPointer: '/sagaBindings', source: at(input.id, '/sagaBindings') });
      }
      if (Object.hasOwn(value, 'sourceMap')) {
        object(value.sourceMap, Object.keys(value.sourceMap), at(input.id, '/sourceMap'));
        if (Object.keys(value.sourceMap).some(k => !['canonical', 'binding'].includes(k))) fail('PRODUCT_ASSEMBLY_SHAPE', 'unsupported source hint document', source);
        hasHints = true;
        for (const name of ['canonical', 'binding']) {
          const map = value.sourceMap[name] ?? {};
          object(map, Object.keys(map), source);
          for (const [pointer, hint] of Object.entries(map)) {
            let target = pointer;
            if (name === 'binding' && pointer.startsWith(`/${profile.field}/`)) {
              const tail = pointer.slice(profile.field.length + 2), [index, ...parts] = tail.split('/');
              if (!/^(0|[1-9][0-9]*)$/u.test(index) || Number(index) >= inputRows.length) fail('PRODUCT_ASSEMBLY_SOURCE', 'source hint row is outside its source document', source);
              target = `/${profile.field}/${offset + Number(index)}` + (parts.length ? '/' + parts.join('/') : '');
            }
            if (Object.hasOwn(hints[name], target) && !equal(hints[name][target], hint))
              fail('PRODUCT_ASSEMBLY_HINT_CONFLICT', 'conflicting hints cannot be assigned by first-wins', at(input.id, '/sourceMap/' + name + '/' + escape(pointer)));
            hints[name][target] = hint;
          }
        }
      }
    }
    const value = { schemaVersion: profile.schema,
      ...(specification.kind === 'runtime-bindings-union' ? { target: inputs[0].value.target } : {}),
      [profile.field]: rows, ...(execution ? { sagaBindings: sagaBinding.value } : {}),
      ...(hasHints ? { sourceMap: hints } : {}) };
    if (execution) provenance.push({ targetPointer: '/sagaBindings', source: at(sagaBinding.id) });
    const lineage = new Set(ids.flatMap(id => [...ancestors.get(id)]));
    if (execution) for (const id of ancestors.get(sagaBinding.id)) lineage.add(id);
    lineage.add(specification.id); ancestors.set(specification.id, lineage);
    result.push({ id: specification.id, schemaVersion: profile.schema, value });
    receipts.push({ ...specification, provenance });
  }
  return copyImmutableData({ documents: result, assemblies: receipts, consumed: [...consumed] });
}
