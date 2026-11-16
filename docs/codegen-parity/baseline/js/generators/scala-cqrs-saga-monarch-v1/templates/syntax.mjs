// Scala syntax belongs only to templates. Models carry symbols, types and policies.
export const q = value => JSON.stringify(value);
export const n = symbol => symbol.identifier;
export const fqn = symbol => '_root_.' + symbol.fqn;
export const types = m => Object.fromEntries(Object.entries(m.support).map(([key, value]) => [key, n(value)]));
export const resultPayload = (m, tx, request) => n(m.result) + '(' + m.result.transactionField + ' = ' + tx + ', ' + m.result.requestField + ' = ' + request + ')';
export const vector = values => 'Vector(' + values.join(', ') + ')';
export const map = values => 'Map(' + values.map(([key, value]) => q(key) + ' -> ' + value).join(', ') + ')';
