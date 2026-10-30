import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { generate } from '../generators/scala-cqrs-application/generate.mjs';

const base = new URL('./fixtures/', import.meta.url);
const read = name => structuredClone(readProductRequest(new URL(name + '/files.json', base).pathname));
const roles = ['resource-policy', 'external-submission', 'external-query', 'external-event', 'occurrence-source', 'readside', 'deployment'];
const canonical = r => r.documents.find(d => d.id === 'domain').value;
function legalPipeline() {
  const r = read('inventory-invocation-products'), direct = read('inventory-host-products'), c = canonical(r), d = canonical(direct);
  for (const key of ['aggregates', 'types', 'ports']) for (const row of d[key]) {
    const old = c[key].find(x => x.name === row.name);
    if (old) assert.deepEqual(old, row); else c[key].push(structuredClone(row));
  }
  const complete = d.artifactContracts.find(a => a.id === 'inventory-technical');
  const index = c.artifactContracts.findIndex(a => a.id === complete.id), prior = c.artifactContracts[index];
  for (const key of ['id', 'version', 'artifact', 'status', 'provenance', 'references']) assert.deepEqual(prior[key], complete[key]);
  assert.ok(prior.ports.every(p => complete.ports.some(x => isDeepStrictEqual(p, x))));
  assert.ok(prior.implementations.every(p => complete.implementations.some(x => isDeepStrictEqual(p, x))));
  c.artifactContracts[index] = structuredClone(complete);
  c.sagaHosts[0].technicalPorts.push(...structuredClone(d.sagaHosts[0].technicalPorts.filter(p => roles.includes(p.role))));
  const layout = r.documents.find(d => d.id === 'references').value.layout;
  for (const original of direct.documents.find(d => d.id === 'references').value.layout.declarations) {
    const old = layout.declarations.find(d => isDeepStrictEqual(d.ref, original.ref));
    if (old) { assert.deepEqual(old, original); continue; }
    const declaration = structuredClone(original), match = /^\/(types|ports)\/(\d+)(.*)$/u.exec(declaration.source.pointer);
    assert.ok(match); const index = c[match[1]].findIndex(x => x.name === d[match[1]][Number(match[2])].name); assert.ok(index >= 0);
    declaration.source.pointer = '/' + match[1] + '/' + index + match[3]; layout.declarations.push(declaration);
  }
  r.documents.find(d => d.id === 'hosts').value.hosts.hosts = c.sagaHosts.map((h, i) => ({ ...structuredClone(h), source: { document: 'domain', pointer: '/sagaHosts/' + i } }));
  r.documents.find(d => d.id === 'artifacts').value.artifacts.artifacts = c.artifactContracts.map((a, i) => ({ ...structuredClone(a), source: { document: 'domain', pointer: '/artifactContracts/' + i } }));
  return r;
}
const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-application/generator.json', import.meta.url)));
const options = () => JSON.parse(readFileSync(new URL('inventory-invocation-products/options.json', base)));
test('full legally admitted pipeline with each explicit role keeps whole parent and installed boundary', () => {
  for (const role of roles) {
    const r = legalPipeline(), c = canonical(r);
    c.sagaHosts[0].technicalPorts = c.sagaHosts[0].technicalPorts.filter(p => !roles.includes(p.role) || p.role === role);
    r.documents.find(d => d.id === 'hosts').value.hosts.hosts = c.sagaHosts.map((h, i) => ({ ...structuredClone(h), source: { document: 'domain', pointer: '/sagaHosts/' + i } }));
    const compilation = compileProductSet(r); assert.deepEqual(compilation.diagnostics, [], role);
    const plan = generate({ compilation, manifest, options: options() }); assert.deepEqual(plan.diagnostics, [], role);
    const host = plan.plan.entries.find(e => e.kind === 'invocation-host').content;
    const verification = plan.plan.entries.find(e => e.path === 'src/test/scala/GeneratedExtendedPortsSpec.scala').content;
    assert.ok(!host.includes('final case class Submit(') && !verification.includes('Host.Submit(') && !verification.includes('SubmitOccurrence'));
    assert.ok(host.includes('Effect.persist(Associated(original, args, operation))'));
    const name = c.sagaHosts[0].technicalPorts.find(p => p.role === role).port.ref.id;
    assert.ok(verification.includes('installedTechnical.' + name + '('));
    assert.ok(plan.plan.entries.some(e => e.path === 'src/test/scala/GeneratedRequiredBindingsSpec.scala'));
  }
});
test('complete all-role pipeline has the full nominal source closure and rejects wrong owner before plans', () => {
  const r = legalPipeline(), compilation = compileProductSet(r); assert.deepEqual(compilation.diagnostics, []);
  const first = generate({ compilation, manifest, options: options() }); assert.equal(first.plan.entries.length, 84);
  assert.deepEqual(generate({ compilation, manifest, options: options() }), first);
  canonical(r).sagaHosts[0].entry.startOwner.stepId = 'missing';
  const result = compileProductSet(r); assert.equal(result.result, null); assert.ok(result.diagnostics.some(d => d.code === 'HOST_START_OWNER'));
});
