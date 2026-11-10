import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { captureProject, projectCli, projectPlan } from '../lib/project/cli.mjs';
import { statusProject, queryProject } from '../lib/project/query.mjs';
import { verifyProject } from '../lib/project/verify.mjs';
import { projectKnowledgeAst } from '../lib/project/graph.mjs';
import { generateProductCli } from '../lib/products/generate-cli.mjs';
import { parseDoc, emitDoc } from '../lib/shared.mjs';
import { validateTree } from '../lib/validate.mjs';
import { roundtrip } from '../lib/roundtrip.mjs';

const scaffold = fileURLToPath(new URL('../scaffold/play-application-project/', import.meta.url));
const generator = fileURLToPath(new URL('../generators/scala-cqrs-play-application-v1/', import.meta.url));
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), 'truthsrc-play-project-'))), author = path.join(root, 'author');
  fs.cpSync(scaffold, author, { recursive: true, force: false, errorOnExist: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, author, project: path.join(author, 'truthsrc.project.json'), out: path.join(root, 'generated') };
}
const generate = (f, ...flags) => projectCli('generate-project', ['--project', f.project, '--out', f.out, ...flags]);
function inventory(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => {
    const file = prefix ? prefix + '/' + e.name : e.name;
    return e.isDirectory() ? inventory(root, file) : [{ file, sha256: createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') }];
  });
}
test('public application writer emits one full plan with external files kept outside ledger', async t => {
  const f = fixture(t), handwritten = inventory(path.join(f.author, 'implementations'));
  const captured = captureProject(f.project);
  assert.equal(captured.compilation.result.products.length, 10);
  assert.equal(captured.implementations.members.length, 2);
  const planned = await generate(f, '--plan');
  assert.equal(fs.existsSync(f.out), false);
  assert.equal(fs.existsSync(path.join(f.author, '.truthsrc')), false);
  assert.equal(planned.plan.entries.filter(e => e.path === 'build.sbt').length, 1);
  assert(planned.plan.entries.every(e => !e.path.startsWith('modules/ext/src/')));
  assert(planned.plan.entries.find(e => e.path === 'conf/routes').content.startsWith('# @generated'));
  assert(planned.plan.entries.find(e => e.path.endsWith('.scala.html')).content.startsWith('@* @generated'));
  await generate(f);
  for (const entry of planned.plan.entries) assert.equal(fs.readFileSync(path.join(f.out, entry.path), 'utf8'), entry.content);
  assert.equal(verifyProject(f).passed, true);
  const before = inventory(f.out);
  assert.equal((await generate(f, '--update')).result.written, 0);
  assert.deepEqual(inventory(f.out), before);
  assert.deepEqual(inventory(path.join(f.author, 'implementations')), handwritten);
});
test('API routes views and bindings have exact final byte spans and reverse lookup', async t => {
  const f = fixture(t), plan = await generate(f, '--plan'); await generate(f);
  for (const entry of plan.plan.entries.filter(e => ['conf/routes', 'build.sbt'].includes(e.path) || e.path.endsWith('.scala.html') || e.path.endsWith('HttpCodec.scala'))) {
    const bytes = fs.readFileSync(path.join(f.out, entry.path));
    for (const mapping of entry.codeMappings) assert.equal(bytes.subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
    const mapping = entry.codeMappings[0]; assert(mapping);
    const line = bytes.subarray(0, mapping.span.start).toString().split('\n').length;
    const reverse = queryProject({ ...f, file: entry.path, line });
    assert(reverse.result.some(r => r.knowledge === mapping.knowledgeKey && r.sourceState === 'mapped'));
  }
});
test('author technical binding and external changes each stale then update without a second request', async t => {
  const f = fixture(t); await generate(f);
  const apiFile = path.join(f.author, 'truth/play-application/contexts/inventory/formal-products/api-contract/warehouse-api.formal.yaml');
  const api = parseDoc(fs.readFileSync(apiFile, 'utf8'));
  api.payload.page.title = 'Receipt history';
  const { payload, ...headers } = api;
  fs.writeFileSync(apiFile, emitDoc({ scalars: Object.entries(headers), blocks: { payload } }));
  assert.deepEqual(validateTree(path.join(f.author, 'truth/play-application')).hard, []);
  assert.equal(roundtrip(path.join(f.author, 'truth/play-application')).ok, true);
  assert.equal(statusProject(f).inputs.state, 'changed');
  await generate(f, '--update'); assert.equal(verifyProject(f).passed, true);
  const bindingFile = path.join(f.author, 'bindings/application.json'), binding = JSON.parse(fs.readFileSync(bindingFile));
  binding.limits.askMillis = 900; fs.writeFileSync(bindingFile, JSON.stringify(binding, null, 2) + '\n');
  assert.equal(statusProject(f).inputs.state, 'changed');
  await generate(f, '--update'); assert.equal(verifyProject(f).passed, true);
  const external = path.join(f.author, 'implementations/ReservationIdentity.scala');
  fs.appendFileSync(external, '\n'); const retained = fs.readFileSync(external);
  assert.equal(statusProject(f).inputs.state, 'changed');
  await generate(f, '--update'); assert.equal(verifyProject(f).passed, true);
  assert.deepEqual(fs.readFileSync(external), retained);
});
test('application refuses cloned capture raw products cross-owner and undeclared manual slots', async t => {
  const f = fixture(t), captured = captureProject(f.project), ast = projectKnowledgeAst(captured);
  assert.throws(() => projectPlan({ ...captured, implementations: structuredClone(captured.implementations) }, f.out, ast));
  const request = path.join(f.root, 'request.json'), options = path.join(f.root, 'options.json');
  fs.writeFileSync(request, JSON.stringify(captured.request)); fs.writeFileSync(options, JSON.stringify(captured.config.options));
  await assert.rejects(generateProductCli(['--request', request, '--options-json', options, '--generator', generator, '--out', f.out, '--plan']),
    e => e.diagnostic?.code === 'APPLICATION_CAPTURE_REQUIRED');
  const planned = await generate(f, '--plan'); await generate(f);
  const entry = planned.plan.entries.find(e => e.path.endsWith('/WarehouseController.scala'));
  fs.appendFileSync(path.join(f.out, entry.path), '\n// ==== BEGIN MANUAL ====\n// unplanned slot\n// ==== END MANUAL ====\n');
  const before = inventory(f.out);
  await assert.rejects(generate(f, '--update'), /outside MANUAL|手写块无落点|update conflict/);
  assert.deepEqual(inventory(f.out), before);
  const other = path.join(f.root, 'other'); fs.cpSync(scaffold, other, { recursive: true });
  await assert.rejects(projectCli('generate-project', ['--project', path.join(other, 'truthsrc.project.json'), '--out', f.out, '--update']), /cross-owner/);
  assert.deepEqual(inventory(f.out), before);
});
