import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';

const captured = readProductRequest(fileURLToPath(new URL('./fixtures/inventory-host-products/files.json', import.meta.url)));
const fixture = () => structuredClone(captured);
const doc = (v, id) => v.documents.find(d => d.id === id).value;
const canonical = v => doc(v, 'domain');
const host = v => canonical(v).sagaHosts[0];
const ids = host(captured).technicalPorts.map(p => p.port.ref.id);
const row = (v, id) => host(v).technicalPorts.find(p => p.port.ref.id === id);
function refresh(v) {
  doc(v, 'hosts').hosts.hosts = canonical(v).sagaHosts.map((h, i) => ({ ...structuredClone(h), source: { document: 'domain', pointer: '/sagaHosts/' + i } }));
  doc(v, 'artifacts').artifacts.artifacts = canonical(v).artifactContracts.map((a, i) => ({ ...structuredClone(a), source: { document: 'domain', pointer: '/artifactContracts/' + i } }));
}
function denied(v, code) {
  refresh(v);
  const before = structuredClone(v), first = compileProductSet(v);
  assert.equal(first.result, null, code);
  assert.ok(first.diagnostics.some(d => d.code === code), JSON.stringify(first.diagnostics));
  assert.deepEqual(compileProductSet(v), first);
  assert.deepEqual(v, before);
}
function addOwner(v, portId, status, move) {
  const first = canonical(v).artifactContracts[0];
  const port = first.ports.find(p => p.ref.id === portId), implementation = first.implementations.find(p => p.port.id === portId);
  const second = { ...structuredClone(first), id: 'inventory-technical-second', artifact: { ...structuredClone(first.artifact), id: 'InventoryTechnicalSecond' },
    status, ports: [structuredClone(port)], implementations: [structuredClone(implementation)] };
  if (move) {
    first.ports = first.ports.filter(p => p.ref.id !== portId);
    first.implementations = first.implementations.filter(p => p.port.id !== portId);
  }
  canonical(v).artifactContracts.push(second);
  doc(v, 'references').layout.declarations.push({ ref: structuredClone(second.artifact), valueType: null,
    source: { document: 'domain', pointer: '/artifactContracts/1' }, dependencies: [] });
}
test('all 37 typed ports reject proposal and historical owners and wrong implementation pins', () => {
  assert.equal(ids.length, 37);
  for (const id of ids) {
    for (const status of ['proposal', 'historical']) {
      const v = fixture(); addOwner(v, id, status, true); denied(v, 'HOST_IMPLEMENTATION');
    }
    for (const key of ['id', 'version']) {
      const v = fixture(); row(v, id).implementation[key] = 'wrong-' + key; denied(v, 'HOST_IMPLEMENTATION');
    }
  }
});
test('core obligations and exact role labels remain required; removing an opt-in declaration does not invent it', () => {
  for (const [i, id] of ids.entries()) {
    const v = fixture(); host(v).technicalPorts = host(v).technicalPorts.filter(p => p.port.ref.id !== id);
    if (i < 30) denied(v, 'HOST_IMPLEMENTATION');
    else {
      refresh(v); assert.deepEqual(compileProductSet(v).diagnostics, [], id);
      const required = fixture(); row(required, id).implementation.version = 'missing-selected-implementation'; denied(required, 'HOST_IMPLEMENTATION');
    }
    const relabelled = fixture(); row(relabelled, id).role = 'unknown-role'; denied(relabelled, 'HOST_PORT');
  }
});
test('overlapping selected ownership is ambiguous for every port; proposal is not another selected owner', () => {
  for (const id of ids) { const v = fixture(); addOwner(v, id, 'selected', false); denied(v, 'HOST_IMPLEMENTATION'); }
  const v = fixture(); addOwner(v, ids[0], 'proposal', false); refresh(v); assert.deepEqual(compileProductSet(v).diagnostics, []);
});
test('two explicit selected artifacts can own disjoint ports without first-owner fallback', () => {
  for (const id of ['ResourcePolicy0', 'Deployment0', ids[0], ids[10]]) {
    const v = fixture(); addOwner(v, id, 'selected', true); refresh(v);
    const result = compileProductSet(v); assert.deepEqual(result.diagnostics, []);
    const artifacts = result.result.products.find(p => p.id === 'artifact-contract').payload.artifacts;
    assert.equal(artifacts.length, 2); assert.equal(artifacts.reduce((n, a) => n + a.ports.length, 0), 37);
    assert.ok(artifacts.every(a => a.status === 'selected'));
  }
});
test('same nominal resource carrier cannot replace explicit per-participant source lineage', () => {
  const resources = host(captured).participants.map(p => p.resourceInput);
  assert.notDeepEqual(resources[0], resources[1]);
  const v = fixture(); host(v).participants[0].resourceInput = structuredClone(resources[1]); denied(v, 'HOST_RESOURCE');
  const association = fixture(); host(association).association.inputKeys = [structuredClone(resources[0])]; denied(association, 'HOST_ASSOCIATION');
});
