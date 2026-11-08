import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { captureProject, projectCli } from '../lib/project/cli.mjs';
import { queryProject, statusProject } from '../lib/project/query.mjs';
import { verifyProject } from '../lib/project/verify.mjs';
import { resolve } from '../lib/products/request.mjs';

const scaffold = fileURLToPath(new URL('../scaffold/persistence-readside-project/', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(readFileSync(file));
function inventory(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = join(prefix, entry.name);
    return entry.isDirectory() ? inventory(root, file) : [{ file, sha256: hash(readFileSync(join(root, file))) }];
  });
}
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'truthsrc-persistence-project-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const author = join(root, 'author');
  cpSync(scaffold, author, { recursive: true, errorOnExist: true, force: false });
  return { root, author, project: join(author, 'truthsrc.project.json'), out: join(root, 'generated') };
}
const generate = (f, ...flags) => projectCli('generate-project', ['--project', f.project, '--out', f.out, ...flags]);
function binding(f) {
  const config = json(f.project), doc = config.documents.find(d => d.id === config.roles.persistenceReadsideBinding);
  assert.ok(doc);
  const path = join(f.author, doc.file);
  return { path, value: json(path), id: doc.id };
}
function updateBinding(f, edit) {
  const b = binding(f); edit(b.value); writeFileSync(b.path, JSON.stringify(b.value, null, 2) + '\n');
}

// Public source/writer integration, not JVM/H2/serializer runtime qualification.
test('persistence project generates one closed owned plan with final SQL/config/Scala provenance', async t => {
  const f = fixture(t), before = inventory(f.author), captured = captureProject(f.project);
  assert.equal(captured.validation.hard.length, 0);
  assert.equal(captured.validation.roundtrip.ok, true);
  assert.equal(captured.implementations, undefined, 'no generation-time external Scala source admission required');
  const planned = await generate(f, '--plan');
  assert.equal(planned.applied, false); assert.equal(existsSync(f.out), false);
  assert.deepEqual(inventory(f.author), before);
  assert.equal(planned.plan.generator.id, 'scala-cqrs-persistence-readside');
  const entries = planned.plan.entries.filter(e => !e.path.startsWith('.truthsrc/'));
  assert.ok(entries.some(e => e.path.endsWith('.sql')));
  assert.ok(entries.some(e => e.path.endsWith('.conf')));
  assert.ok(entries.some(e => e.path.endsWith('.proto') && e.content.includes('layout_sha256')));
  const paths = new Set(planned.plan.entries.map(e => e.path));
  assert.ok(entries.every(e => e.deps.every(p => paths.has(p))));
  for (const entry of entries.filter(e => e.path.startsWith('modules/kernel/'))) {
    assert.doesNotMatch(entry.content, /import akka\.|java\.sql|javax\.sql|scalapb\.|infrastructure\.readside/);
  }
  for (const entry of entries.filter(e => e.path.endsWith('.sql'))) assert.match(entry.content, /^-- @generated/);
  assert.equal((await generate(f)).applied, true);
  for (const entry of planned.plan.entries) assert.equal(readFileSync(join(f.out, entry.path), 'utf8'), entry.content);
  const verified = verifyProject(f);
  assert.equal(verified.passed, true, JSON.stringify(verified.diagnostics));
  assert.equal(verified.runtimeVerified, false);
  const b = binding(f), anchors = json(join(f.out, 'anchors.json')).anchors;
  let domainMappings = 0, bindingMappings = 0;
  const domains = 'source:' + captured.config.canonicalId + '#', technical = 'source:' + b.id + '#';
  for (const entry of entries) {
    const bytes = readFileSync(join(f.out, entry.path));
    for (const mapping of entry.codeMappings) {
      assert.equal(bytes.subarray(mapping.span.start, mapping.span.end).toString(), mapping.span.text);
      assert.ok(anchors[mapping.knowledgeKey]?.some(a => a.file === entry.path && a.span?.start === mapping.span.start));
      if (mapping.knowledgeKey.startsWith(domains)) {
        assert.notEqual(resolve(captured.canonical, mapping.knowledgeKey.slice(domains.length), { document: 'test', pointer: '' }), undefined);
        domainMappings++;
      } else if (mapping.knowledgeKey.startsWith(technical)) {
        assert.notEqual(resolve(b.value, mapping.knowledgeKey.slice(technical.length), { document: 'test', pointer: '' }), undefined);
        bindingMappings++;
      }
    }
    const mapping = entry.codeMappings.find(m => m.knowledgeKey.startsWith(technical) && /\/wire\/registrations\/|\/store\/indexes\//.test(m.knowledgeKey));
    if (!mapping) continue;
    const line = bytes.subarray(0, mapping.span.start).toString().split('\n').length;
    const reverse = queryProject({ ...f, file: entry.path, line });
    assert.equal(reverse.precision, 'span');
    const match = reverse.result.find(row => row.knowledge === mapping.knowledgeKey);
    assert.ok(match && match.sourceState === 'mapped', JSON.stringify(reverse));
    assert.ok(match.origins.some(origin => origin.file === b.path || origin.file === binding(f).path.split(f.author + '/')[1]));
    const forward = queryProject({ ...f, knowledge: mapping.knowledgeKey });
    assert.ok(forward.result.some(row => row.locations.some(location => location.file === entry.path)));
  }
  assert.ok(domainMappings > 0 && bindingMappings > 0);
  const beforeAgain = inventory(f.out);
  assert.equal((await generate(f, '--update')).result.written, 0);
  assert.deepEqual(inventory(f.out), beforeAgain);
});

test('technical mapping changes report stale and controlled update without silently refreshing wire pins', async t => {
  const f = fixture(t); await generate(f);
  const pins = binding(f).value.wire.registrations.map(r => r.layoutSha256);
  updateBinding(f, b => { b.store.indexes[0].valueSize += 1; });
  assert.equal(statusProject(f).synchronized, false);
  assert.equal(verifyProject(f).passed, false);
  const before = inventory(f.out);
  assert.equal((await generate(f, '--update', '--plan')).applied, false);
  assert.deepEqual(inventory(f.out), before);
  await generate(f, '--update');
  assert.equal(verifyProject(f).passed, true);
  assert.equal(statusProject(f).synchronized, true);
  assert.deepEqual(binding(f).value.wire.registrations.map(r => r.layoutSha256), pins);
});

test('wrong expected layout prevents any source writes instead of repinning to current wire', async t => {
  const f = fixture(t); await generate(f);
  updateBinding(f, b => { b.wire.registrations[0].layoutSha256 = '0'.repeat(64); });
  const before = inventory(f.out), edited = readFileSync(binding(f).path);
  await assert.rejects(generate(f, '--update', '--plan'));
  await assert.rejects(generate(f, '--update'));
  assert.deepEqual(inventory(f.out), before);
  assert.ok(readFileSync(binding(f).path).equals(edited));
  assert.equal(statusProject(f).synchronized, false);
});

test('generated tampering remains protected', async t => {
  const f = fixture(t); const applied = await generate(f);
  const scala = applied.result.actions.find(e => e.path.endsWith('.scala'));
  assert.ok(scala);
  const path = join(f.out, scala.path);
  writeFileSync(path, readFileSync(path, 'utf8') + '\n// unauthorized generated-region change\n');
  const before = inventory(f.out);
  await assert.rejects(generate(f, '--update'));
  assert.deepEqual(inventory(f.out), before);
  assert.equal(verifyProject(f).passed, false);
});
