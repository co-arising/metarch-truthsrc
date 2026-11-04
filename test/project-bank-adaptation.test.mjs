import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compileTree } from '../lib/compile.mjs';
import { captureProject, projectCli } from '../lib/project/cli.mjs';

// Explicit local opt-in: ordinary tool tests never require a sibling application.
const bank = process.env.TRUTHSRC_BANK_ROOT;
test('current bank tree and explicit technical bindings use the same project entry without historical complete requests', { skip: !bank }, async t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-bank-project-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tree = join(resolve(bank), 'v1/tree'), canonical = JSON.parse(compileTree(tree));
  const context = 'bankwealth', ref = (kind, id, owner = []) => ({ context, kind, owner, id });
  const types = ['Money', 'AmountDecimal'].map(name => {
    const row = canonical.valueObjects.find(v => v.name === name), unit = name === 'Money';
    return { domain: ref('type', name), version: row.version, form: unit ? 'unit-decimal' : 'decimal', precision: 38, scale: 2,
      amountMember: unit ? ref('member', 'amount', [name]) : null, unitMember: unit ? ref('member', 'currency', [name]) : null, units: unit ? ['CNY'] : [] };
  });
  const codecs = types.map(type => {
    const name = type.domain.id, unit = type.form === 'unit-decimal';
    const carrier = suffix => ({ ref: ref('type', name + suffix), version: canonical.valueObjects.find(v => v.name === name + suffix).version,
      amountMember: unit ? ref('member', 'minorUnits', [name + suffix]) : null, unitMember: unit ? ref('member', 'currency', [name + suffix]) : null });
    return { domain: type.domain, domainVersion: type.version, id: 'bank-v1-' + name + '-minor-units', version: '1', format: 'minor-units-text', wire: carrier('Wire'), po: carrier('PO') };
  });
  const config = JSON.parse(readFileSync(new URL('../scaffold/local-project/truthsrc.project.json', import.meta.url)));
  Object.assign(config, { tree, canonicalId: 'bank-v1', context, exactTypes: types, exactCodecs: codecs,
    options: { packages: [{ context, package: 'example.bankwealth' }], verificationCases: [] } });
  for (const [flow, directory, names] of [
    ['payment', 'payment-authored-165', ['sagas', 'runtime', 'execution']],
    ['refund', 'refund-authored-282', ['sagas', 'runtime', 'execution']],
    ['sip', 'sip-authored-307', ['execution']], ['ta', 'ta-authored-297', ['execution']],
  ]) for (const name of names) config.documents.push({ id: flow + '-' + name, file: join(resolve(bank), 'v1/formal-inputs', directory, name + '.json') });
  config.assemblies = [
    { id: 'sagas', kind: 'saga-bindings-union', sources: ['payment-sagas', 'refund-sagas'] },
    { id: 'runtime', kind: 'runtime-bindings-union', sources: ['payment-runtime', 'refund-runtime'] },
    { id: 'execution', kind: 'execution-bindings-union', sources: ['payment-execution', 'refund-execution', 'sip-execution', 'ta-execution'], sagaBinding: 'sagas' },
  ];
  config.roles = { sagaBinding: 'sagas', runtimeBinding: 'runtime', executionBinding: 'execution' };
  config.products.push(...[
    ['saga-contract', '1'], ['saga-runtime-contract', '1'], ['execution-contract', '1'], ['artifact-contract', '3'],
    ['saga-host-contract', '2'], ['effect-host-contract', '2'], ['product-design', '1'],
  ].map(([id, version]) => ({ id, version })));
  const project = join(root, 'truthsrc.project.json'), out = join(root, 'domain-source');
  writeFileSync(project, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
  const captured = captureProject(project);
  assert.deepEqual(captured.compilation.diagnostics, []);
  assert.equal(captured.compilation.result.products.length, 14);
  assert.equal(captured.canonical.aggregates.length, 3);
  assert.equal(captured.canonical.sagas.length, 2);
  assert.equal(captured.canonical.pipelines.length, 4);
  assert.ok(captured.sources.filter(s => s.file).every(s => !s.file.endsWith('/request.json')));
  const args = ['--project', project, '--out', out];
  const plan = await projectCli('generate-project', [...args, '--plan']);
  assert.equal(existsSync(out), false);
  const applied = await projectCli('generate-project', args);
  assert.equal(applied.applied, true);
  assert.equal(applied.result.total, plan.plan.entries.length);
  assert.ok(plan.plan.entries.some(e => e.content.includes('SipPlan')));
  assert.ok(plan.plan.entries.some(e => e.content.includes('FundOrder')));
  assert.ok(plan.plan.entries.some(e => e.content.includes('CreditBalance')));
  const repeat = await projectCli('generate-project', args);
  assert.equal(repeat.result.written, 0);
  assert.equal(compileTree(tree), JSON.stringify(captured.canonical, null, 2) + '\n');
  t.diagnostic(JSON.stringify({ products: captured.compilation.result.products.length, generatedSourceFiles: plan.plan.entries.length - 4,
    sourceInputs: captured.sources.length, toolSha256: captured.sources.find(s => s.role === 'tool').sha256,
    runtimeVerified: false, historicalCompleteRequest: false }));
});
