import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkLocal, loadCatalogue, validateCatalogue, coverageSummary } from '../lib/artifact-docs/catalog.mjs';
import { DOC_ROOT, readJson } from '../lib/artifact-docs/io.mjs';
import { parseArgs } from '../tools/artifact-docs-check.mjs';

const data = loadCatalogue();
const read = file => readFileSync(join(DOC_ROOT, file), 'utf8');

test('all catalogue categories have substantive pages under the selected target hierarchy', () => {
  const ids = validateCatalogue(data.catalog, read);
  assert.ok(ids.size > 100);
  assert.ok(data.catalog.categories.filter(c => c.family !== 'tooling' && c.family !== 'typescript').every(c => c.document.startsWith('scala-cqrs/')));
  for (const id of ['computation-port', 'application-flow-port', 'identity-store-port', 'graph-store-port', 'signature-value-closure',
    'port-bridge', 'port-binding-module', 'workflow-program', 'external-operation-connector', 'durable-inbox', 'resource-domain']) assert.ok(ids.has(id), id);
  assert.equal(checkLocal().passed, true);
});

test('coverage is a derived view rather than an independently editable green receipt', () => {
  assert.deepEqual(coverageSummary(data.catalog, data.lock), data.coverage);
  const changed = structuredClone(data); changed.coverage.categories--;
  assert.ok(checkLocal({ data: changed }).diagnostics.some(row => row.code === 'COVERAGE_DRIFT'));
});

test('known unclassified external rows cannot pass merely by refreshing coverage totals', () => {
  const changed = structuredClone(data);
  const row = changed.lock.repositories.bc.files.find(f => f.path.endsWith('/_count_issues.mjs'));
  row.categories = [];
  changed.coverage = coverageSummary(changed.catalog, changed.lock);
  const result = checkLocal({ data: changed });
  assert.equal(result.passed, false);
  assert.ok(result.diagnostics.some(d => d.code === 'LOCK_UNCLASSIFIED'));
});

test('missing section, empty page and missing document reject', () => {
  const first = data.catalog.categories[0].document;
  assert.throws(() => validateCatalogue(data.catalog, file => file === first ? '# Empty' : read(file)), /substantive/);
  assert.throws(() => validateCatalogue(data.catalog, file => file === first ? read(file).replace('## 验证', '## Absent') : read(file)), /section/);
  assert.throws(() => validateCatalogue(data.catalog, file => { if (file === first) throw new Error('missing'); return read(file); }), /missing/);
});

test('category identity, legacy alias and dependency ambiguity reject', () => {
  for (const change of [
    c => c.categories.push(structuredClone(c.categories[0])),
    c => { c.categories[1].aliases.docs.push(c.categories[0].aliases.docs[0]); },
    c => { c.categories[0].dependsOn.push('unknown-category'); },
    c => { c.categories[0].document = '../outside.md'; },
    c => { c.categories[0].variants[0].ownership = 'anything'; }
  ]) {
    const c = structuredClone(data.catalog); change(c);
    assert.throws(() => validateCatalogue(c, read));
  }
});

test('strict runtime capability is not advertised as generated bank R2 consumption', () => {
  const c = data.catalog.categories.find(c => c.id === 'workflow-program');
  const runtime = c.variants.find(v => v.profile === 'monarch-r2');
  assert.equal(runtime.availability, 'not-generated');
  assert.equal(runtime.ownership, 'handwritten');
  assert.deepEqual(runtime.capability.routes, []);
  const generated = c.variants.find(v => v.profile === 'js-saga-monarch-r2-candidate-v1');
  assert.equal(generated.availability, 'implemented');
  assert.equal(generated.ownership, 'generated');
  assert.deepEqual(generated.capability.routes, [{ producer: 'scala-cqrs-saga-monarch-v1', outputs: ['workflow-program'] }]);
  assert.equal(c.variants.some(v => v.profile === 'bank-p23'), false);
  assert.match(read(c.document), /P23/);
  assert.match(read('scala-cqrs/CONVENTIONS.md'), /五个空间/);
  assert.match(read('scala-cqrs/ports/port-binding-module.md'), /不是BC全部原生生成/);
});

test('multi-module interface, binding, protobuf and runtime-library placement cannot drift silently', () => {
  for (const id of ['computation-port', 'port-binding-module', 'protobuf-schema', 'workflow-host-bootstrap']) {
    const c = structuredClone(data.catalog);
    const row = c.categories.find(row => row.id === id);
    const variant = row.variants.find(v => ['bc-multi', 'di-poc'].includes(v.profile)) ?? row.variants[0];
    variant.modules = ['wrong-module'];
    assert.throws(() => validateCatalogue(c, read), /module|library/);
  }
});

test('CLI refuses unknown, duplicate, incomplete and misleading local options', () => {
  assert.equal(parseArgs([]).mode, 'local');
  assert.equal(parseArgs(['--cross-repo', '--require-all', '--repo', 'bc=/tmp/bc']).roots.bc, '/tmp/bc');
  for (const args of [['--all'], ['--cross-repo'], ['--local', '--repo', 'bc=/tmp/bc'], ['--snapshots', '--repo', 'bc=relative'],
    ['--local', '--local'], ['--catalog-root'], ['--cross-repo', '--require-all', '--require-all']]) assert.throws(() => parseArgs(args));
});
