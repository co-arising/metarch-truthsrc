import { renderProto } from '../scala-cqrs-domain/render-serialization.mjs';
import { renderScaffold } from '../scala-cqrs-domain/scaffold.mjs';

export const version = '1';
export function produce(context) {
  const footprint = [{"id": "reference-layout", "version": "1"}, {"id": "domain-dependencies", "version": "4"}, {"id": "domain-folds", "version": "4"}, {"id": "exact-value-types", "version": "1"}, {"id": "exact-value-codecs", "version": "1"}];
  return [...renderProto(context, footprint), ...renderScaffold(context, footprint)];
}
