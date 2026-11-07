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

const scaffold = fileURLToPath(new URL('../scaffold/domain-kernel-project/', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function snapshot(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = join(prefix, entry.name);
    return entry.isDirectory() ? snapshot(root, file) : [{ file, sha256: sha256(readFileSync(join(root, file))) }];
  });
}
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-domain-kernel-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const author = join(root, 'author');
  cpSync(scaffold, author, { recursive: true, errorOnExist: true, force: false });
  return { root, author, project: join(author, 'truthsrc.project.json'), out: join(root, 'generated') };
}
const args = f => ['--project', f.project, '--out', f.out];
const generate = (f, ...flags) => projectCli('generate-project', [...args(f), ...flags]);
const json = file => JSON.parse(readFileSync(file));

test('family1 author project generates complete final bytes and maps each core responsibility', async t => {
  const f = fixture(t), before = snapshot(f.author), captured = captureProject(f.project);
  assert.equal(captured.validation.hard.length, 0);
  assert.equal(captured.validation.roundtrip.ok, true);
  const planned = await generate(f, '--plan');
  assert.equal(planned.applied, false);
  assert.equal(existsSync(f.out), false);
  assert.deepEqual(snapshot(f.author), before);
  assert.equal(planned.plan.generator.id, 'scala-cqrs-domain-kernel');
  const entries = planned.plan.entries.filter(entry => !entry.path.startsWith('.truthsrc/'));
  for (const kind of ['value-object', 'exact-value-codec', 'protocol', 'state', 'rule-parameters'])
    assert.ok(entries.some(entry => entry.kind === kind && entry.codeMappings.length), kind);
  assert.ok(entries.every(entry => !['aggregate', 'serialization-adapter', 'event-handler', 'command-helpers'].includes(entry.kind)));
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
      assert.ok(mapping.knowledgeKey.startsWith(prefix), 'only actual canonical source keys expected');
      assert.notEqual(resolve(captured.canonical, mapping.knowledgeKey.slice(prefix.length), { document: 'assertion', pointer: '' }), undefined);
      const locations = anchors[mapping.knowledgeKey].filter(location => location.file === entry.path && location.span?.start === mapping.span.start);
      assert.equal(locations.length, 1);
      assert.equal(bytes.subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
    }
    // Every mapping is byte/source-checked above and by verifyProject. Public
    // queries select one field/default per artifact rather than recompiling the
    // same project hundreds of times for incidental duplicate associations.
    const mapping = entry.codeMappings.find(row => /\/fields\/|\/parameters\/|\/stateFields\/|\/payloads\//.test(row.knowledgeKey)) ?? entry.codeMappings[0];
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
  assert.ok(compact > 0, 'the sample must contain a real compact declaration origin');
  const unchanged = snapshot(f.out);
  assert.equal((await generate(f, '--update')).result.written, 0);
  assert.deepEqual(snapshot(f.out), unchanged);
});

test('candidate explicit defaults evolve only through protected source update', async t => {
  const f = fixture(t);
  await generate(f);
  const aggregate = join(f.author, 'truth/domain-kernel/contexts/counter/aggregates/counter/aggregate.yaml');
  const original = readFileSync(aggregate, 'utf8');
  assert.ok(original.includes('"-7"'), 'fixture has the independent nonzero counter default');
  writeFileSync(aggregate, original.replace('"-7"', '"-8"'));
  assert.equal(statusProject(f).synchronized, false);
  assert.equal(verifyProject(f).passed, false);
  const before = snapshot(f.out);
  const preview = await generate(f, '--update', '--plan');
  assert.equal(preview.applied, false);
  assert.deepEqual(snapshot(f.out), before);
  assert.equal((await generate(f, '--update')).applied, true);
  assert.equal(verifyProject(f).passed, true);
  assert.equal(statusProject(f).synchronized, true);
  assert.equal((await generate(f, '--update')).result.written, 0);
});

test('candidate refuses changed generated code and unknown technical options without overwrites', async t => {
  const f = fixture(t);
  const applied = await generate(f);
  const state = applied.result.actions.find(entry => entry.kind === 'state');
  const file = join(f.out, state.path);
  writeFileSync(file, readFileSync(file, 'utf8') + '\n// unsolicited generated-region edit\n');
  const before = snapshot(f.out);
  await assert.rejects(generate(f, '--update'));
  assert.deepEqual(snapshot(f.out), before);
  assert.equal(verifyProject(f).passed, false);
  const config = json(f.project);
  config.options.inferredBusinessDefaults = true;
  writeFileSync(f.project, JSON.stringify(config, null, 2) + '\n');
  await assert.rejects(generate(f, '--plan'));
  assert.deepEqual(snapshot(f.out), before);
});
