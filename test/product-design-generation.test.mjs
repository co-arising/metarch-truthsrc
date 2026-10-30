import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, realpathSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generate } from '../generators/product-design-review/generate.mjs';
import { generateProductCli } from '../lib/products/generate-cli.mjs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { planProductSet } from '../src/core/product-plan.mjs';
import { produce } from '../generators/product-design-review/produce.mjs';
import { designRequest, compiledDesign } from './product-design-fixtures.mjs';
const manifest = JSON.parse(readFileSync(new URL('../generators/product-design-review/generator.json', import.meta.url), 'utf8'));
const generator = realpathSync(new URL('../generators/product-design-review/', import.meta.url));
const fixture = name => realpathSync(new URL('./fixtures/product-design-products/' + name + '/files.json', import.meta.url));
const options = name => realpathSync(new URL('./fixtures/product-design-products/' + name + '/options.json', import.meta.url));
const compilation = name => ({ result: compiledDesign(name), diagnostics: [] });

test('both independent designs render a full deterministic seven-entry review-only plan', () => {
  for (const name of ['inventory', 'appointment']) {
    const input = { compilation: compilation(name), manifest, options: {} };
    const first = generate(input); assert.deepEqual(first, generate(input));
    assert.deepEqual(first.diagnostics, []); assert.equal(first.plan.entries.length, 7);
    assert.equal(first.plan.targetProfile, 'product-design-review@1');
    assert.equal(first.plan.entries.filter(e => e.kind === 'design-plane').length, 5);
    const model = JSON.parse(first.plan.entries.find(e => e.kind === 'design-model').content);
    assert.equal(model.purpose, 'design-review-only'); assert.equal(model.runnable, false);
    const graph = first.plan.entries.find(e => e.path === 'design/skeleton.mmd').content;
    assert.ok(graph.includes('&quot;') && graph.includes('<br/>') && graph.includes('action-target'));
    assert.ok(!graph.includes('<script>') && !graph.includes('Submit('));
    assert.ok(first.plan.entries.every(e => e.knowledgeIds.length && e.productFootprint.length === 2 && !e.path.endsWith('.scala')));
    const index = JSON.parse(first.plan.entries.find(e => e.kind === 'design-source-index').content);
    assert.ok(index.sources.some(s => s.role === 'action-parameter' && s.related.length === 1));
    assert.ok(index.sources.some(s => s.role === 'domain-reference' && s.references[0].kind === 'type'));
  }
});
test('design producer cannot read undeclared canonical products or accept runtime/UI options', () => {
  const input = { compilation: compilation('inventory'), manifest, options: { packages: [] } };
  assert.equal(generate(input).plan, null);
  const bad = planProductSet({ ...input, options: {} }, { 'product-design-review': { version: '1', produce: context => { context.products.canonical; return produce(context); } } });
  assert.ok(bad.diagnostics.some(d => d.code === 'PRODUCT_UNDECLARED'));
  const forged = compilation('inventory');
  forged.result = structuredClone(forged.result); forged.result.products.find(p => p.id === 'product-design').payload.designs[0].status = 'accepted';
  assert.equal(generate({ compilation: forged, manifest, options: {} }).plan, null);
});
test('each independent producer execution is fully validated, not just first output or paths', () => {
  let calls = 0;
  const bad = planProductSet({ compilation: compilation('inventory'), manifest, options: {} }, { 'product-design-review': { version: '1', produce: context => {
    const result = produce(context); if (++calls === 2) result[0].productFootprint = []; return result;
  } } });
  assert.ok(bad.diagnostics.some(d => d.code === 'PRODUCT_ENTRY'));
});
test('public file generation --plan writes no target; actual apply retains all review files and anchors', async () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'p24-design-cli-'))), out = join(parent, 'review');
  const args = ['--request', fixture('appointment'), '--generator', generator, '--out', out, '--options-json', options('appointment')];
  const planned = await generateProductCli([...args, '--plan']);
  assert.equal(planned.applied, false); assert.equal(planned.plan.entries.length, 7); assert.equal(existsSync(out), false);
  const applied = await generateProductCli(args);
  assert.equal(applied.applied, true);
  for (const entry of planned.plan.entries) assert.equal(readFileSync(join(out, entry.path), 'utf8'), entry.content);
  assert.ok(existsSync(join(out, 'anchors.json')) && existsSync(join(out, 'truthsrc.ledger.json')));
  assert.equal(existsSync(join(out, 'build.sbt')), false); assert.equal(existsSync(join(out, 'app')), false);
});
test('public command-line --plan dispatches the shipped review target with zero output writes', () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'p24-design-public-cli-'))), out = join(parent, 'review');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../bin/truthsrc.js', import.meta.url)), 'generate-products', '--request', fixture('inventory'), '--generator', generator, '--out', out, '--options-json', options('inventory'), '--plan'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(out), false);
  const value = JSON.parse(result.stdout);
  assert.equal(value.plan.targetProfile, 'product-design-review@1'); assert.equal(value.plan.entries.length, 7);
});

test('wrong source profile and forged file producer manifest fail before creating targets', async () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'p24-design-cli-negative-'))), out = join(parent, 'review');
  const optionsFile = join(parent, 'options.json'); writeFileSync(optionsFile, '{"runnable":true}');
  await assert.rejects(generateProductCli(['--request', fixture('inventory'), '--generator', generator, '--out', out, '--options-json', optionsFile]), /PRODUCT_|missing|unsupported|plan/iu);
  assert.equal(existsSync(out), false);
  const c = compilation('inventory');
  const domain = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-domain/generator.json', import.meta.url), 'utf8'));
  assert.equal(planProductSet({ compilation: c, manifest: domain, options: { packages: [], verificationCases: [] } }, {}).plan, null);
});
