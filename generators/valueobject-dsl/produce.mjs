import { renderValues } from '../scala-cqrs-domain/render-values.mjs';

export const version = '1';
export function produce(context) {
  return renderValues(context, [{"id": "reference-layout", "version": "1"}, {"id": "exact-value-types", "version": "1"}]);
}
