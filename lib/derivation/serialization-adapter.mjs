// Knowledge → contract derivation for the curated serialization-adapter family
// (#31). Derives DomainProtoSerializer (for all *PO types + oneof event unions)
// and per-aggregate oneof EventAdapter/SnapshotAdapter objects.
// Pure and fail-closed (SA_DERIVATION).
import { buildCuratedProtoModel } from './proto-model.mjs';

const SCHEMA = 'truthsrc.serialization-adapter-input/v1';
const fail = message => { throw new Error('SA_DERIVATION: ' + message); };

export function deriveSerializationAdapters(products, options) {
  const packages = options?.packages;
  if (!Array.isArray(packages)) fail('explicit packages required');
  const modelContexts = buildCuratedProtoModel(products, options);

  const serializers = [];
  const adapters = [];

  for (let idx = 0; idx < modelContexts.length; idx++) {
    const ctx = modelContexts[idx];
    const entries = [
      ...ctx.valueObjects.map(vo => ({ poName: vo.poName, sources: vo.sources })),
      ...ctx.aggregates.flatMap(agg => [
        ...agg.events.map(ev => ({ poName: ev.poName, sources: [ev.source] })),
        { poName: agg.eventUnionPoName, sources: [agg.source, ...agg.events.map(e => e.source)] },
        { poName: agg.statePoName, sources: agg.stateSources },
      ]),
    ];
    serializers.push({
      context: ctx.context,
      identifier: 741000 + idx,
      protoPaths: [ctx.sharedProtoFile, ...ctx.aggregates.map(a => a.protoFile)],
      entries,
    });
    for (const agg of ctx.aggregates) {
      adapters.push({
        context: ctx.context,
        aggregate: agg.aggId,
        eventUnionPoName: agg.eventUnionPoName,
        statePoName: agg.statePoName,
        aggregateSource: agg.source,
        events: agg.events.map(ev => ({
          eventName: ev.eventId,
          poName: ev.poName,
          source: ev.source,
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
