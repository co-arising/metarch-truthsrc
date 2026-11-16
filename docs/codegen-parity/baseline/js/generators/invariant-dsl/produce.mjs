import { renderInvariant } from '../scala-cqrs-domain/render-domain.mjs';

export const version = '1';
export function produce(context) {
  return renderInvariant(context, [{"id": "reference-layout", "version": "1"}, {"id": "domain-decision", "version": "3"}, {"id": "domain-folds", "version": "4"}, {"id": "exact-value-types", "version": "1"}]);
}
