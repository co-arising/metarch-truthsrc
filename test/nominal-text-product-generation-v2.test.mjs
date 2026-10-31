import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTree } from '../lib/compile.mjs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { profileFor } from '../lib/products/registry.mjs';
import { generateProductCli } from '../lib/products/generate-cli.mjs';
import { generate as domainV2 } from '../generators/scala-cqrs-domain-v2/generate.mjs';
import { generate as effectV2 } from '../generators/scala-cqrs-effect-application-v2/generate.mjs';
import { generate as applicationV2 } from '../generators/scala-cqrs-application-v2/generate.mjs';
import { generate as childV2 } from '../generators/scala-cqrs-child-application-v2/generate.mjs';
import { generate as legacyApplication } from '../generators/scala-cqrs-application/generate.mjs';
import { generate as legacyChild } from '../generators/scala-cqrs-child-application/generate.mjs';
import { generate as legacyDomain } from '../generators/scala-cqrs-domain/generate.mjs';
import { generate as legacyEffect } from '../generators/scala-cqrs-effect-application/generate.mjs';

const root = new URL('./fixtures/tickets-domain-v4-products/', import.meta.url);
const json = url => JSON.parse(readFileSync(url, 'utf8'));
const request = () => readProductRequest(fileURLToPath(new URL('files.json', root)));
const manifest = name => json(new URL('../generators/' + name + '/generator.json', import.meta.url));
const source = value => value.documents.find(d => d.id === 'domain').value;
const reject = value => { const result = compileProductSet(value); assert.equal(result.result, null); assert.ok(result.diagnostics.length); };

test('tree-backed nominal text v4 has complete checked products and deterministic v2 source plan', () => {
  const input = request(), before = structuredClone(input);
  assert.equal(compileTree(fileURLToPath(new URL('tree', root))), readFileSync(new URL('domain.json', root), 'utf8'));
  const compilation = compileProductSet(input);
  assert.deepEqual(compilation.diagnostics, []);
  assert.equal(compilation.result.products.length, 7);
  const args = { compilation, manifest: manifest('scala-cqrs-domain-v2'), options: json(new URL('options.json', root)) };
  const first = domainV2(args);
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(domainV2(args), first);
  assert.deepEqual(input, before);
  const rules = first.plan.entries.find(e => e.kind === 'rules');
  assert.ok(rules.content.includes('(p.`type`).value'));
  assert.ok(rules.productFootprint.some(p => p.id === 'domain-decision' && p.version === '4'));
  assert.ok(first.plan.entries.some(e => e.kind === 'proto'));
  assert.ok(first.plan.entries.some(e => e.kind === 'serialization-adapter'));
  const old = legacyDomain({ ...args, manifest: manifest('scala-cqrs-domain') });
  assert.equal(old.plan, null);
  assert.ok(old.diagnostics.length);
});

test('full v4 admission rejects source, binding, nominal carrier and old profile mutations', () => {
  for (const change of [
    r => { source(r).aggregates[0].commands[0].guards[0].cond = 'param.type.nonEmpty'; },
    r => { source(r).valueObjects[0].dataType = 'Long'; },
    r => { source(r).valueObjects[0].name = 'DifferentTicketId'; },
    r => { source(r).valueObjects[0].context = 'foreign'; },
    r => { source(r).valueObjects[0].type = 'Long'; },
    r => { source(r).valueObjects[0].fields = [{ name: 'text', dataType: 'String' }]; },
    r => { r.documents.find(d => d.id === 'decisions').value.decisions.commands[0].decisions[0].predicate.argument.op = 'is-empty'; },
    r => { r.documents.find(d => d.id === 'folds').value.folds.defaults.pop(); },
    r => { r.documents.find(d => d.id === 'dependencies').value.dependencies.commands.pop(); },
    r => { r.requirements.find(p => p.id === 'domain-dependencies').requires.find(p => p.id === 'domain-decision').version = '3'; },
    r => { r.documents.find(d => d.id === 'decisions').schemaVersion = 'truthsrc.domain-semantic-binding/v3'; },
  ]) { const changed = structuredClone(request()); change(changed); reject(changed); }
});

test('explicit effect application v2 consumes only new versions while unchanged legacy fixture still uses v1', () => {
  const oldRoot = new URL('./fixtures/inventory-mixed-effect-products/', import.meta.url);
  const input = structuredClone(readProductRequest(fileURLToPath(new URL('files.json', oldRoot))));
  const old = structuredClone(input);
  for (const [id, version, doc, schema] of [
    ['domain-decision', '4', 'decisions', 'truthsrc.domain-semantic-binding/v4'],
    ['domain-dependencies', '6', 'dependencies', 'truthsrc.domain-dependency-binding/v6'],
    ['domain-folds', '6', 'folds', 'truthsrc.domain-fold-binding/v6'],
  ]) {
    const profile = profileFor(id, version), row = input.requirements.find(r => r.id === id);
    Object.assign(row, { version, payloadSchemaVersion: profile.payloadSchemaVersion, capabilities: profile.capabilities, requires: profile.requires });
    const document = input.documents.find(d => d.id === doc);
    document.schemaVersion = schema; document.value.schemaVersion = schema;
  }
  const compilation = compileProductSet(input), options = json(new URL('options.json', oldRoot));
  assert.deepEqual(compilation.diagnostics, []);
  const current = effectV2({ compilation, options, manifest: manifest('scala-cqrs-effect-application-v2') });
  assert.deepEqual(current.diagnostics, []);
  const legacy = legacyEffect({ compilation: compileProductSet(old), options, manifest: manifest('scala-cqrs-effect-application') });
  assert.deepEqual(legacy.diagnostics, []);
  assert.deepEqual(current.plan.entries.map(e => [e.path, e.content]), legacy.plan.entries.map(e => [e.path, e.content]));
  const refused = legacyEffect({ compilation, options, manifest: manifest('scala-cqrs-effect-application') });
  assert.equal(refused.plan, null);
  assert.ok(current.plan.entries.filter(e => e.kind === 'rules').every(e => e.productFootprint.some(p => p.id === 'domain-decision' && p.version === '4')));
});

for (const [fixture, name, currentGenerate, legacyGenerate, count] of [
  ['inventory-host-products', 'scala-cqrs-application', applicationV2, legacyApplication, 83],
  ['inventory-child-products', 'scala-cqrs-child-application', childV2, legacyChild, 82],
]) test(name + ' v2 independently preserves complete sources and rejects old-version substitution', () => {
  const fixtureRoot = new URL('./fixtures/' + fixture + '/', import.meta.url);
  const old = readProductRequest(fileURLToPath(new URL('files.json', fixtureRoot)));
  const input = structuredClone(old);
  for (const [id, version, documentId, schemaVersion] of [
    ['domain-decision', '4', 'decisions', 'truthsrc.domain-semantic-binding/v4'],
    ['domain-dependencies', '6', 'dependencies', 'truthsrc.domain-dependency-binding/v6'],
    ['domain-folds', '6', 'folds', 'truthsrc.domain-fold-binding/v6'],
  ]) {
    const profile = profileFor(id, version);
    Object.assign(input.requirements.find(r => r.id === id), { version,
      payloadSchemaVersion: profile.payloadSchemaVersion, capabilities: profile.capabilities, requires: profile.requires });
    const document = input.documents.find(d => d.id === documentId);
    document.schemaVersion = schemaVersion; document.value.schemaVersion = schemaVersion;
  }
  const compilation = compileProductSet(input), options = json(new URL('options.json', fixtureRoot));
  assert.deepEqual(compilation.diagnostics, []);
  const args = { compilation, options, manifest: manifest(name + '-v2') };
  const output = currentGenerate(args);
  assert.deepEqual(output.diagnostics, []);
  assert.equal(output.plan.entries.length, count);
  assert.deepEqual(currentGenerate(args), output);
  const legacy = legacyGenerate({ compilation: compileProductSet(old), options, manifest: manifest(name) });
  assert.deepEqual(legacy.diagnostics, []);
  assert.deepEqual(output.plan.entries.map(e => [e.path, e.content]), legacy.plan.entries.map(e => [e.path, e.content]));
  assert.ok(output.plan.entries.filter(e => e.kind === 'rules').every(e => e.productFootprint.some(p => p.id === 'domain-decision' && p.version === '4')));
  assert.equal(legacyGenerate({ compilation, options, manifest: manifest(name) }).plan, null);
  assert.equal(currentGenerate({ ...args, compilation: compileProductSet(old) }).plan, null);
  assert.throws(() => currentGenerate({ ...args, options: { ...options, runtimeArtifact: { ...options.runtimeArtifact, sha256: '0'.repeat(64) } } }), e => e.diagnostic?.code === 'APPLICATION_ARTIFACT');
});

test('shipped v2 CLI plans without target writes and refuses implicit legacy consumption', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'nominal-v4-plan-')), target = join(parent, 'absent');
  const args = ['--request', fileURLToPath(new URL('files.json', root)), '--generator', fileURLToPath(new URL('../generators/scala-cqrs-domain-v2', import.meta.url)), '--out', target, '--options-json', fileURLToPath(new URL('options.json', root)), '--plan'];
  const result = await generateProductCli(args);
  assert.equal(result.applied, false); assert.ok(result.plan.entries.length > 0); assert.equal(existsSync(target), false);
  args[3] = fileURLToPath(new URL('../generators/scala-cqrs-domain', import.meta.url));
  await assert.rejects(() => generateProductCli(args));
  assert.equal(existsSync(target), false);
});
