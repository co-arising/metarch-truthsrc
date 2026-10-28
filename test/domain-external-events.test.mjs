import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { PROFILES } from '../lib/products/registry.mjs';

const base = new URL('./fixtures/guards-v3/files.json', import.meta.url);
const clone = v => structuredClone(v);
const ref = (kind, owner, id) => ({ context: 'measurement', kind, owner, id });
const primitive = name => ({ form: 'primitive', name });
function fixture() {
  const r = clone(readProductRequest(fileURLToPath(base)));
  const c = r.documents.find(d => d.id === 'domain').value;
  const layout = r.documents.find(d => d.schemaVersion === 'truthsrc.reference-binding/v1').value.layout;
  const event = ref('event', ['Gauge'], 'Observed'), port = ref('port', [], 'ObservationSource'), record = ref('type', [], 'Observation');
  c.valueObjects.push({ context: 'measurement', name: 'Observation', fields: [{ name: 'observationId', dataType: 'String' }, { name: 'level', dataType: 'Ratio' }] });
  c.ports = [{ name: 'ObservationSource', version: 'observation-v1', outputType: 'Observation' }];
  c.aggregates[0].events.push({ name: 'Observed', payloads: [{ name: 'observationId', dataType: 'String' }, { name: 'level', dataType: 'Ratio' }],
    bindings: [], foldAssignments: [{ slot: 'level', expr: 'event.level' }] });
  const nominal = { form: 'nominal', ref: record };
  const members = [ref('member', ['Observation'], 'observationId'), ref('member', ['Observation'], 'level')];
  const slots = [ref('event-slot', ['Gauge', 'Observed'], 'observationId'), ref('event-slot', ['Gauge', 'Observed'], 'level')];
  const ratio = ref('type', [], 'Ratio'), source = pointer => ({ document: 'domain', pointer });
  const ai = c.aggregates[0].events.length - 1, vi = c.valueObjects.length - 1, pi = c.ports.length - 1;
  layout.declarations.push({ ref: record, valueType: { form: 'record', members }, source: source(`/valueObjects/${vi}`), dependencies: members },
    { ref: members[0], valueType: primitive('string'), source: source(`/valueObjects/${vi}/fields/0`), dependencies: [record] },
    { ref: members[1], valueType: { form: 'nominal', ref: ratio }, source: source(`/valueObjects/${vi}/fields/1`), dependencies: [record, ratio] },
    { ref: port, valueType: null, source: source(`/ports/${pi}`), dependencies: [] },
    { ref: event, valueType: null, source: source(`/aggregates/0/events/${ai}`), dependencies: [ref('aggregate', [], 'Gauge')] },
    { ref: slots[0], valueType: primitive('string'), source: source(`/aggregates/0/events/${ai}/payloads/0`), dependencies: [event] },
    { ref: slots[1], valueType: { form: 'nominal', ref: ratio }, source: source(`/aggregates/0/events/${ai}/payloads/1`), dependencies: [event, ratio] });
  const identity = { id: 'observation-identity', version: '1', keys: [members[0]] };
  c.externalEventProducers = [{ id: 'observation-ingress', version: 'observation-v1', kind: 'authority-event', event, port,
    outputType: nominal, slotMappings: slots.map((slot, i) => ({ slot, member: members[i] })), stableIdentityContract: identity }];
  const producers = [{ id: 'observation-ingress', version: 'observation-v1', kind: 'authority-event', event, port, outputType: nominal,
    slots: slots.map((slot, i) => ({ slot, valueType: i ? { form: 'nominal', ref: ratio } : primitive('string'), source: source(`/externalEventProducers/0/slotMappings/${i}`), member: members[i], dependencies: [port, members[i]] })),
    stableIdentityContract: identity, source: source('/externalEventProducers/0') }];
  r.documents.push({ id: 'external', schemaVersion: 'truthsrc.domain-external-event-binding/v1', value: { schemaVersion: 'truthsrc.domain-external-event-binding/v1', externalEvents: { producers } } });
  for (const d of r.documents) {
    if (d.schemaVersion === 'truthsrc.domain-dependency-binding/v3') {
      d.schemaVersion = d.value.schemaVersion = 'truthsrc.domain-dependency-binding/v4';
      d.value.dependencies.events.push({ event, source: source(`/aggregates/0/events/${ai}`), declaredSlots: slots.map((slot, i) => ({ ref: slot, valueType: i ? { form: 'nominal', ref: ratio } : primitive('string'), source: source(`/aggregates/0/events/${ai}/payloads/${i}`) })) });
      d.value.dependencies.externalProducers = producers;
    }
    if (d.schemaVersion === 'truthsrc.domain-fold-binding/v3') {
      d.schemaVersion = d.value.schemaVersion = 'truthsrc.domain-fold-binding/v4';
      d.value.folds.events.push({ event, source: source(`/aggregates/0/events/${ai}`), assignments: [{ target: ref('state-field', ['Gauge'], 'level'), valueType: { form: 'nominal', ref: ratio }, sourceOrdinal: 0,
        source: source(`/aggregates/0/events/${ai}/foldAssignments/0`), update: { op: 'set', value: { op: 'ref', ref: slots[1] } }, dependencies: [slots[1]] }] });
    }
  }
  for (const requirement of r.requirements) {
    if (['domain-dependencies', 'domain-folds'].includes(requirement.id)) {
      const profile = PROFILES[requirement.id + '@4']; requirement.version = '4'; requirement.payloadSchemaVersion = profile.payloadSchemaVersion;
      requirement.capabilities = clone(profile.capabilities); requirement.requires = clone(profile.requires);
    }
  }
  const p = PROFILES['domain-external-events']; r.requirements.push({ id: 'domain-external-events', version: '1', payloadSchemaVersion: p.payloadSchemaVersion,
    capabilities: clone(p.capabilities), requires: clone(p.requires), inputRoles: { canonical: 'domain', externalEventBinding: 'external' } });
  return r;
}
function reject(r, code) {
  const result = compileProductSet(r); assert.equal(result.result, null);
  assert.ok(result.diagnostics.some(d => d.code === code), JSON.stringify(result.diagnostics));
}
test('independent observation event is produced by one typed ingress port, not a fabricated command', () => {
  const r = fixture(), before = clone(r), result = compileProductSet(r);
  assert.deepEqual(result.diagnostics, []); assert.ok(result.result); assert.deepEqual(r, before);
  const dependencies = result.result.products.find(p => p.id === 'domain-dependencies').payload;
  assert.equal(dependencies.externalProducers.length, 1);
  assert.equal(dependencies.commands.length, 1);
  assert.equal(dependencies.events.length, 2);
});
test('external event requires full output members, exact nominal types and stable consumed keys', () => {
  for (const [field, value, code] of [['version', 'wrong', 'EXTERNAL_PORT'], ['slotMappings', [], 'EXTERNAL_SLOT'], ['kind', 'implicit-command', 'EXTERNAL_KIND'],
    ['stableIdentityContract', { id: 'bad', version: '1', keys: [] }, 'EXTERNAL_IDENTITY']]) {
    const r = fixture(); r.documents[0].value.externalEventProducers[0][field] = value; reject(r, code);
  }
});
test('external producer cannot coexist with command production or hide an uncovered event', () => {
  let r = fixture(); r.documents[0].value.aggregates[0].commands[0].produces.push('Observed'); reject(r, 'DEPENDENCY_SLOT');
  r = fixture(); r.documents[0].value.externalEventProducers = []; r.documents.find(d => d.id === 'external').value.externalEvents.producers = []; reject(r, 'DEPENDENCY_EVENT_UNPRODUCED');
});
test('malformed external mappings and nominal output references fail with product diagnostics', () => {
  for (const mutate of [
    p => { p.outputType = null; },
    p => { p.slotMappings[0] = null; },
    p => { p.slotMappings[0].slot = null; },
    p => { p.slotMappings[0].member = { context: 'measurement', kind: 'member', owner: ['Observation'], id: 'missing' }; },
    p => { p.stableIdentityContract.keys = [null]; },
  ]) {
    const r = fixture(); mutate(r.documents[0].value.externalEventProducers[0]);
    const result = compileProductSet(r);
    assert.equal(result.result, null); assert.ok(result.diagnostics.length);
  }
});
test('old v3 does not inherit external ingress capability', () => {
  const r = fixture();
  for (const requirement of r.requirements) if (requirement.id === 'domain-dependencies') {
    const profile = PROFILES['domain-dependencies@3']; requirement.version = '3'; requirement.payloadSchemaVersion = profile.payloadSchemaVersion;
    requirement.capabilities = clone(profile.capabilities); requirement.requires = clone(profile.requires);
  }
  reject(r, 'PRODUCT_ROLE');
});
