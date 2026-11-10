import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { captureProject, projectCli, projectPlan } from '../lib/project/cli.mjs';
import { queryProject, statusProject } from '../lib/project/query.mjs';
import { verifyProject } from '../lib/project/verify.mjs';
import { projectKnowledgeAst } from '../lib/project/graph.mjs';
import { generateProductCli, registeredProductProducer } from '../lib/products/generate-cli.mjs';

const scaffold = fileURLToPath(new URL('../scaffold/saga-monarch-project/', import.meta.url));
const generator = fileURLToPath(new URL('../generators/scala-cqrs-saga-monarch-v1/', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function snapshot(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = prefix ? prefix + '/' + entry.name : entry.name;
    return entry.isDirectory() ? snapshot(root, file) : [{ file, sha256: hash(readFileSync(join(root, file))) }];
  });
}
function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'truthsrc-saga-monarch-project-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const author = join(root, 'author');
  cpSync(scaffold, author, { recursive: true, force: false, errorOnExist: true });
  return { root, author, project: join(author, 'truthsrc.project.json'), out: join(root, 'generated') };
}
const generate = (f, ...flags) => projectCli('generate-project', ['--project', f.project, '--out', f.out, ...flags]);
const scala = entry => entry.path.endsWith('.scala');

test('registered source-capture capabilities select both implementation families without caller code', () => {
  for (const [directory, id] of [['scala-cqrs-module-seams-v1', 'scala-cqrs-module-seams'], ['scala-cqrs-saga-monarch-v1', 'scala-cqrs-saga-monarch']]) {
    const producer = registeredProductProducer(fileURLToPath(new URL('../generators/' + directory + '/', import.meta.url)));
    assert.equal(typeof producer.resolveImplementations, 'function');
    assert.deepEqual(producer.identity, { id, version: '1' });
    assert.ok(producer.captureRequired.code.endsWith('_CAPTURE_REQUIRED'));
    assert.ok(Object.isFrozen(producer));
  }
});

test('real project capture plans six Scala files and preserves the external implementation', async t => {
  const f = fixture(t), before = snapshot(join(f.author, 'implementations'));
  const captured = captureProject(f.project);
  assert.equal(captured.compilation.result.products.length, 8);
  assert.equal(captured.implementations.members.length, 1);
  const planned = await generate(f, '--plan');
  assert.equal(planned.applied, false);
  assert.equal(planned.plan.entries.filter(scala).length, 6);
  assert.equal(planned.plan.entries.length, 13);
  assert.ok(planned.plan.entries.every(e => !e.path.startsWith('modules/ext/src/')));
  assert.equal(planned.implementationEvidence.files, 1);
  assert.equal(existsSync(f.out), false);
  assert.equal(existsSync(join(f.author, '.truthsrc/knowledge.sqlite')), false);
  const applied = await generate(f);
  assert.equal(applied.applied, true);
  for (const entry of planned.plan.entries) assert.equal(readFileSync(join(f.out, entry.path), 'utf8'), entry.content);
  assert.deepEqual(snapshot(join(f.author, 'implementations')), before);
  const verified = verifyProject(f);
  assert.equal(verified.passed, true, JSON.stringify(verified.diagnostics));
  assert.equal(verified.runtimeVerified, false);
  const output = snapshot(f.out);
  assert.equal((await generate(f, '--update')).result.written, 0);
  assert.deepEqual(snapshot(f.out), output);
});

test('workflow and technical source spans remain exact final UTF-8 and resolve in both directions', async t => {
  const f = fixture(t), planned = await generate(f, '--plan');
  await generate(f);
  const entry = planned.plan.entries.find(e => e.path.endsWith('/InventoryWorkflow.scala'));
  assert.ok(entry);
  for (const mapping of entry.codeMappings) {
    const bytes = readFileSync(join(f.out, entry.path));
    assert.equal(bytes.subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
  }
  for (const key of ['source:inventory-domain#/workflows/0', 'source:composition#']) {
    const mapping = entry.codeMappings.find(m => m.knowledgeKey === key);
    assert.ok(mapping, key);
    const bytes = readFileSync(join(f.out, entry.path));
    const line = bytes.subarray(0, mapping.span.start).toString().split('\n').length;
    const reverse = queryProject({ ...f, file: entry.path, line });
    assert.equal(reverse.precision, 'span');
    const row = reverse.result.find(r => r.knowledge === key);
    assert.equal(row?.sourceState, 'mapped', JSON.stringify(reverse));
    assert.ok(row.origins.every(origin => origin.file));
    assert.ok(queryProject({ ...f, knowledge: key }).result.some(r => r.locations.some(l => l.file === entry.path)));
  }
});

test('external implementation freshness uses live capture and never writes consumer code', async t => {
  const f = fixture(t); await generate(f);
  const captured = captureProject(f.project, { roundtripCheck: false });
  const member = captured.implementations.members[0];
  writeFileSync(member.absoluteFile, readFileSync(member.absoluteFile, 'utf8') + '\n// consumer-owned annotation\n');
  assert.equal(statusProject(f).inputs.state, 'changed');
  assert.equal(verifyProject(f).passed, false);
  const query = queryProject({ ...f, implementation: member.id });
  assert.equal(query.result[0].generationInput, 'not-synchronized');
  assert.equal(query.result[0].spanVerified, false);
  const bytes = readFileSync(member.absoluteFile);
  await generate(f, '--update');
  assert.deepEqual(readFileSync(member.absoluteFile), bytes);
  assert.equal(statusProject(f).inputs.state, 'current');
  assert.equal(verifyProject(f).passed, true);
});

test('Saga Monarch refuses unowned target reuse and unplanned MANUAL additions without source overwrite', async t => {
  const f = fixture(t), planned = await generate(f, '--plan'); await generate(f);
  const entry = planned.plan.entries.find(scala), file = join(f.out, entry.path);
  const changed = readFileSync(file, 'utf8') + '\n// ==== BEGIN MANUAL ====\n// consumer addition without a declared slot\n// ==== END MANUAL ====\n';
  writeFileSync(file, changed);
  const before = snapshot(f.out);
  await assert.rejects(generate(f, '--update'), /outside MANUAL|手写块无落点|update conflict/);
  assert.deepEqual(snapshot(f.out), before);
  const other = join(f.root, 'other-author'); cpSync(scaffold, other, { recursive: true, force: false, errorOnExist: true });
  await assert.rejects(projectCli('generate-project', ['--project', join(other, 'truthsrc.project.json'), '--out', f.out, '--update']), /cross-owner/);
  assert.deepEqual(snapshot(f.out), before);
});

test('raw and cloned implementation evidence cannot substitute for project capture', async t => {
  const f = fixture(t), captured = captureProject(f.project), ast = projectKnowledgeAst(captured);
  assert.throws(() => projectPlan({ ...captured, implementations: structuredClone(captured.implementations) }, f.out, ast));
  const request = join(f.root, 'request.json'), options = join(f.root, 'options.json');
  writeFileSync(request, JSON.stringify(captured.request)); writeFileSync(options, JSON.stringify(captured.config.options));
  for (const flags of [[], ['--plan']]) await assert.rejects(generateProductCli(['--request', request, '--options-json', options,
    '--generator', generator, '--out', f.out, ...flags]), error => error.diagnostic?.code === 'SAGA_MONARCH_CAPTURE_REQUIRED');
  assert.equal(existsSync(f.out), false);
});
