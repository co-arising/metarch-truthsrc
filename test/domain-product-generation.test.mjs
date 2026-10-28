import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { PROFILES } from '../lib/products/registry.mjs';
import { generate } from '../generators/scala-cqrs-domain/generate.mjs';

export function generationFixture() {
  const r = structuredClone(readProductRequest(fileURLToPath(new URL('./fixtures/external-events/files.json', import.meta.url))));
  const canonical = r.documents.find(d => d.id === 'domain').value;
  const layout = r.documents.find(d => d.id === 'references').value.layout;
  const ref = id => ({ context: 'measurement', kind: 'type', owner: [], id });
  for (const id of ['WireRatio', 'PoRatio']) {
    const index = canonical.valueObjects.length;
    canonical.valueObjects.push({ context: 'measurement', name: id, version: '1', dataType: 'String' });
    layout.declarations.push({ ref: ref(id), valueType: { form: 'primitive', name: 'string' }, source: { document: 'domain', pointer: '/valueObjects/' + index }, dependencies: [] });
  }
  r.documents.push({ id: 'codecs', schemaVersion: 'truthsrc.exact-codec-binding/v1', value: { schemaVersion: 'truthsrc.exact-codec-binding/v1', codecs: [{
    domain: ref('Ratio'), domainVersion: '1', id: 'ratio-text', version: '1', format: 'fixed-decimal-text',
    wire: { ref: ref('WireRatio'), version: '1', amountMember: null, unitMember: null },
    po: { ref: ref('PoRatio'), version: '1', amountMember: null, unitMember: null }, source: { document: 'codecs', pointer: '/codecs/0' },
  }] } });
  const p = PROFILES['exact-value-codecs'];
  r.requirements.push({ id: 'exact-value-codecs', version: p.version, payloadSchemaVersion: p.payloadSchemaVersion,
    capabilities: structuredClone(p.capabilities), requires: structuredClone(p.requires), inputRoles: { canonical: 'domain', exactCodecBinding: 'codecs' } });
  return r;
}
const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-domain/generator.json', import.meta.url)));
const options = JSON.parse(readFileSync(new URL('./fixtures/domain-generation/options.json', import.meta.url)));
test('six real producers return a complete deterministic typed source plan', () => {
  const request = generationFixture(), compilation = compileProductSet(request);
  assert.deepEqual(compilation.diagnostics, []);
  const result = generate({ compilation, manifest, options });
  assert.deepEqual(result.diagnostics, []); assert.ok(result.plan);
  assert.deepEqual(generate({ compilation, manifest, options }), result);
  const kinds = new Set(result.plan.entries.map(e => e.kind));
  for (const kind of manifest.artifactKinds) assert.ok(kinds.has(kind), kind);
  for (const e of result.plan.entries) assert.ok(e.content && !e.content.includes('???'));
  assert.match(result.plan.entries.find(e => e.kind === 'rules').content, /checkedAmount/);
  assert.match(result.plan.entries.find(e => e.kind === 'event-handler').content, /val next0[\s\S]*val next1[\s\S]*state\.copy/);
  assert.match(result.plan.entries.find(e => e.kind === 'converter').content, /RatioToPO/);
});
test('domain source profile refuses missing codec and implicit package options', () => {
  const compilation = compileProductSet(generationFixture());
  assert.equal(generate({ compilation, manifest, options: {} }).plan, null);
  const r = generationFixture(); r.requirements = r.requirements.filter(p => p.id !== 'exact-value-codecs'); r.documents = r.documents.filter(d => d.id !== 'codecs');
  const result = generate({ compilation: compileProductSet(r), manifest, options });
  assert.equal(result.plan, null); assert.equal(result.diagnostics[0].code, 'PRODUCT_PLAN_REQUIRED');
});
