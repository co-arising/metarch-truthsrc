import { copyImmutableData } from '../../lib/immutable-data.mjs';
import { key, packageFor, pathFor } from './naming.mjs';

function valuePaths(type, options) {
  if (type.form === 'nominal') return [pathFor(packageFor(type.ref.context, options), 'domain/values/' + type.ref.id + '.scala')];
  if (type.form === 'optional' || type.form === 'sequence') return valuePaths(type.element, options);
  if (type.form === 'map') return [...valuePaths(type.key, options), ...valuePaths(type.value, options)];
  return [];
}

export function buildStateModels({ products, options }, layered) {
  const layout = products['reference-layout'];
  const models = layout.declarations.filter(d => d.ref.kind === 'aggregate').map(aggregate => {
    const owns = ref => ref.context === aggregate.ref.context && ref.owner[0] === aggregate.ref.id;
    const defaults = products['domain-folds'].defaults.filter(d => owns(d.target));
    const events = layout.declarations.filter(d => d.ref.kind === 'event' && owns(d.ref));
    const pkg = packageFor(aggregate.ref.context, options);
    const paths = {
      state: pathFor(pkg, 'domain/' + aggregate.ref.id + 'State.scala'),
      entity: pathFor(pkg, 'domain/entities/' + aggregate.ref.id + 'Entity.scala'),
      protocol: pathFor(pkg, 'domain/' + aggregate.ref.id + 'Protocol.scala')
    };
    const types = new Map();
    function include(type) {
      if (type.form === 'nominal') {
        const id = key(type.ref);
        if (types.has(id)) return;
        const declaration = layout.declarations.find(d => key(d.ref) === id);
        if (!declaration) throw new TypeError('state default type declaration is missing');
        types.set(id, declaration);
        include(declaration.valueType);
      } else if (type.form === 'record') {
        for (const ref of type.members) {
          const declaration = layout.declarations.find(d => key(d.ref) === key(ref));
          if (!declaration) throw new TypeError('state default member declaration is missing');
          types.set(key(ref), declaration);
          include(declaration.valueType);
        }
      } else if (type.form === 'optional' || type.form === 'sequence') include(type.element);
      else if (type.form === 'map') { include(type.key); include(type.value); }
    }
    defaults.forEach(d => include(d.valueType));
    return { aggregate, package: pkg, paths, layered, fields: defaults, events,
      sources: [aggregate.source, ...defaults.map(d => d.source)],
      dependencies: [...new Set(defaults.flatMap(d => valuePaths(d.valueType, options)))],
      literalTypes: { declarations: [...types.values()] },
      exactTypes: products['exact-value-types'] };
  });
  return copyImmutableData(models);
}
