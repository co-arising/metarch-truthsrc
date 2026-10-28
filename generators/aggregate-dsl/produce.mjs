import { renderAggregate } from '../scala-cqrs-domain/render-domain.mjs';
import { renderActors } from '../scala-cqrs-domain/render-actor.mjs';

export const version = '1';
export function produce(context) {
  const footprint = [{"id": "reference-layout", "version": "1"}, {"id": "domain-folds", "version": "4"}, {"id": "exact-value-types", "version": "1"}];
  return [...renderAggregate(context, footprint), ...renderActors(context, footprint)];
}
