import { renderConverters } from '../scala-cqrs-domain/render-serialization.mjs';
import { renderAdapters } from '../scala-cqrs-domain/render-adapters.mjs';

export const version = '1';
export function produce(context) {
  const footprint = [{"id": "reference-layout", "version": "1"}, {"id": "domain-dependencies", "version": "4"}, {"id": "domain-folds", "version": "4"}, {"id": "exact-value-types", "version": "1"}, {"id": "exact-value-codecs", "version": "1"}];
  return [...renderConverters(context, footprint), ...renderAdapters(context, footprint)];
}
