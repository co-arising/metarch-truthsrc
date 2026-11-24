// Knowledge → contract derivation for the serialization-adapter family (#31).
// Derives truthsrc.serialization-adapter-input/v1 from serializationModel +
// reference-layout + domain-dependencies. Pure and fail-closed (SA_DERIVATION).
import { serializationModel } from '../../generators/scala-cqrs-domain/serialization.mjs';
import { packageFor } from '../../generators/scala-cqrs-domain/naming.mjs';

const SCHEMA = 'truthsrc.serialization-adapter-input/v1';
const fail = message => { throw new Error('SA_DERIVATION: ' + message); };

const dedupSources = sources => {
  const seen = new Set();
  const out = [];
  for (const s of sources) {
    const k = s.document + '#' + s.pointer;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ document: s.document, pointer: s.pointer });
  }
  return out;
};

export function deriveSerializationAdapters(products, options) {
  const layout = products?.['reference-layout'];
  const deps = products?.['domain-dependencies'];
  const packages = options?.packages;
  if (!layout || !deps || !Array.isArray(packages)) fail('reference-layout, domain-dependencies, and packages required');

  const nodes = serializationModel(products, options);
  const serializers = [];
  const adapters = [];

  for (let idx = 0; idx < layout.contexts.length; idx++) {
    const context = layout.contexts[idx];
    const pkg = packageFor(context, options);
    const local = nodes.filter(n => n.pkg === pkg);
    serializers.push({
      context,
      identifier: 741000 + idx,
      protoPath: 'app/protobuf/' + pkg.replaceAll('.', '_') + '_domain.proto',
      entries: local.map(n => ({ pbName: n.name, sources: dedupSources(n.sources) })),
    });
    for (const agg of layout.declarations.filter(d => d.ref.kind === 'aggregate' && d.ref.context === context)) {
      const events = deps.events.filter(e => e.event.context === context && e.event.owner[0] === agg.ref.id);
      adapters.push({
        context,
        aggregate: agg.ref.id,
        aggregateSource: { document: agg.source.document, pointer: agg.source.pointer },
        events: events.map(e => ({
          eventName: e.event.id,
          pbName: agg.ref.id + e.event.id + 'PB',
          source: { document: e.source.document, pointer: e.source.pointer },
        })),
      });
    }
  }
  if (!serializers.length || !adapters.length) fail('empty serializer or adapter set');
  return {
    schemaVersion: SCHEMA,
    packages: packages.map(p => ({ context: p.context, package: p.package })),
    serializers,
    adapters,
  };
}
