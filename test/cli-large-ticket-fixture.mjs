import { readProductRequest } from '../lib/products/cli.mjs';
import { deriveDecisions } from '../lib/domain-products/decision.mjs';
import { deriveDependencies } from '../lib/domain-products/dependencies.mjs';
import { deriveFolds } from '../lib/domain-products/folds.mjs';

export function largeTicketRequest(count = 100) {
  const request = structuredClone(readProductRequest(new URL('./fixtures/tickets-wide-converters-products/files.json', import.meta.url).pathname));
  const doc = id => request.documents.find(d => d.id === id);
  const canonical = doc('domain'), layout = doc('references').value.layout, types = doc('types').value.types;
  const ref = (kind, id, owner = []) => ({ context: 'tickets', kind, owner, id });
  const source = pointer => ({ document: 'domain', pointer });
  const aggregate = canonical.value.aggregates[0];
  for (let i = 40; i < count; i++) {
    const name = 'PassengerRecord' + i, type = ref('type', name), index = canonical.value.valueObjects.length;
    const fields = Array.from({ length: 32 }, (_, j) => ({ name: j === 31 ? 'type' : 'passengerAttribute' + j, dataType: 'String' }));
    canonical.value.valueObjects.push({ name, context: 'tickets', fields });
    const members = fields.map(f => ref('member', f.name, [name]));
    layout.declarations.push({ ref: type, valueType: { form: 'record', members }, dependencies: members, source: source('/valueObjects/' + index) });
    fields.forEach((f, j) => layout.declarations.push({ ref: members[j], valueType: { form: 'primitive', name: 'string' }, dependencies: [type], source: source('/valueObjects/' + index + '/fields/' + j) }));
    const field = 'passenger' + i, si = aggregate.stateFields.length;
    aggregate.stateFields.push({ name: field, dataType: name, default: Object.fromEntries(fields.map(f => [f.name, ''])) });
    layout.declarations.push({ ref: ref('state-field', field, ['Booking']), valueType: { form: 'nominal', ref: type }, dependencies: [ref('aggregate', 'Booking'), type], source: source('/aggregates/0/stateFields/' + si) });
  }
  doc('decisions').value.decisions = deriveDecisions(canonical, layout, { types }, '4');
  doc('dependencies').value.dependencies = deriveDependencies(canonical, layout, doc('decisions').value.decisions, types, doc('external').value.externalEvents, 'truthsrc.domain-dependency-binding/v6');
  doc('folds').value.folds = deriveFolds(canonical, layout, doc('dependencies').value.dependencies, types, 'truthsrc.domain-fold-binding/v6');
  return request;
}
