import { generationFixture } from './domain-product-generation.test.mjs';
import { deriveExternalEvents } from '../lib/domain-products/external-events.mjs';
import { deriveDependencies } from '../lib/domain-products/dependencies.mjs';
import { deriveFolds } from '../lib/domain-products/folds.mjs';

export function sharedExternalTypeFixture() {
  const request = generationFixture();
  const document = id => request.documents.find(d => d.id === id);
  const canonical = document('domain'), layout = document('references').value.layout;
  const aggregate = canonical.value.aggregates[0];
  const event = structuredClone(aggregate.events[1]);
  event.name = 'Reobserved';
  aggregate.events.push(event);
  const rewriteRef = ref => ({ ...ref, id: ref.kind === 'event' && ref.id === 'Observed' ? 'Reobserved' : ref.id,
    owner: ref.owner.map(id => id === 'Observed' ? 'Reobserved' : id) });
  const declarations = layout.declarations.filter(d => d.source.pointer.startsWith('/aggregates/0/events/1')).map(d => ({
    ...structuredClone(d), ref: rewriteRef(d.ref), source: { ...d.source, pointer: d.source.pointer.replace('/events/1', '/events/2') }, dependencies: d.dependencies.map(rewriteRef),
  }));
  layout.declarations.push(...declarations);
  const producer = structuredClone(canonical.value.externalEventProducers[0]);
  producer.id = 'reobservation-ingress';
  producer.event = rewriteRef(producer.event);
  producer.slotMappings.forEach(row => { row.slot = rewriteRef(row.slot); });
  canonical.value.externalEventProducers.push(producer);
  const external = document('external');
  external.value.externalEvents = deriveExternalEvents(canonical, layout, external.schemaVersion);
  const types = document('types').value.types;
  const dependencies = document('dependencies');
  dependencies.value.dependencies = deriveDependencies(canonical, layout, document('decisions').value.decisions, types, external.value.externalEvents, dependencies.schemaVersion);
  const folds = document('folds');
  folds.value.folds = deriveFolds(canonical, layout, dependencies.value.dependencies, types, folds.schemaVersion);
  return request;
}
