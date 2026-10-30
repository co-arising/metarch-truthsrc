import test from 'node:test';
import assert from 'node:assert/strict';
import { compileProductSet } from '../lib/products/compile.mjs';
import { DESIGN_PLANES } from '../lib/products/designs.mjs';
import { designRequest, compiledDesign } from './product-design-fixtures.mjs';

const domain = r => r.documents.find(d => d.id === 'domain').value;
const design = r => domain(r).productDesigns[0];
const node = (r, kind) => design(r).nodes.find(n => n.kind === kind);
function rejected(name, code, change) {
  const r = designRequest(name); change(r);
  const result = compileProductSet(r);
  assert.equal(result.result, null);
  assert.ok(result.diagnostics.some(d => d.code === code), JSON.stringify(result.diagnostics));
}
test('two independent designs preserve all five explicit planes, sources and static-only status', () => {
  for (const name of ['inventory', 'appointment']) {
    const set = compiledDesign(name), d = set.products.find(p => p.id === 'product-design').payload.designs[0];
    assert.deepEqual([...new Set(d.nodes.map(n => n.plane))].sort(), [...DESIGN_PLANES].sort());
    assert.ok(d.nodes.every(n => n.source.document === 'domain'));
    assert.ok(d.relations.every(r => r.source.pointer.startsWith('/productDesigns/0/relations/')));
    assert.equal(set.readiness.runnable, false); assert.equal(set.readiness.runtimeBindingVerified, false);
    assert.equal(d.status, name === 'inventory' ? 'proposal' : 'accepted');
  }
});
test('inventory action preserves four input origins and exact nominal parameter types', () => {
  const d = compiledDesign('inventory').products.find(p => p.id === 'product-design').payload.designs[0];
  const a = d.nodes.find(n => n.action).action;
  assert.deepEqual(a.parameters.map(p => p.parameter.id), ['txid', 'warehouse', 'sku', 'quantity']);
  assert.deepEqual(a.parameters.map(p => p.origin).sort(), ['host-generated', 'propagated', 'trusted-context', 'user']);
  assert.deepEqual(a.parameters[0].valueType, { form: 'nominal', ref: { context: 'inventory', kind: 'type', owner: [], id: 'TxId' } });
  assert.ok(a.parameters.every(p => p.parameterSource.pointer.includes('/commands/0/parameters/')));
});
test('appointment preserves author decision, machine intent and typed terminal watermark without runtime approval', () => {
  const set = compiledDesign('appointment'), d = set.products.find(p => p.id === 'product-design').payload.designs[0];
  assert.deepEqual(d.approvalSource, { document: 'domain', pointer: '/designDecisions/0' });
  const f = d.nodes.find(n => n.feedback?.evidence === 'terminal').feedback;
  assert.equal(f.state, 'succeeded'); assert.equal(f.watermark.semantics, 'business-revision');
  assert.deepEqual(f.watermark.valueType, { form: 'primitive', name: 'integer' });
  assert.ok(d.nodes.some(n => n.action?.actor === 'machine' && n.action.intent === 'machine'));
  assert.equal(set.readiness.runnable, false);
});
test('missing planes, invalid node kinds and duplicate node or relation identities are rejected', () => {
  rejected('inventory', 'DESIGN_COVERAGE', r => { design(r).nodes = design(r).nodes.filter(n => n.plane !== 'surface'); });
  rejected('inventory', 'DESIGN_KIND', r => { node(r, 'screen').plane = 'surface'; });
  rejected('inventory', 'DESIGN_DUPLICATE', r => { design(r).nodes.push(structuredClone(node(r, 'screen'))); });
  rejected('inventory', 'DESIGN_DUPLICATE', r => { design(r).relations.push(structuredClone(design(r).relations[0])); });
});
test('relations require exact owner and endpoint kinds, not labels or inferred order', () => {
  rejected('inventory', 'DESIGN_OWNER', r => { design(r).relations[0].to.artifact.id = 'other-design'; });
  rejected('inventory', 'DESIGN_OWNER', r => { design(r).relations[0].to.id = 'not-authored'; });
  rejected('inventory', 'DESIGN_RELATION', r => { const edge = design(r).relations.find(e => e.kind === 'action-target'); edge.to.kind = 'screen'; edge.to.id = 'screen'; });
  rejected('inventory', 'DESIGN_TARGET', r => { design(r).relations = design(r).relations.filter(e => e.kind !== 'action-target'); });
});
test('unknown and pending cannot claim terminal evidence; terminal needs keys and watermark', () => {
  rejected('inventory', 'DESIGN_FEEDBACK', r => { node(r, 'feedback').feedback.evidence = 'terminal'; });
  rejected('appointment', 'DESIGN_FEEDBACK', r => { design(r).nodes.find(n => n.feedback?.evidence === 'terminal').feedback.watermark = null; });
  rejected('appointment', 'DESIGN_FEEDBACK', r => { design(r).nodes.find(n => n.feedback?.evidence === 'terminal').feedback.resourceKeys = []; });
  rejected('appointment', 'DESIGN_FEEDBACK', r => { node(r, 'feedback').feedback.resourceKeys[0].owner[1] = 'AppointmentConfirmed'; });
});
test('all and only command parameters need input sources in canonical order with exact nominal propagation', () => {
  rejected('inventory', 'DESIGN_INPUT', r => { node(r, 'action').action.parameters.shift(); });
  rejected('inventory', 'DESIGN_INPUT', r => { node(r, 'action').action.parameters.push(structuredClone(node(r, 'action').action.parameters[0])); });
  rejected('inventory', 'DESIGN_INPUT', r => { node(r, 'action').action.parameters[0].parameter.owner[1] = 'RequestSkuReservation'; });
  rejected('inventory', 'DESIGN_INPUT', r => { node(r, 'action').action.parameters[2].from = null; });
  rejected('inventory', 'DESIGN_INPUT', r => { node(r, 'action').action.parameters[2].from.id = 'warehouse'; });
});
test('machine action cannot be public or contain a user input', () => {
  rejected('appointment', 'DESIGN_INTENT', r => { design(r).nodes.find(n => n.id === 'machine-action').action.intent = 'public'; });
  rejected('appointment', 'DESIGN_INPUT', r => { const p = design(r).nodes.find(n => n.id === 'machine-action').action.parameters[0]; p.origin = 'user'; p.from = null; });
});
test('accepted status requires an explicit same-version authored decision and real provenance', () => {
  rejected('inventory', 'DESIGN_APPROVAL', r => { design(r).status = 'accepted'; });
  rejected('appointment', 'DESIGN_APPROVAL', r => { domain(r).designDecisions[0].version = '2'; });
  rejected('appointment', 'PRODUCT_SHAPE', r => { domain(r).designDecisions[0].author = ''; });
  rejected('inventory', 'PRODUCT_SOURCE', r => { design(r).provenance[0].pointer = '/not-authored'; });
  rejected('inventory', 'DESIGN_SOURCE', r => { design(r).provenance = []; });
});
test('unknown fields and altered full bindings cannot silently become design semantics', () => {
  rejected('inventory', 'PRODUCT_FIELD_UNKNOWN', r => { node(r, 'screen').route = '/not-generated'; });
  rejected('inventory', 'PRODUCT_SHAPE', r => { design(r).references.push(null); });
  rejected('inventory', 'PRODUCT_SHAPE', r => { node(r, 'action').action.parameters[0].slot = 'x'.repeat(65537); });
  rejected('inventory', 'PRODUCT_PAYLOAD_MISMATCH', r => { r.documents.find(d => d.id === 'designs').value.designs.designs[0].nodes[0].label = 'forged binding label'; });
  rejected('inventory', 'PRODUCT_VERSION', r => { r.documents.find(d => d.id === 'designs').schemaVersion = 'truthsrc.product-design-binding/v2'; });
});
test('complete canonical command and event owners cannot be replaced by same-shape declarations', () => {
  rejected('inventory', 'DESIGN_OWNER', r => { domain(r).aggregates[0].name = 'DifferentWarehouse'; });
  rejected('inventory', 'DESIGN_OWNER', r => { r.documents.find(d => d.id === 'references').value.layout.declarations.find(d => d.ref.kind === 'event' && d.ref.id === 'SkuQuantityReserved').source.pointer = '/productDesigns/0'; });
});
test('contains and precedes cycles are rejected without adding implicit edges', () => {
  rejected('appointment', 'DESIGN_RELATION', r => {
    const edge = structuredClone(design(r).relations.find(e => e.kind === 'precedes'));
    edge.id = 'reverse-precedes'; [edge.from, edge.to] = [edge.to, edge.from]; design(r).relations.push(edge);
  });
});
test('unused missing requirements and source roles cannot sneak design products into legacy profiles', () => {
  rejected('inventory', 'PRODUCT_DEPENDENCY', r => { r.requirements = r.requirements.filter(p => p.id !== 'reference-layout'); });
  rejected('inventory', 'PRODUCT_DOCUMENT_UNUSED', r => { r.requirements = r.requirements.filter(p => p.id !== 'product-design'); });
  rejected('inventory', 'PRODUCT_ROLE', r => { r.requirements.find(p => p.id === 'product-design').inputRoles.canonical = 'references'; });
});
