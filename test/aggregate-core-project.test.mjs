import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { captureProject, projectCli } from '../lib/project/cli.mjs';
import { queryProject, statusProject } from '../lib/project/query.mjs';
import { verifyProject } from '../lib/project/verify.mjs';
import { resolve } from '../lib/products/request.mjs';
import { parseAuthorDoc } from '../lib/author-parse.mjs';
import { emitAuthorDoc } from '../lib/author-surface.mjs';

const scaffold = fileURLToPath(new URL('../scaffold/aggregate-core-project/', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function snapshot(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = join(prefix, entry.name);
    return entry.isDirectory() ? snapshot(root, file) : [{ file, sha256: sha256(readFileSync(join(root, file))) }];
  });
}
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-aggregate-core-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const author = join(root, 'author');
  cpSync(scaffold, author, { recursive: true, errorOnExist: true, force: false });
  const slice = join(author, 'truth/aggregate-core/contexts/inventory/aggregates/warehouse/slices/reserve-sku-quantity.slice.yaml');
  const doc = parseAuthorDoc(readFileSync(slice, 'utf8'), slice);
  doc.payload.parameters = doc.payload.parameters.map(row => typeof row === 'string' ? row : `${row.name}: ${row.dataType} @${row.origin}`);
  writeFileSync(slice, emitAuthorDoc(doc));
  return { root, author, project: join(author, 'truthsrc.project.json'), out: join(root, 'generated') };
}
const args = f => ['--project', f.project, '--out', f.out];
const generate = (f, ...flags) => projectCli('generate-project', [...args(f), ...flags]);
const json = file => JSON.parse(readFileSync(file));

// Source/writer acceptance only. Actor, pure Scala behavior and byte serialization
// run in the separately admitted offline verifier, never in Node discovery.
test('aggregate-core author project writes a closed plan and navigates pure and Actor sources', async t => {
  const f = fixture(t), before = snapshot(f.author), captured = captureProject(f.project);
  assert.equal(captured.validation.hard.length, 0);
  assert.equal(captured.validation.roundtrip.ok, true);
  const planned = await generate(f, '--plan');
  assert.equal(planned.applied, false);
  assert.equal(existsSync(f.out), false);
  assert.deepEqual(snapshot(f.author), before);
  assert.equal(planned.plan.generator.id, 'scala-cqrs-aggregate-core');
  const entries = planned.plan.entries.filter(entry => !entry.path.startsWith('.truthsrc/'));
  for (const kind of ['rules', 'command-helpers', 'event-handler', 'actor-protocol', 'aggregate', 'aggregate-factory', 'aggregate-bootstrap', 'actor-repository', 'actor-repository-implementation'])
    assert.ok(entries.some(entry => entry.kind === kind && entry.codeMappings.length), kind);
  const paths = new Set(planned.plan.entries.map(entry => entry.path));
  assert.ok(entries.every(entry => entry.deps.every(dep => paths.has(dep))));
  for (const entry of entries.filter(entry => entry.path.startsWith('modules/kernel/')))
    assert.doesNotMatch(entry.content, /import akka\.|ActorRef|EventSourcedBehavior|example\.inventory\.infrastructure/);
  const applied = await generate(f);
  assert.equal(applied.applied, true);
  for (const entry of planned.plan.entries) assert.equal(readFileSync(join(f.out, entry.path), 'utf8'), entry.content);
  const verification = verifyProject(f);
  assert.equal(verification.passed, true, JSON.stringify(verification.diagnostics));
  assert.equal(verification.runtimeVerified, false);
  const anchors = json(join(f.out, 'anchors.json')).anchors;
  let mapped = 0, compact = 0;
  for (const entry of entries.filter(entry => entry.path.endsWith('.scala'))) {
    const bytes = readFileSync(join(f.out, entry.path));
    for (const mapping of entry.codeMappings) {
      const prefix = 'source:' + captured.config.canonicalId + '#';
      assert.ok(mapping.knowledgeKey.startsWith(prefix));
      assert.notEqual(resolve(captured.canonical, mapping.knowledgeKey.slice(prefix.length), { document: 'assertion', pointer: '' }), undefined);
      const locations = anchors[mapping.knowledgeKey].filter(location => location.file === entry.path && location.span?.start === mapping.span.start);
      assert.equal(locations.length, 1);
      assert.equal(bytes.subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
    }
    const mapping = entry.codeMappings.find(row => /\/guards\/|\/foldAssignments\/|\/bindings\/|\/parameters\//.test(row.knowledgeKey)) ?? entry.codeMappings[0];
    assert.ok(mapping, entry.path);
    const line = bytes.subarray(0, mapping.span.start).toString().split('\n').length;
    const reverse = queryProject({ ...f, file: entry.path, line });
    assert.equal(reverse.precision, 'span');
    const match = reverse.result.find(row => row.knowledge === mapping.knowledgeKey);
    assert.ok(match, mapping.knowledgeKey);
    assert.equal(match.sourceState, 'mapped');
    assert.ok(match.origins.some(origin => origin.file && existsSync(join(captured.tree, origin.file))));
    compact += match.origins.filter(origin => origin.locationMapping?.mode === 'declaration').length;
    const forward = queryProject({ ...f, knowledge: mapping.knowledgeKey });
    assert.ok(forward.result.some(row => row.locations.some(location => location.file === entry.path && location.span?.start === mapping.span.start)));
    mapped++;
  }
  assert.ok(mapped > 0);
  assert.ok(compact > 0);
  const unchanged = snapshot(f.out);
  assert.equal((await generate(f, '--update')).result.written, 0);
  assert.deepEqual(snapshot(f.out), unchanged);
});

test('changing an author guard produces stale then preview/update/fresh without changing old evidence', async t => {
  const f = fixture(t);
  await generate(f);
  const slice = join(f.author, 'truth/aggregate-core/contexts/inventory/aggregates/warehouse/slices/reserve-sku-quantity.slice.yaml');
  const original = readFileSync(slice, 'utf8');
  assert.ok(original.includes('param.quantity > 0'), 'independent author guard is explicit');
  writeFileSync(slice, original.replace('param.quantity > 0', 'param.quantity > 1'));
  assert.equal(statusProject(f).synchronized, false);
  assert.equal(verifyProject(f).passed, false);
  const before = snapshot(f.out);
  const preview = await generate(f, '--update', '--plan');
  assert.equal(preview.applied, false);
  assert.deepEqual(snapshot(f.out), before);
  assert.equal((await generate(f, '--update')).applied, true);
  const after = verifyProject(f);
  assert.equal(after.passed, true, JSON.stringify(after.diagnostics));
  const status = statusProject(f);
  assert.equal(status.synchronized, true, JSON.stringify(status));
  assert.equal((await generate(f, '--update')).result.written, 0);
});

test('aggregate-core rejects generated edits and cannot update a differently owned output', async t => {
  const f = fixture(t), applied = await generate(f);
  const rules = applied.result.actions.find(entry => entry.kind === 'rules');
  assert.ok(rules);
  const file = join(f.out, rules.path);
  writeFileSync(file, readFileSync(file, 'utf8') + '\n// unexpected generated-region edit\n');
  const before = snapshot(f.out);
  await assert.rejects(generate(f, '--update'));
  assert.deepEqual(snapshot(f.out), before);
  assert.equal(verifyProject(f).passed, false);
  const config = json(f.project);
  config.generator = 'scala-cqrs-domain-kernel-v1';
  writeFileSync(f.project, JSON.stringify(config, null, 2) + '\n');
  await assert.rejects(generate(f, '--update'));
  assert.deepEqual(snapshot(f.out), before);
});

test('unknown technical business overrides cannot alter the author contract or existing output', async t => {
  const f = fixture(t);
  await generate(f);
  const before = snapshot(f.out), config = json(f.project);
  config.options.businessRules = { quantityPositive: false };
  writeFileSync(f.project, JSON.stringify(config, null, 2) + '\n');
  await assert.rejects(generate(f, '--plan'));
  assert.deepEqual(snapshot(f.out), before);
});
