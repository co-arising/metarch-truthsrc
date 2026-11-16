import { scalaType } from '../../scala-cqrs-domain-kernel-v1/templates/types.mjs';
export { scalaType };
export const q = JSON.stringify;
export function scalarType(carrier) {
  return carrier.chain[0]?.fqn ?? { string: 'String', integer: 'Long', boolean: 'Boolean' }[carrier.primitive];
}
export function wrap(carrier, expression) {
  return carrier.chain.reduceRight((value, row) => row.fqn + '(' + value + ')', expression);
}
export function unwrap(carrier, expression) {
  return carrier.chain.reduce((value, row) => value + '.' + row.accessor, expression);
}
export function scalaFields(fields) {
  return fields.map(f => f.identifier + ': ' + scalarType(f.carrier)).join(', ');
}
