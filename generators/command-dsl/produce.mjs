import { renderCommand } from '../scala-cqrs-domain/render-domain.mjs';

export const version = '1';
export function produce(context) {
  return renderCommand(context, [{"id": "reference-layout", "version": "1"}, {"id": "domain-dependencies", "version": "4"}, {"id": "exact-value-types", "version": "1"}]);
}
