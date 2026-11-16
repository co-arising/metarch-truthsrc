import { key, packageFor, symbol } from './naming.mjs';

/** Structural serialization graph. Every optional/sequence/map has its own presence carrier. */
export function serializationModel(products, options) {
  const layout = products['reference-layout'], dependencies = products['domain-dependencies'], folds = products['domain-folds'];
  const exact = products['exact-value-types'], codecs = products['exact-value-codecs'], nodes = [];
  const contexts = [...new Set(layout.declarations.map(d => d.ref.context))];
  for (const context of contexts) {
    const pkg = packageFor(context, options), local = [], byNominal = new Map();
    const declaration = ref => layout.declarations.find(d => key(d.ref) === key(ref));
    function carrier(type, name, sources) {
      if (type.form === 'primitive') return { form: type.name, type };
      if (type.form === 'nominal') {
        const d = declaration(type.ref);
        if (!d) throw new TypeError('serialization nominal type is undeclared');
        if (type.ref.context !== context) throw new TypeError('cross-context serialization requires an explicit target profile');
        return { form: 'node', type, node: nominal(d) };
      }
      const node = { name, pkg, type, kind: type.form, sources, fields: [] };
      local.push(node);
      if (type.form === 'optional') node.fields = [{ name: 'value', carrier: carrier(type.element, name + 'Value', sources), repeated: false }];
      else if (type.form === 'sequence') node.fields = [{ name: 'values', carrier: carrier(type.element, name + 'Element', sources), repeated: true }];
      else if (type.form === 'map') {
        const row = { name: name + 'Entry', pkg, kind: 'map-entry', sources, fields: [
          { name: 'key', carrier: carrier(type.key, name + 'Key', sources), repeated: false },
          { name: 'value', carrier: carrier(type.value, name + 'Value', sources), repeated: false },
        ] };
        local.push(row); node.fields = [{ name: 'entries', carrier: { form: 'node', node: row }, repeated: true }];
      } else throw new TypeError('serialization carrier is outside target profile');
      return { form: 'node', type, node };
    }
    function nominal(d) {
      const identity = key(d.ref);
      if (byNominal.has(identity)) return byNominal.get(identity);
      const descriptor = exact.find(t => key(t.domain) === identity), codec = codecs.find(c => key(c.domain) === identity);
      const node = { name: d.ref.id + 'PB', pkg, kind: descriptor ? 'exact' : 'nominal', ref: d.ref, type: { form: 'nominal', ref: d.ref }, sources: [d.source], fields: [], descriptor, codec };
      byNominal.set(identity, node); local.push(node);
      if (descriptor) {
        if (!codec) throw new TypeError('exact serialization requires the complete declared codec');
        node.fields = [{ name: 'amount', carrier: { form: 'string' }, repeated: false }, ...(descriptor.form === 'unit-decimal' ? [{ name: 'unit', carrier: { form: 'string' }, repeated: false }] : [])];
      } else if (d.valueType.form === 'record') node.fields = d.valueType.members.map((r, i) => ({ name: r.id, carrier: carrier(declaration(r).valueType, node.name + 'Field' + i, [declaration(r).source]), repeated: false }));
      else node.fields = [{ name: 'value', carrier: carrier(d.valueType, node.name + 'Value', [d.source]), repeated: false }];
      return node;
    }
    for (const d of layout.declarations.filter(d => d.ref.kind === 'type' && d.ref.context === context)) nominal(d);
    for (const aggregate of layout.declarations.filter(d => d.ref.kind === 'aggregate' && d.ref.context === context)) {
      const defaults = folds.defaults.filter(d => d.target.context === context && d.target.owner[0] === aggregate.ref.id);
      const state = { name: aggregate.ref.id + 'StatePB', pkg, kind: 'state', aggregate: aggregate.ref, sources: [aggregate.source, ...defaults.map(d => d.source)], fields: [] };
      state.fields = defaults.map((d, i) => ({ name: d.target.id, carrier: carrier(d.valueType, state.name + 'Field' + i, [d.source]), repeated: false }));
      local.push(state);
      for (const e of dependencies.events.filter(e => e.event.context === context && e.event.owner[0] === aggregate.ref.id)) {
        const node = { name: aggregate.ref.id + e.event.id + 'PB', pkg, kind: 'event', event: e.event, sources: [e.source], fields: [] };
        node.fields = e.declaredSlots.map((d, i) => ({ name: d.ref.id, carrier: carrier(d.valueType, node.name + 'Field' + i, [d.source]), repeated: false }));
        local.push(node);
      }
    }
    const names = local.map(n => n.name);
    if (new Set(names).size !== names.length) throw new TypeError('serialization target name collision');
    names.forEach(symbol); nodes.push(...local);
  }
  return nodes;
}
